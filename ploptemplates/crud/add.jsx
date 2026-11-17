import { useLoaderData, useActionData, Form, Link, useFetcher } from "@remix-run/react";
import { redirect, json } from "@remix-run/node";
import SubmitButton from "~/components/ui/SubmitBtn";
//import FormView from "~/components/banks/Form";
import DisplayActionResponse from "~/components/ui/DisplayActionResponse";
import { getUserFromSession, requireUserSession } from "~/utils/auth.server";
import { {{pascalCase name}}, {{pascalCase name}} as Model } from "~/models/{{formatModelName name}}";
const moment = require("moment-timezone");

export async function loader({ request, params }) {
  await requireUserSession(request);
  let user = await getUserFromSession(request);

  return { user };
}

//add action
export async function action({ request, params }) {
  const user = await getUserFromSession(request); // Check if user is logged in
  if (!user) return redirect(`/login`); // redirect to login page if not logged in
  let { name, ...values } = Object.fromEntries(await request.formData());
  name = name.trim();


  let dataExists = await Model.findOne({ name: name });
  if (dataExists) return json({ messages: ["Record already exists."], status: "ERROR" });

  if (name == "") return json({ messages: ["Name is required."], status: "ERROR" });

  const data = {
    name: name,
    addedBy: user._id
  };

  let saveResponse = await Model.create(data);
  if (!saveResponse) return json({ messages: ["Unable to save record."], status: "ERROR" });
  return redirect(`/{{name}}`);
}

export default function Index() {
  const { user } = useLoaderData();
  const actionResponse = useActionData();

  return (
    <>
      <div className="container-fluid">
        <from>
          <div className="row">
            <div className="col-lg-12 col-md-12 col-12">
              {/* Page header */}
              <div className="mb-5">
                <h3 className="mb-0 ">Add {{dashWithSpace name}}</h3>
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
                      <div>
                        <Form method="post">
                          <div className="mb-3">
                            <label htmlFor="name" className="col-form-label">
                              Name:
                            </label>
                            <input required type="text" className="form-control" name="name" id="name" />

                            <div className="d-grid d-flex justify-content-between ">
                              <div className="w-40 py-3  ">
                                <SubmitButton className="btn btn-primary" />

                                <Link className="btn btn-primary ms-3" to="../">
                                  Cancel
                                </Link>
                              </div>
                            </div>

                            <input type="hidden" name="_id" value="" />
                          </div>
                        </Form>
                      </div>
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
