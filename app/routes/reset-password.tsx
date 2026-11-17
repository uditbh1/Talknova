import { useActionData, Form, useNavigation, useLoaderData } from '@remix-run/react';
import FrontLayout from '~/components/FrontLayout';
import { useState } from 'react';
import { redirect, json } from '@remix-run/node';
import { getUserFromSession } from '~/utils/auth.server';
import { User } from '~/models/user';
import { sendPasswordResetEmail } from '~/utils/email.server';
import { randomBytes } from 'crypto';
import { frontendLinks } from '~/utils/frontend-links';

export const links = frontendLinks;

const SITENAME = process.env.SITENAME;

export async function loader({ request }) {
  let user = await getUserFromSession(request);
  if (user) return redirect('/portal');

  return { user: null, SITENAME };
}

export async function action({ request }) {
  try {
    const formData = await request.formData();
    const emailInput = formData.get('email');
    
    if (!emailInput) {
      return json({
        messages: ['Email is required.'],
        status: 'ERROR',
      });
    }

    const email = emailInput.toString().trim().toLowerCase();

    // Basic email validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return json({
        messages: ['Please enter a valid email address.'],
        status: 'ERROR',
      });
    }

    // Find user by email
    const foundUser = await User.findOne({ 
      email: email,
      $or: [{ status: 1 }, { status: true }]
    });

    const successMessage = 'If this email is registered, you will receive a password reset email shortly.';

    if (!foundUser) {
      console.log('Password reset requested for non-existent email:', email);
      return json({
        messages: [successMessage],
        status: 'SUCCESS',
      });
    }

    // Generate new random password
    const newPassword = randomBytes(8).toString('hex') + 'A1!';

    // Update password using save() to trigger middleware
    foundUser.password = newPassword;
    await foundUser.save();

    // Send password reset email
    const emailSent = await sendPasswordResetEmail(foundUser, newPassword);

    if (!emailSent) {
      return json({
        messages: ['Failed to send password reset email. Please try again.'],
        status: 'ERROR',
      });
    }

    return json({
      messages: [successMessage],
      status: 'SUCCESS',
    });

  } catch (error) {
    console.error('Password reset error:', error);
    return json({
      messages: ['An error occurred. Please try again.'],
      status: 'ERROR',
    });
  }
}

export default function ResetPasswordPage() {
  const { SITENAME } = useLoaderData();
  const actionData = useActionData();
  const navigation = useNavigation();
  const [email, setEmail] = useState('');
  const isSubmitting = navigation.state === 'submitting';

  return (
    <FrontLayout>
      <div className="main-content">
        <section className="py-5">
          <div className="container">
            <div className="row justify-content-center">
              <div className="col-lg-6">
                <div className="card shadow">
                  <div className="card-body p-5">
                    <div className="text-center mb-4">
                      <h2 className="card-title">Reset Password</h2>
                      <p className="text-muted">
                        Enter your email address and we'll send you a new password.
                      </p>
                    </div>

                    {actionData?.status === 'SUCCESS' ? (
                      <div className="text-center">
                        <div className="alert alert-success" role="alert">
                          <i className="fas fa-envelope-circle-check fa-2x mb-3"></i>
                          <h5>Check Your Email!</h5>
                          <p className="mb-3">{actionData.messages[0]}</p>
                          <p className="small text-muted">
                            If you don't see the email, check your spam folder.
                          </p>
                        </div>
                        <div className="mt-4">
                          <a href="/login" className="document-btn">
                            Back to Login
                          </a>
                        </div>
                      </div>
                    ) : (
                      <>
                        {actionData?.status === 'ERROR' && (
                          <div className="alert alert-danger" role="alert">
                            {actionData.messages?.map((msg, idx) => (
                              <div key={idx}>{msg}</div>
                            ))}
                          </div>
                        )}

                        <Form method="post">
                          <div className="mb-4">
                            <label htmlFor="email" className="form-label">
                              Email Address
                            </label>
                            <input
                              type="email"
                              className="form-control form-control-lg"
                              id="email"
                              name="email"
                              value={email}
                              onChange={(e) => setEmail(e.target.value)}
                              placeholder="Enter your email address"
                              required
                              disabled={isSubmitting}
                            />
                          </div>

                          <div className="col-lg-12 mt-3 mb-3">
                            <button
                              type="submit"
                              className="document-btn"
                              disabled={isSubmitting}
                            >
                              {isSubmitting ? (
                                <>
                                  <span className="spinner-border spinner-border-sm me-2"></span>
                                  Sending Reset Email...
                                </>
                              ) : (
                                <>
                                  <i className="fas fa-paper-plane me-2"></i>
                                  Send Reset Email
                                </>
                              )}
                            </button>
                          </div>
                        </Form>

                        <div className="text-center">
                          <hr className="my-4" />
                          <p className="text-muted small">
                            Remember your password?{' '}
                            <a href="/login" className="text-decoration-none">
                              Sign in here
                            </a>
                          </p>
                          <p className="text-muted small">
                            Or try{' '}
                            <a href="/magic-link" className="text-decoration-none">
                              Magic Link Login
                            </a>
                          </p>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </FrontLayout>
  );
}