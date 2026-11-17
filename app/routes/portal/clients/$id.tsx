import { Outlet, useActionData, useLoaderData, Link, Form } from '@remix-run/react';
import FormView from './Form';
import { getUserFromSession, requireUserSession } from '~/utils/auth.server';
import { User } from '~/models/user';
import DisplayActionResponse from '~/components/ui/DisplayActionResponse';
import { Course } from '~/models/course';
import { UserCourse } from '~/models/usercourses';
import { redirect, json } from '@remix-run/node';
import pkg from 'bcryptjs';
const { hash, compare } = pkg;

export async function loader({ request, params }) {
  let user = await getUserFromSession(request);
  if (!user) return redirect('/login');
  const { id } = params;
  if (!id) throw new Error('Id not found');

  let data = await User.findById(id).lean();
  if (!data) throw new Error('Record not found');

  return { user, data };
}

export async function action({ request, params }) {
  const user = await getUserFromSession(request); // Check if user is logged in
  if (!user) return redirect(`/login`); // redirect to login page if not logged in

  const formData = await request.formData();
  let { _id, _action, email, ...values } = Object.fromEntries(formData);

  if (!_id) return json({ messages: ['Record not found'], status: 'ERROR' });
  email = email.trim();

  if (email == '') return json({ messages: ['Email is required.'], status: 'ERROR' });

  let data = await User.findById(_id);
  if (!data) return json({ status: 'ERROR', message: 'Record not found' }, { status: 404 });

  //check if name exists except for the current record
  let emailExists = await User.findOne({ email, _id: { $ne: _id } });
  if (emailExists) return json({ messages: ['Email already exists.'], status: 'ERROR' });
  const password = values.password ? values.password : '';

  let dataSave = {
    firstName: values.firstName,
    lastName: values.lastName,
    email: email,
    phone: values.phone,
  };

  if (password) {
    const hashedPassword = await hash(password, 10);
    dataSave.password = hashedPassword;
  }

  let saveResponse = await User.findByIdAndUpdate(_id, dataSave);
  if (!saveResponse) return json({ messages: ['Unable to save data.'], status: 'ERROR' });

  return redirect(`/portal/clients`);
}

export default function Index() {
  const { user, data } = useLoaderData();
  const actionResponse = useActionData();

  return (
    <>
      <div className="container-fluid">
        <div className="row">
          <div className="col-lg-12 col-md-12 col-12">
            {/* Page header */}
            <div className="mb-5">
              <h3 className="mb-0  text-white ">Update Client</h3>
            </div>
          </div>
        </div>
        <div>
          {/* row */}
          <div className="row">
            <div className="col-lg-12 col-12">
              <div className="card mb-4">
                <div className="card-body">
                  {actionResponse && actionResponse.status == 'ERROR' && <DisplayActionResponse actionResponse={actionResponse} />}
                  <div>
                    <FormView />
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
