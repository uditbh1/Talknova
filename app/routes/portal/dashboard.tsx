// app/routes/admin/dashboard.jsx
import AdminLayout from '~/components/Layout';
import { getUserFromSession } from '~/utils/auth.server';
import { redirect, json } from '@remix-run/node';

export async function loader({ request, params }) {
  let user = await getUserFromSession(request);
  if (!user) return redirect('/login');

  console.log('user', user);

  return { user };
}

const Dashboard = () => {
  return (
    <AdminLayout>
      <div className="row">
        <div className="col-lg-12 col-md-12 col-12">
          {/* Page header */}
          <div className="d-flex justify-content-between align-items-center mb-5">
            <div className="mb-2 mb-lg-0">
              <h3 className="mb-0  text-white">Courses</h3>
            </div>
            <div>
              <a href="add-course.php" className="btn btn-white">
                Add
              </a>
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
                  <h4 className="mb-0">Courses List</h4>
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
                <table className="table text-nowrap mb-0 table-centered table-hover">
                  <thead className="table-light">
                    <tr>
                      <th>Title</th>
                      <th>Group</th>
                      <th>Level</th>
                      <th>Type</th>
                      <th>Duration</th>
                      <th>Created by</th>
                      <th>View Modules</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>Qualifi Level 7 Diploma in Human Resource Management</td>
                      <td>Group</td>
                      <td>Level</td>
                      <td>Type</td>
                      <td>0 years, 3 months</td>
                      <td>BSBC Admin</td>
                      <td>
                        <a className="btn btn-primary" href="module-list.php">
                          Modules
                        </a>
                      </td>
                      <td>
                        <div className="d-flex justify-content-between align-items-center">
                          <div className="form-check form-switch">
                            <input className="form-check-input" type="checkbox" role="switch" id="flexSwitchStock" defaultChecked />
                          </div>
                          <a href="add-course.php" className="btn btn-ghost btn-icon btn-sm rounded-circle texttooltip" data-template="eyeOne">
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              width={24}
                              height={24}
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth={2}
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              className="feather feather-edit icon-xs">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                            </svg>
                            <div id="eyeOne" className="d-none">
                              <span>Edit</span>
                            </div>
                          </a>
                          <a href="#!" className="btn btn-ghost btn-icon btn-sm rounded-circle texttooltip" data-template="eye2">
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              width={24}
                              height={24}
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth={2}
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              className="feather feather-trash icon-xs">
                              <polyline points="3 6 5 6 21 6" />
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            </svg>
                            <div id="eye2" className="d-none">
                              <span>Delete</span>
                            </div>
                          </a>
                        </div>
                      </td>
                    </tr>
                    <tr>
                      <td>Qualifi Level 7 Diploma in Human Resource Management</td>
                      <td>Group</td>
                      <td>Level</td>
                      <td>Type</td>
                      <td>0 years, 3 months</td>
                      <td>BSBC Admin</td>
                      <td>
                        <a className="btn btn-primary" href="module-list.php">
                          Modules
                        </a>
                      </td>
                      <td>
                        <div className="d-flex justify-content-between align-items-center">
                          <div className="form-check form-switch">
                            <input className="form-check-input" type="checkbox" role="switch" id="flexSwitchStock" defaultChecked />
                          </div>
                          <a href="add-course.php" className="btn btn-ghost btn-icon btn-sm rounded-circle texttooltip" data-template="eyeOne">
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              width={24}
                              height={24}
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth={2}
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              className="feather feather-edit icon-xs">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                            </svg>
                            <div id="eyeOne" className="d-none">
                              <span>Edit</span>
                            </div>
                          </a>
                          <a href="#!" className="btn btn-ghost btn-icon btn-sm rounded-circle texttooltip" data-template="eye2">
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              width={24}
                              height={24}
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth={2}
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              className="feather feather-trash icon-xs">
                              <polyline points="3 6 5 6 21 6" />
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            </svg>
                            <div id="eye2" className="d-none">
                              <span>Delete</span>
                            </div>
                          </a>
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};

export default Dashboard;
