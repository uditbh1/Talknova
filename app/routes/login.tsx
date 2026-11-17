import { useLoaderData, useFetcher, useActionData, Form } from '@remix-run/react';
import FrontLayout from '~/components/FrontLayout';
import { useEffect, useState } from 'react';
import { loginValidator } from '~/utils/validators';
import { Link } from '@remix-run/react';
import { redirect, json } from '@remix-run/node';
import { getUserFromSession, createUserSession, login } from '~/utils/auth.server';
import { User } from '~/models/user';
const defaultPassword = 'Member@123!';
const SITENAME = process.env.SITENAME;

import { frontendLinks } from '~/utils/frontend-links';
export const links = frontendLinks;

export async function loader({ request, params }) {
  let user = await getUserFromSession(request);
  console.log('user', user);
  if (user) return redirect('/portal');

  console.log('Creating super admin user');

  //create a SUPER ADMIN user if not exists
  let superAdmin = await User.findOne({ email: 'admin@klaspad.com' });
  if (!superAdmin) {
    superAdmin = await User.create({
      email: 'admin@klaspad.com',
      password: 'admin@123!',
      roles: 'SUPER_ADMIN',
      firstName: 'Super',
      lastName: 'Admin',
      emailVerified: true,
      status: 1,
    });
  }

  // Check for query parameters
  const url = new URL(request.url);
  const verified = url.searchParams.get('verified') === 'true';
  const paymentSuccess = url.searchParams.get('payment') === 'success';

  return { user, SITENAME, verified, paymentSuccess };
}

//form actions
export async function action({ request, context }) {
  const formPayload = Object.fromEntries(await request.formData());
  const password = formPayload.password;

  let validationResult = await loginValidator(formPayload, true);
  if (!validationResult.status) return { errors: validationResult.errors };

  let response = await login(formPayload);
  console.log('response', response);

  if (response.status === 200) {
    let redirectUrl = '/portal';
    const showWelcomePopup = response.showWelcomePopup || false;

    return createUserSession(response.user, redirectUrl, showWelcomePopup);
  }

  return { error: response.message };
}

const LoginPage = () => {
  const { user, verified, paymentSuccess } = useLoaderData();
  const actionData = useActionData();

  return (
    <FrontLayout>
      <section className="contact-container">
        <div className="container">
          <div className="document-block">
            <div className="row d-grid d-flex justify-content-center">
              <div className="col-lg-8 col-md-8 col-sm-12 col-xs-12">
                <Form method="post" className="login" data-discover="true">
                  <h3>Log in</h3>
                  <div className="card">
                    <div className="card-body">
                      {verified && (
                        <div className="alert alert-success" role="alert">
                          Email verified. Check your email for login password.
                        </div>
                      )}
                      {paymentSuccess && (
                        <div className="alert alert-success" role="alert">
                          Payment successful! Check your email for login password.
                        </div>
                      )}
                      {actionData && actionData.error && <p className="alert alert-danger">{actionData.error}</p>}
                      <div className="row">
                        <div className="col-lg-12 mb-3">
                          <label className="form-label">User Name</label>
                          <input type="text" className="form-control" name="email" required defaultValue="" />
                        </div>
                        <div className="col-lg-12 mb-3">
                          <label className="form-label">Password</label>
                          <input type="password" className="form-control" name="password" required defaultValue="" />
                        </div>
                        <Link to="/forgot-password">Forgot password?</Link>
                        <div className="col-lg-12 mt-3 mb-3">
                          <button type="submit" className="document-btn">
                            Log in
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </Form>
                <br />
                <p>
                  Don't have an account? <Link to="/register">Sign Up</Link>
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </FrontLayout>
  );
};

export default LoginPage;
