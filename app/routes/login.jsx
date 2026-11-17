import { useFetcher, useActionData, Form, Link } from '@remix-run/react';
import FrontLayout from '~/components/FrontLayout';
import { loginValidator } from '~/utils/validators';
import { redirect } from '@remix-run/node';
import { getUserFromSession, createUserSession, login } from '~/utils/auth.server';
import { User } from '~/models/user';

export async function loader({ request }) {
  const user = await getUserFromSession(request);
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

  return { user };
}

//form actions
export async function action({ request }) {
  const formPayload = Object.fromEntries(await request.formData());

  const validationResult = await loginValidator(formPayload, true);
  if (!validationResult.status) return { errors: validationResult.errors };

  const credentials = {
    email: formPayload.email,
    password: formPayload.password,
  };

  const response = await login(credentials);
  console.log('response', response);

  if (response.status === 200) {
    const redirectUrl = '/portal';
    return createUserSession(response.user, redirectUrl);
  }

  return { error: response.message, code: response.code, email: response.email };
}

const LoginPage = () => {
  const actionData = useActionData();
  const resendFetcher = useFetcher();
  const isSendingVerification = resendFetcher.state !== 'idle';
  const resendMessage = resendFetcher.data?.message;

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
                      {actionData?.error && (
                        <div className={`alert ${actionData.code === 'EMAIL_NOT_VERIFIED' ? 'alert-warning' : 'alert-danger'}`} role="alert">
                          <div>{actionData.error}</div>
                          {actionData.code === 'EMAIL_NOT_VERIFIED' && (
                            <div className="mt-3">
                              <p className="mb-2">Resend the verification email to continue.</p>
                              <resendFetcher.Form method="post" action="/api/send-email-verification" className="d-flex flex-column flex-sm-row gap-2">
                                <input type="hidden" name="email" value={actionData.email || ''} />
                                <button type="submit" className="btn btn-outline-primary" disabled={!actionData.email || isSendingVerification}>
                                  {isSendingVerification ? 'Sending…' : 'Send verification email'}
                                </button>
                              </resendFetcher.Form>
                              {resendMessage && <p className="small text-muted mt-2 mb-0">{resendMessage}</p>}
                            </div>
                          )}
                        </div>
                      )}
                      <div className="row">
                        <div className="col-lg-12 mb-3">
                          <label className="form-label" htmlFor="login-email">
                            User Name
                          </label>
                          <input type="text" id="login-email" className="form-control" name="email" required defaultValue="" />
                        </div>
                        <div className="col-lg-12 mb-3">
                          <label className="form-label" htmlFor="login-password">
                            Password
                          </label>
                          <input type="password" id="login-password" className="form-control" name="password" required defaultValue="" />
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
                  Don&apos;t have an account? <Link to="/register">Sign Up</Link>
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
