import { Outlet, useActionData, useLoaderData, Form } from '@remix-run/react';
import { redirect, json } from '@remix-run/node';
import { login, createUserSession, getUserFromSession } from '~/utils/auth.server';
import { loginValidator } from '~/utils/validators';
import { User } from '~/models/user';
const defaultPassword = 'Member@123!';
const SITENAME = process.env.SITENAME;

export async function loader({ request, params }) {
  let user = await getUserFromSession(request);
  console.log('user', user);
  if (user) return redirect('/');

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

  return { user, SITENAME };
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
    let redirectUrl = '/';
    const showWelcomePopup = response.showWelcomePopup || false;

    return createUserSession(response.user, redirectUrl, showWelcomePopup);
  }

  return { error: response.message };
}

export default function Login() {
  const data = useActionData();
  const { SITENAME } = useLoaderData();

  return (
    <>
      <div>
        {/*header*/}
        {/* Required meta tags */}
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        <meta name="author" content="Codescandy" />
        {/* Favicon icon*/}
        <link rel="shortcut icon" type="image/x-icon" href="/assets/images/favicon/favicon.png" />
        {/* Libs CSS */}
        <link href="/assets/libs/bootstrap-icons/font/bootstrap-icons.css" rel="stylesheet" />
        <link href="/assets/libs/@mdi/font/css/materialdesignicons.min.css" rel="stylesheet" />
        <link href="https://cdn.jsdelivr.net/npm/simplebar@latest/dist/simplebar.min.css" rel="stylesheet" />
        {/* Theme CSS */}
        <link rel="stylesheet" href="/assets/css/theme.min.css" />
        <link rel="stylesheet" href="/assets/css/style.css" />
        <link href="/assets/libs/datatables.net-bs5/css/dataTables.bootstrap5.min.css" rel="stylesheet" />
        <title>{SITENAME} | Login</title>
        <main id="main-wrapper" className="main-wrapper">
          <main className="container d-flex flex-column">
            <div
              className="row align-items-center justify-content-center g-0
  min-vh-100">
              <div className="col-12 col-md-8 col-lg-6 col-xxl-4 py-8 py-xl-0">
                <div className="card smooth-shadow-md">
                  <div className="card-body p-6">
                    <div className="mb-4">
                      <a href="#">
                        <img src="/assets/images/brand/logo/logo.png" className="mb-2 w-50 text-inverse" alt="Image" />
                      </a>
                      <p className="mb-6">Please enter your user information.</p>
                    </div>
                    <Form method="post">
                      <div className="mb-3">
                        <label htmlFor="email" className="form-label">
                          Username or email
                        </label>
                        <input type="email" id="email" className="form-control" name="email" placeholder="Email address here" required />
                      </div>
                      <div className="mb-3">
                        <label htmlFor="password" className="form-label">
                          Password
                        </label>
                        <input type="password" id="password" className="form-control" name="password" placeholder="**************" required />
                      </div>
                      <div
                        className="d-lg-flex justify-content-between align-items-center
            mb-4"></div>
                      <div>
                        <div className="d-grid">
                          <button type="submit" className="btn btn-primary">
                            Sign in
                          </button>
                        </div>
                        <div className="d-md-flex justify-content-between mt-4">
                          {/*  <div className="mb-2 mb-md-0">
                            <a href="sign-up.html" className="fs-5">
                              Create An Account
                            </a>
                          </div> */}
                          <div>
                            <a href="forget-password.html" className="text-inherit fs-5">
                              Forgot your password?
                            </a>
                          </div>
                        </div>
                      </div>
                    </Form>
                  </div>
                </div>
              </div>
            </div>
          </main>
          {/*footer*/}
          {/* Scripts */}
          {/* Libs JS */}
          {/* Theme JS */}
          {/* popper js */}
          {/* tippy js */}
          {/*footer*/}
        </main>
      </div>
    </>
  );
}
