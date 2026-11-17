import { useLoaderData, useFetcher, useActionData } from '@remix-run/react';
import { Link } from '@remix-run/react';
import DisplayActionResponse from '~/components/ui/DisplayActionResponse';
import { useEffect } from 'react';
import { getUserFromSession, requireUserSession } from '~/utils/auth.server';
import { User } from '~/models/user';
import { assignFreePlanToUser } from '~/utils/plans';

import FormView from './Form';
import {
  redirect,
  json,
  unstable_parseMultipartFormData as parseMultipartFormData,
  unstable_createMemoryUploadHandler as createMemoryUploadHandler,
  unstable_composeUploadHandlers as composeUploadHandlers,
} from '@remix-run/node';
import { s3UploadHandler } from '~/utils/storage';

export async function loader({ request }) {
  let user = await getUserFromSession(request);
  if (!user) return redirect('/login');
  //const AWSS3_BUCKET_FILES = process.env.AWSS3_BUCKET_FILES;

  return { user };
}

export async function action({ request, params }) {
  const user = await getUserFromSession(request);
  if (!user) return redirect(`/login`);
  const DEFAULT_PASSWORD = process.env.DEFAULT_PASSWORD;
  const formData = await request.formData();
  const { id, _action, ...values } = Object.fromEntries(formData);

  const courses = formData.getAll('courses');

  const emailExists = await User.findOne({ email: values.email }).lean();
  if (emailExists) return json({ messages: ['Email already exists.'], status: 'ERROR' });

  let data = {
    firstName: values.firstName,
    lastName: values.lastName,
    email: values.email,
    roles: ['CLIENT'],
    phone: values.phone,
    // password: DEFAULT_PASSWORD,
    dateOfJoining: values.dateOfJoining,
    image: 'avatar-fallback.jpg',
    password: values.password,
  };

  const saveResponse = await User.create(data);
  if (!saveResponse) return json({ messages: ['Unable to save data.'], status: 'ERROR' });

  // Assign FREE plan to new user created by admin
  try {
    await assignFreePlanToUser(saveResponse._id, user._id);
  } catch (planError) {
    console.error('Failed to assign free plan:', planError);
    // Don't fail user creation if plan assignment fails - user is already saved
  }

  return redirect(`/portal/clients`);
}

export default function Index() {
  const { data } = useLoaderData();
  const actionResponse = useActionData();
  const fetcher = useFetcher();

  return (
    <>
      <div className="row">
        <div className="col-lg-12 col-md-12 col-12">
          {/* Page header */}
          <div className="d-flex justify-content-between align-items-center mb-5">
            <div className="mb-2 mb-lg-0">
              <h3 className="mb-0  text-white">Add Client</h3>
            </div>
          </div>
        </div>
      </div>

      <div className="row ">
        <div className="col-xl-12 col-12 mb-5">
          {/* card  */}
          <div className="card">
            {/* card header  */}

            {/* table  */}
            <div className="card-body">
              <FormView />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
