import { json, redirect, type LoaderFunctionArgs, type ActionFunctionArgs } from '@remix-run/node';
import { useLoaderData, useFetcher, Link, useSearchParams } from '@remix-run/react';
import { useState, useEffect, useMemo } from 'react';
import { Modal } from 'react-bootstrap';
import feather from 'feather-icons';
import { ChatTranscript } from '~/models/chattranscript';
import { getUserFromSession } from '~/utils/auth.server';

/* ═══ LOADER ═══ */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const user = await getUserFromSession(request);
  if (!user) return redirect('/login');

  const isSuperAdmin = user.roles?.includes('SUPER_ADMIN');
  const filter = isSuperAdmin ? {} : { clientId: user._id };

  const url = new URL(request.url);
  const pageParam = Number(url.searchParams.get('page') ?? '1');
  const pageSizeParam = Number(url.searchParams.get('pageSize') ?? '10');

  const page = Number.isFinite(pageParam) && pageParam > 0 ? Math.floor(pageParam) : 1;
  const pageSize = Number.isFinite(pageSizeParam) && pageSizeParam > 0 ? Math.min(Math.floor(pageSizeParam), 50) : 10;

  const basePipeline: any[] = [
    { $match: filter },
    { $sort: { updatedAt: -1 } },
    {
      $group: {
        _id: {
          $ifNull: ['$lead.email', { $toString: '$_id' }],
        },
        doc: { $first: '$$ROOT' },
      },
    },
    { $replaceRoot: { newRoot: '$doc' } },
    { $sort: { updatedAt: -1 } },
  ];

  const [{ count = 0 } = {}] = await ChatTranscript.aggregate([...basePipeline, { $count: 'count' }]);

  const totalPages = Math.max(Math.ceil(count / pageSize), 1);
  const safePage = Math.min(page, totalPages);

  const chatsRaw = await ChatTranscript.aggregate([
    ...basePipeline,
    { $skip: (safePage - 1) * pageSize },
    { $limit: pageSize },
    {
      $lookup: {
        from: 'users',
        localField: 'agent',
        foreignField: '_id',
        as: 'agent',
        pipeline: [{ $project: { firstName: 1, lastName: 1 } }],
      },
    },
    { $unwind: { path: '$agent', preserveNullAndEmptyArrays: true } },
    { $project: { messages: 0 } },
  ]);

  const chats = JSON.parse(JSON.stringify(chatsRaw));

  return json({ chats, pagination: { page: safePage, pageSize, total: count, pageCount: totalPages } });
};

/* ═══ ACTION ═══ */
export const action = async ({ request }: ActionFunctionArgs) => {
  const form = await request.formData();
  const { _action, id } = Object.fromEntries(form);

  if (_action === 'toggleDelete') {
    const doc = await ChatTranscript.findById(id);
    if (!doc) return json({ ok: false, error: 'Not found' }, { status: 404 });
    doc.isDeleted = !doc.isDeleted;
    await doc.save();
    return json({ ok: true });
  }

  if (_action === 'view') {
    const doc = await ChatTranscript.findById(id).lean();
    if (!doc) return json({ ok: false, error: 'Not found' }, { status: 404 });
    return json({ ok: true, chat: doc });
  }

  return json({ ok: false, error: 'Invalid action' }, { status: 400 });
};

