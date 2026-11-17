import { useLoaderData, useFetcher, useActionData } from '@remix-run/react';
import { redirect, json } from '@remix-run/node';
import { Link } from '@remix-run/react';
import DisplayActionResponse from '~/components/ui/DisplayActionResponse';
import NoDataTable from '~/components/ui/NoDataTable';
import { useEffect } from 'react';
import { User } from '~/models/user';

import { getUserFromSession, requireUserSession } from '~/utils/auth.server';

export async function loader({ request }) {
  let user = await getUserFromSession(request);
  if (!user) return redirect('/login');
  const roles = user.roles || [];

  let clients = await User.find({ roles: { $in: ['CLIENT'] } })
    .sort({ createdAt: -1 })
    .lean();

  console.log(clients);

  return { user, clients };
}

export async function action({ request, params }) {
  const user = await getUserFromSession(request); // Check if user is logged in
  if (!user) return redirect(`/login`); // redirect to login page if not logged in
  const { id, _action, ...values } = Object.fromEntries(await request.formData());

  if (_action == 'TOGGLE_STATUS' && id) {
    let data = await User.findById(id);
    if (data) {
      //toggle Status field
      data.status = !data.status;
      let saveResponse = await data.save();
    }
    return json({ messages: ['Status updated successfully'], status: 'OK' });
  }
}

export default function Index() {
  const { user, clients } = useLoaderData();
  const actionResponse = useActionData();
  const fetcher = useFetcher();

  useEffect(() => {
    if (Array.isArray(clients) && clients.length > 0) {
      //$('#tbl-listing').DataTable({ destroy: true, ordering: false });
      //feather.replace();
    }
  }, [clients]);

  const toggleStatus = id => async e => {
    e.preventDefault();
    fetcher.submit({ id, _action: 'TOGGLE_STATUS' }, { method: 'post' });
  };

  return (
    <>
      <div className="row">
        <div className="col-lg-12 col-md-12 col-12">
          {/* Page header */}
          <div className="d-flex justify-content-between align-items-center mb-5">
            <div className="mb-2 mb-lg-0">
              <h3 className="mb-0  text-white">Clients</h3>
            </div>
            <div>
              <Link className="btn btn-white" to="./add" prefetch="intent">
                Add
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="row ">
        <div className="col-xl-12 col-12 mb-5">
          {/* card  */}
          <div className="card">
            {/* card header  */}
            <div className="card-header ">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <h4 className="mb-0">Clients List</h4>
                </div>
                <div>
                  <form action="#">
                    <div className="input-group ">
                      <input className="form-control rounded-3" type="search" defaultValue="" id="searchInput" placeholder="Search" />
                      <span className="input-group-append">
                        <button className="btn  ms-n10 rounded-0 rounded-end" type="button">
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
                      <th>Name</th>
                      <th>Email</th>
                      <th>Phone</th>
                      <th>Added On</th>
                      <th>Status</th>
                      <th>Options</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clients &&
                      clients.length > 0 &&
                      clients.map(clients => (
                        <tr key={clients._id}>
                          <td>{`${clients.firstName} ${clients.lastName}`}</td>
                          <td>{clients.email}</td>
                          <td>{clients.phone}</td>
                          <td>{new Date(clients.createdAt).toLocaleString()}</td>

                          <td>
                            <a href="javascript:void(0);" onClick={toggleStatus(clients._id)} className="text-muted">
                              {clients.status ? <span className="badge badge-success-soft">Active</span> : <span className="badge badge-danger-soft">Inactive</span>}
                            </a>
                          </td>

                          <td>
                            <Link to={`/portal/clients/${clients._id}`} className="btn btn-ghost btn-icon btn-sm rounded-circle texttooltip" data-template="editOne">
                              <i data-feather="edit" className="icon-xs" />
                              <div id="editOne" className="d-none">
                                <span>Edit</span>
                              </div>
                            </Link>

                            <Link to={`/portal/clients/${clients._id}/plans`} className="btn btn-ghost btn-icon btn-sm rounded-circle texttooltip" data-template="planOne">
                              <i data-feather="package" className="icon-xs" />
                              <div id="planOne" className="d-none">
                                <span>Manage Plans</span>
                              </div>
                            </Link>

                            <Link to={`/portal/chatagents`} className="btn btn-ghost btn-icon btn-sm rounded-circle texttooltip" data-template="settingsOne">
                              <i data-feather="settings" className="icon-xs" />
                              <div id="settingsOne" className="d-none">
                                <span>Chatbot Settings</span>
                              </div>
                            </Link>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                  <NoDataTable data={clients} />
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
