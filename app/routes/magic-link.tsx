import { json, redirect } from '@remix-run/node';
import { Form, useActionData, useNavigation, useLoaderData } from '@remix-run/react';
import { useState } from 'react';
import jwt from 'jsonwebtoken';
import FrontLayout from '~/components/FrontLayout';
import { User } from '~/models/user';
import { sendMagicLinkEmail } from '~/utils/email.server';
import { getUserFromSession } from '~/utils/auth.server';
import { frontendLinks } from '~/utils/frontend-links';

export const links = frontendLinks;

const SITENAME = process.env.SITENAME;

export async function loader({ request }) {
  let user = await getUserFromSession(request);
  if (user) return redirect('/portal');

  return { user, SITENAME };
}

export async function action({ request }) {
  const formData = await request.formData();
  const email = formData.get('email').toString().trim().toLowerCase();

  if (!email) {
    return json({
      messages: ['Email is required.'],
      status: 'ERROR',
    });
  }

  // Basic email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return json({
      messages: ['Please enter a valid email address.'],
      status: 'ERROR',
    });
  }

  try {
    // Find user by email
    const user = await User.findOne({ email, status: true });

    // For security, we return success even if user doesn't exist
    // to avoid email enumeration attacks
    if (!user) {
      console.log('Magic link requested for non-existent email:', email);
      return json({
        messages: ['If this email is registered, you will receive a magic link shortly.'],
        status: 'SUCCESS',
      });
    }

    // Generate JWT token with 5-minute expiry
    const jwtSecret = process.env.JWT_SECRET || 'your-secret-key';
    const token = jwt.sign(
      {
        userId: user._id.toString(),
        email: user.email,
        type: 'magic_link',
      },
      jwtSecret,
      { expiresIn: '5m' }
    );

    // Store token in database
    await User.findByIdAndUpdate(user._id, {
      magicLinkToken: token,
      magicLinkExpiry: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
    });

    // Create magic link URL
    const magicLink = `${process.env.SITE_URL}magic-link/verify?token=${token}`;

    // Send email
    const emailSent = await sendMagicLinkEmail(email, magicLink);

    if (!emailSent) {
      return json({
        messages: ['Failed to send magic link. Please try again.'],
        status: 'ERROR',
      });
    }

    return json({
      messages: ['If this email is registered, you will receive a magic link shortly.'],
      status: 'SUCCESS',
    });
  } catch (error) {
    console.error('Magic link error:', error);
    return json({
      messages: ['An error occurred. Please try again.'],
      status: 'ERROR',
    });
  }
}

export default function MagicLink() {
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
                      <h2 className="card-title">Magic Link Login</h2>
                      <p className="text-muted">Enter your email to receive a secure login link</p>
                    </div>

                    {actionData?.status === 'SUCCESS' ? (
                      <div className="text-center">
                        <div className="alert alert-success" role="alert">
                          <i className="fas fa-envelope-circle-check fa-2x mb-3"></i>
                          <h5>Check Your Email!</h5>
                          <p className="mb-3">{actionData.messages[0]}</p>
                          <p className="small text-muted">The magic link will expire in 5 minutes for security.</p>
                        </div>
                        <div className="mt-4">
                          <a href="/login" className="document-btn me-2" style={{ display: 'inline-block' }}>
                            Back to Login
                          </a>
                          <button type="button" onClick={() => window.location.reload()} className="document-btn">
                            Send Another Link
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        {actionData?.status === 'ERROR' && (
                          <div className="alert alert-danger" role="alert">
                            {actionData.messages.map((msg, idx) => (
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
                              onChange={e => setEmail(e.target.value)}
                              placeholder="Enter your email address"
                              required
                              disabled={isSubmitting}
                            />
                          </div>

                          <div className="col-lg-12 mt-3 mb-3">
                            <button type="submit" className="document-btn" disabled={isSubmitting}>
                              {isSubmitting ? (
                                <>
                                  <span className="spinner-border spinner-border-sm me-2"></span>
                                  Sending Magic Link...
                                </>
                              ) : (
                                <>Send Magic Link</>
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