/* ═══ COMPONENT ═══ */
export default function ChatListPage() {
  const { chats, pagination } = useLoaderData<typeof loader>();
  const { page, pageSize, total, pageCount } = pagination;

  const [searchParams] = useSearchParams();

  const modalFetcher = useFetcher(); // load full transcript

  const [show, setShow] = useState(false);
  const [activeChat, setActiveChat] = useState<any>(null);

  /* icons */
  useEffect(() => {
    feather.replace();
  }, [chats]);

  /* open modal when data arrives */
  useEffect(() => {
    if (modalFetcher.data?.ok) {
      setActiveChat(modalFetcher.data.chat);
      setShow(true);
    }
  }, [modalFetcher.data]);

  const handleView = (id: string) => modalFetcher.submit({ _action: 'view', id }, { method: 'post' });

  const paginationInfo = useMemo(() => {
    const start = (page - 1) * pageSize + 1;
    const end = start + chats.length - 1;
    return { start: chats.length ? start : 0, end: chats.length ? Math.min(end, total) : 0 };
  }, [chats.length, page, pageSize, total]);

  const buildPageLink = (target: number) => {
    const params = new URLSearchParams(searchParams);
    params.set('page', String(target));
    if (params.get('pageSize')) {
      params.set('pageSize', String(pageSize));
    }
    return `?${params.toString()}`;
  };

  return (
    <>
      {/* HEADER */}
      <div className="d-flex justify-content-between align-items-center mb-5">
        <h3 className="mb-0 text-white">Conversations</h3>
      </div>

      {/* TABLE */}
      <div className="card">
        <div className="card-header">
          <h4 className="mb-0">Chat Leads</h4>
        </div>
        <div className="card-body">
          <div className="table-responsive table-card">
            <table className="table text-nowrap mb-0 table-centered table-hover">
              <thead className="table-light">
                <tr>
                  <th>Client</th>
                  <th>Lead Name</th>
                  <th>Lead Email</th>
                  <th>Last Updated</th>
                  <th>Options</th>
                </tr>
              </thead>
              <tbody>
                {chats.map(chat => (
                  <tr key={chat._id}>
                    <td>{chat.agent ? `${chat.agent.firstName} ${chat.agent.lastName}` : '—'}</td>
                    <td>{chat.lead?.name ?? '—'}</td>
                    <td>{chat.lead?.email ?? '—'}</td>

                    <td>{new Date(chat.updatedAt).toLocaleString()}</td>
                    <td className="d-flex gap-2">
                      <button onClick={() => handleView(chat._id)} className="btn btn-ghost btn-icon btn-sm rounded-circle">
                        <i data-feather="eye" className="icon-xs" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-2 mt-3">
            <div className="text-muted">
              {paginationInfo.start ? (
                <>Showing {paginationInfo.start} – {paginationInfo.end} of {total}</>
              ) : (
                'No conversations found'
              )}
            </div>
            <div className="btn-group">
              {page > 1 ? (
                <Link className="btn btn-outline-secondary" to={buildPageLink(page - 1)}>
                  Previous
                </Link>
              ) : (
                <span className="btn btn-outline-secondary disabled" aria-disabled="true">
                  Previous
                </span>
              )}
              <span className="btn btn-outline-secondary disabled">
                Page {page} of {pageCount}
              </span>
              {page < pageCount ? (
                <Link className="btn btn-outline-secondary" to={buildPageLink(page + 1)}>
                  Next
                </Link>
              ) : (
                <span className="btn btn-outline-secondary disabled" aria-disabled="true">
                  Next
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* MODAL */}
      <Modal size="xl" show={show} onHide={() => setShow(false)} scrollable contentClassName="border-0 rounded-4">
        <Modal.Header closeButton className="border-0 pb-0">
          <Modal.Title className="fw-semibold">
            {activeChat?.lead?.name ?? 'Conversation'}
            {activeChat?.lead?.email ? <span className="text-muted ms-2">· {activeChat.lead.email}</span> : null}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="pt-0" style={{ maxHeight: '75vh', backgroundColor: '#f8f9fb' }}>
          <div className="px-1 px-md-2">
            {(activeChat?.messages ?? []).map((m: any, index: number) => {
              const ts = m.createdDate ?? m.dateTime ?? new Date().toISOString();
              const pretty = new Date(ts).toLocaleString(undefined, {
                hour: 'numeric',
                minute: '2-digit',
                hour12: true,
                month: 'short',
                day: 'numeric',
              });

              const isAgent = m.role === 'apiMessage';
              const bubbleClass = isAgent ? 'bg-white text-body' : 'bg-success text-white';

              return (
                <div
                  key={m.messageId ?? `${m.role}-${index}`}
                  className={`d-flex mb-3 ${isAgent ? 'justify-content-start' : 'justify-content-end'}`}>
                  <div
                    className={`p-3 rounded-4 shadow-sm ${bubbleClass}`}
                    style={{ maxWidth: '75%', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                    <div>{m.content}</div>
                    <small className={`d-block mt-2 ${isAgent ? 'text-muted' : 'text-white-50'}`}>{pretty}</small>
                  </div>
                </div>
              );
            })}
          </div>
        </Modal.Body>
      </Modal>
    </>
  );
}
