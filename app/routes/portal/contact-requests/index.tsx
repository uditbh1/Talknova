import { useLoaderData, useFetcher, useActionData } from '@remix-run/react';
import { redirect, json } from '@remix-run/node';
import { Link } from '@remix-run/react';
import DisplayActionResponse from '~/components/ui/DisplayActionResponse';
import NoDataTable from '~/components/ui/NoDataTable';
import { useEffect } from 'react';
import { GetDemoForm } from '~/models/getdemo';
import { ContactUsModel } from '~/models/contact';
import { getUserFromSession, requireUserSession } from '~/utils/auth.server';

export async function loader({ request }) {
  let user = await getUserFromSession(request);
  if (!user) return redirect('/login');

  const data = await ContactUsModel.find();

  return { user, data };
}

export async function action({ request, params }) {
  const user = await getUserFromSession(request); // Check if user is logged in
  if (!user) return redirect(`/login`); // redirect to login page if not logged in
  const { id, _action, ...values } = Object.fromEntries(await request.formData());

  if (_action == 'TOGGLE_BANK' && id) {
    let data = await Course.findById(id);
    if (data) {
      //toggle sourceCurrency field
      data.status = !data.status;
      let saveResponse = await data.save();
    }
    return json({ messages: ['Course updated successfully'], status: 'OK' });
  }
}

export default function Index() {
  const { user, data } = useLoaderData();
  const actionResponse = useActionData();
  const fetcher = useFetcher();

  useEffect(() => {
    if (data.length > 0) $('#tbl-listing').DataTable({ destroy: true });
    feather.replace();
  }, [data]);

  const toggleStatus = id => async e => {
    e.preventDefault();
    fetcher.submit({ id, _action: 'TOGGLE_BANK' }, { method: 'post' });
  };

  return (
    <>
      <div className="row">
        <div className="col-lg-12 col-md-12 col-12">
          {/* Page header */}
          <div className="d-flex justify-content-between align-items-center mb-5">
            <div className="mb-2 mb-lg-0">
              <h3 className="mb-0  text-white">Contact Requests</h3>
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
                  <h4 className="mb-0">Contact Requests</h4>
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
                      <th>Company</th>
                      <th>Messsage</th>
                      <th>Added On</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.map(d => (
                      <tr key={d._id}>
                        <td>{d.name}</td>
                        <td>{d.email}</td>
                        <td>{d.phone}</td>
                        <td>{d.company}</td>
                        <td>{d.message}</td>
                        <td>{new Date(d.createdAt).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                  <NoDataTable data={data} />
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
