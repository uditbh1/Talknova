import { useLoaderData, useFetcher, useActionData } from "@remix-run/react";
import { json } from "@remix-run/node";
import { Link } from "@remix-run/react";
import DisplayActionResponse from "~/components/ui/DisplayActionResponse";
import { useEffect } from "react";
import { {{pascalCase name}}, {{pascalCase name}} as Model } from "~/models/{{formatModelName name}}";
import { getUserFromSession, requireUserSession } from "~/utils/auth.server";
import NoDataTable from "../../components/ui/NoDataTable";

export async function loader({ request, params }) {
  await requireUserSession(request);
  let user = await getUserFromSession(request);

  let data = await Model.find().populate("addedBy").lean();

  return { user, data };
}


export async function action({ request, params }) {
  const user = await getUserFromSession(request); // Check if user is logged in
  if (!user) return redirect(`/login`); // redirect to login page if not logged in
  const { id, _action, ...values } = Object.fromEntries(await request.formData());

  if (_action == "TOGGLE_STATUS" && id) {
    let data = await Model.findById(id);
    if (data) {
      //toggle Status field
      data.status = !data.status;
      let saveResponse = await data.save();
    }
    return json({ messages: ["Status updated successfully"], status: "OK" });
  }

}

export default function Index() {
  const { user, data } = useLoaderData();
  const actionResponse = useActionData();
  const fetcher = useFetcher();

  useEffect(() => {
    if (data.length > 0) $("#tbl-listing").DataTable({ destroy: true });
    feather.replace();
  }, [data]);


  const toggleStatus = (id) => async (e) => {
    e.preventDefault();
    fetcher.submit({ id, _action: "TOGGLE_STATUS" }, { method: "post" });
  };

  return (
    <>
      <div className="container-fluid">
        <div className="row">
          <div className="col-lg-12 col-md-12 col-12">
            {/* Page header */}
            <div className="mb-5">
              <h3 className="mb-0">{{dashWithSpace name}}</h3>
            </div>
          </div>
        </div>
        <div>
          {/* row */}
          <div className="row">
            <div className="col-12">
              <div className="card">
                <div className="card-header d-md-flex border-bottom-0">
                  <div className="flex-grow-1">
                    <Link className="btn btn-primary" to="./add">
                      + Add {{dashWithSpace name}}
                    </Link>
                  </div>
                </div>
                <div className="card-body">
                  {actionResponse && actionResponse.status == "ERROR" && <DisplayActionResponse actionResponse={actionResponse} />}
                  <div className="table-responsive table-card">
                    <table id="tbl-listing" className="table text-nowrap table-centered mt-0" >
                      <thead className="table-light">
                        <tr>
                          <th> Name</th>
                          <th>Added By</th>
                          <th>Status</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.map((item, index) => (
                          <tr>
                            <td> {item?.name}</td>
                            <td> {`${item?.addedBy?.firstName} ${item?.addedBy?.lastName}`}</td>

                            <td>
                              <a href="javascript:void(0);" onClick={toggleStatus(item._id)} className="text-muted">
                                {item.status ? <span className="badge badge-success-soft">Active</span> : <span className="badge badge-danger-soft">Inactive</span>}
                              </a>
                            </td>
                            <td>
                              <div>
                                <Link to={`./${item._id}`} className="btn btn-ghost btn-icon btn-sm rounded-circle texttooltip" data-template="editOne">
                                  <i data-feather="edit" className="nav-icon  icon-xs" />
                                </Link>
                              </div>
                            </td>
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
        </div>
      </div>
    </>
  );
}
