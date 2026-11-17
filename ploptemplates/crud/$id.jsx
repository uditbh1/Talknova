import { Outlet, useActionData, useLoaderData, Link, Form } from "@remix-run/react";
import { redirect, json } from "@remix-run/node";
//import FormView from "~/components/banks/Form";
import SubmitButton from "~/components/ui/SubmitBtn";
import { getUserFromSession, requireUserSession } from "~/utils/auth.server";
import { {{pascalCase name}}, {{pascalCase name}} as Model } from "~/models/{{formatModelName name}}";
import DisplayActionResponse from "~/components/ui/DisplayActionResponse";

export async function loader({ request, params }) {
  await requireUserSession(request);
  let user = await getUserFromSession(request);
  const { id } = params;
  if (!id) throw new Error("Id not found");

  let data = await Model.findById(id).lean();
  if (!data) throw new Error("Record not found");


  return { user, data };
}

export async function action({ request, params }) {
  const user = await getUserFromSession(request); // Check if user is logged in
  if (!user) return redirect(`/login`); // redirect to login page if not logged in

  let { name, _id, ...values } = Object.fromEntries(await request.formData());
  if (!_id) return json({ messages: ["Record not found"], status: "ERROR" });
  name = name.trim();

  if (name == "") return json({ messages: ["Name is required."], status: "ERROR" });

  let data = await Model.findById(_id);
  if (!data) return json({ status: "ERROR", message: "Record not found" }, { status: 404 });

  //check if name exists except for the current record
  let nameExists = await Model.findOne({ name: name, _id: { $ne: _id } });
  if (nameExists) return json({ messages: ["Data already exists."], status: "ERROR" });

  data.name = name;
  data.updatedBy = user._id;

  let saveResponse = await data.save();
  if (!saveResponse) return json({ messages: ["Unable to save data."], status: "ERROR" });

  return redirect(`/{{name}}`);
}

export default function Index() {
  const { user, data } = useLoaderData();
  const actionResponse = useActionData();

  return (
    <>
      <div className="container-fluid">
        <from>
          <div className="row">
            <div className="col-lg-12 col-md-12 col-12">
              {/* Page header */}
              <div className="mb-5">
                <h3 className="mb-0 ">Update {{dashWithSpace name}}</h3>
              </div>
            </div>
          </div>
          <div>
            {/* row */}
            <div className="row">
              <div className="col-lg-12 col-12">
                <div className="card mb-4">
                  <div className="card-body">
                    {actionResponse && actionResponse.status == "ERROR" && <DisplayActionResponse actionResponse={actionResponse} />}
                    <div>
                      <Form method="post">
                        <div className="mb-3">
                          <label htmlFor="name" className="col-form-label">
                            Name:
                          </label>
                          <input type="text" required className="form-control" name="name" id="name" defaultValue={data.name} />

                          <div className="d-grid d-flex justify-content-between ">
                            <div className="w-40 py-3  ">
                              <SubmitButton className="btn btn-primary" />

                              <Link className="btn btn-primary ms-3" to="../">
                                Cancel
                              </Link>
                            </div>
                          </div>

                          <input type="hidden" name="_id" value={data._id} />
                        </div>
                      </Form>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </from>
      </div>
    </>
  );
}
