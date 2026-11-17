import { useLoaderData, useFetcher, useActionData } from '@remix-run/react';
import { redirect, json } from '@remix-run/node';
import { Link } from '@remix-run/react';
import DisplayActionResponse from '~/components/ui/DisplayActionResponse';
import NoDataTable from '~/components/ui/NoDataTable';
import { useEffect } from 'react';
import { EmailTemplate } from '~/models/emailtemplate';
import { getUserFromSession, requireUserSession } from '~/utils/auth.server';
import TestEmailModal from './TestEmailModal';
import { sendTestEmail } from '~/utils/email.server';

export async function loader({ request }) {
  await requireUserSession(request);
  let user = await getUserFromSession(request);
  if (!user) return redirect('/login');

  let templates = await EmailTemplate.find().sort({ createdAt: -1 }).lean();

  return { user, templates };
}

export async function action({ request }) {
  const user = await getUserFromSession(request);
  if (!user) return redirect(`/login`);

  const formData = await request.formData();
  const { _action, templateId, recipient } = Object.fromEntries(formData);

  // Handle status toggle
  if (_action === 'TOGGLE_STATUS' && templateId) {
    try {
      const template = await EmailTemplate.findById(templateId);
      if (template) {
        template.status = !template.status;
        await template.save();
      }
      return json({ messages: ['Status updated successfully'], status: 'OK' });
    } catch (error) {
      return json({ messages: ['Error updating status'], status: 'ERROR' });
    }
  }

  // Handle test email
  if (_action === 'TEST_EMAIL' && templateId && recipient) {
    const template = await EmailTemplate.findById(templateId).lean();

    if (!template) {
      return json({ messages: ['Template not found'], status: 'ERROR' });
    }

    try {
      const result = await sendTestEmail(recipient, template.subject, template.body);

      if (result) {
        return json({ messages: ['Test email sent successfully'], status: 'OK' });
      } else {
        return json({ messages: ['Failed to send test email'], status: 'ERROR' });
      }
    } catch (error) {
      console.error('Error sending test email:', error);
      return json({
        messages: ['Error sending test email: ' + error.message],
        status: 'ERROR',
      });
    }
  }

  return json({ messages: ['Invalid action'], status: 'ERROR' });
}

export default function Index() {
  const { user, templates } = useLoaderData();
  const actionResponse = useActionData();
  const fetcher = useFetcher();

  useEffect(() => {
    if (Array.isArray(templates) && templates.length > 0) {
      $('#tbl-listing').DataTable({ destroy: true, ordering: false });
      feather.replace();
    }
  }, [templates]);

  const toggleStatus = id => e => {
    e.preventDefault();
    fetcher.submit({ templateId: id, _action: 'TOGGLE_STATUS' }, { method: 'post' });
  };

  return (
    <>
      <div className="row">
        <div className="col-lg-12 col-md-12 col-12">
          {/* Page header */}
          <div className="d-flex justify-content-between align-items-center mb-5">
            <div className="mb-2 mb-lg-0">
              <h3 className="mb-0 text-white">Email Templates</h3>
            </div>
            <div>
              <Link className="btn btn-white" to="./add" prefetch="intent">
                Add New Template
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="row">
        <div className="col-xl-12 col-12 mb-5">
          {/* Display action response messages */}
          {actionResponse && <DisplayActionResponse actionResponse={actionResponse} />}

          {/* card  */}
          <div className="card">
            {/* card header  */}
            <div className="card-header">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <h4 className="mb-0">Email Templates List</h4>
                </div>
                <div>
                  <form action="#">
                    <div className="input-group">
                      <input className="form-control rounded-3" type="search" id="searchInput" placeholder="Search" />
                      <span className="input-group-append">
                        <button className="btn ms-n10 rounded-0 rounded-end" type="button">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width={15}
                            height={15}
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth={2}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="feather feather-search text-dark">
                            <circle cx={11} cy={11} r={8} />
                            <line x1={21} y1={21} x2="16.65" y2="16.65" />
                          </svg>
                        </button>
                      </span>
                    </div>
                  </form>
                </div>
              </div>
            </div>

            {/* table  */}
            <div className="card-body">
              <div className="table-responsive table-card">
                <table className="table text-nowrap mb-0 table-centered table-hover" id="tbl-listing">
                  <thead className="table-light">
                    <tr>
                      <th>Template Name</th>
                      <th>Unique ID</th>
                      <th>Subject</th>
                      <th>Created On</th>
                      <th>Status</th>
                      <th>Options</th>
                    </tr>
                  </thead>
                  <tbody>
                    {templates &&
                      templates.length > 0 &&
                      templates.map(template => (
                        <tr key={template._id}>
                          <td>{template.name}</td>
                          <td>{template.uniqueId}</td>
                          <td>{template.subject}</td>
                          <td>{new Date(template.createdAt).toLocaleString()}</td>
                          <td>
                            <a href="#" onClick={toggleStatus(template._id)} className="text-muted">
                              {template.status ? <span className="badge badge-success-soft">Active</span> : <span className="badge badge-danger-soft">Inactive</span>}
                            </a>
                          </td>
                          <td>
                            <Link to={`/portal/email-templates/${template._id}`} className="btn btn-ghost btn-icon btn-sm rounded-circle texttooltip" data-template="editTemplate">
                              <i data-feather="edit" className="icon-xs" />
                              <div id="editTemplate" className="d-none">
                                <span>Edit</span>
                              </div>
                            </Link>

                            <button
                              type="button"
                              className="btn btn-ghost btn-icon btn-sm rounded-circle texttooltip"
                              data-bs-toggle="modal"
                              data-bs-target={`#testEmailModal-${template._id}`}
                              data-template="testTemplate">
                              <i data-feather="mail" className="icon-xs" />
                              <div id="testTemplate" className="d-none">
                                <span>Test Send</span>
                              </div>
                            </button>

                            {/* Test Email Modal for this template */}
                            <TestEmailModal templateId={template._id} templateName={template.name} templateSubject={template.subject} templateBody={template.body} />
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
                <NoDataTable data={templates} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
