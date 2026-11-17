import { json } from '@remix-run/node';
import { Form, useActionData, useLoaderData, useNavigation } from '@remix-run/react';
import { useState } from 'react';

import FrontLayout from '~/components/FrontLayout';
import { ForgotPassword } from '~/models/forgotpassword.server';
import { User } from '~/models/user';
import { frontendLinks } from '~/utils/frontend-links';

export const links = frontendLinks;

export async function loader({ params }) {
  const { token } = params;

  if (!token) {
    return json({ tokenStatus: 'INVALID', message: 'Missing password setup token.' });
  }

  const record = await ForgotPassword.findOne({ token }).populate('user_id');
  if (!record) {
    return json({ tokenStatus: 'INVALID', message: 'This password setup link is invalid or has already been used.' });
  }

  if (record.exp_date && record.exp_date < new Date()) {
    await ForgotPassword.deleteOne({ _id: record._id });
    return json({ tokenStatus: 'INVALID', message: 'This password setup link has expired.' });
  }

  return json({ tokenStatus: 'VALID', email: record.user_id?.email || '' });
}

export async function action({ request, params }) {
  const { token } = params;
  const formData = await request.formData();
  const password = formData.get('password')?.toString() || '';
  const confirmPassword = formData.get('confirmPassword')?.toString() || '';

  const errors = [];
  if (!password || password.length < 6) {
    errors.push('Password must be at least 6 characters long.');
  }
  if (password !== confirmPassword) {
    errors.push('Passwords do not match.');
  }
  if (!token) {
    errors.push('Invalid password setup attempt.');
  }

  if (errors.length) {
    return json({ status: 'ERROR', messages: errors });
  }

  const record = await ForgotPassword.findOne({ token });
  if (!record || (record.exp_date && record.exp_date < new Date())) {
    return json({ status: 'ERROR', messages: ['This password setup link is invalid or has expired.'] });
  }

  const user = await User.findById(record.user_id);
  if (!user) {
    return json({ status: 'ERROR', messages: ['User account not found.'] });
  }

  user.password = password;
  user.emailVerified = true;
  user.status = true;
  await user.save();

  await ForgotPassword.deleteMany({ user_id: user._id });

  return json({ status: 'SUCCESS', messages: ['Password updated successfully. You can now log in.'] });
}

export default function SetPasswordPage() {
  const { tokenStatus, message, email } = useLoaderData();
  const actionData = useActionData();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === 'submitting';
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const isTokenValid = tokenStatus === 'VALID';
  const actionStatus = actionData?.status;
  const showInvalidNotice = tokenStatus === 'INVALID' && actionStatus !== 'SUCCESS';

  return (
    <FrontLayout>
      <section className="contact-container">
        <div className="container">
          <div className="row d-grid d-flex justify-content-center">
            <div className="col-lg-6 col-md-8">
              <div className="card shadow-sm">
                <div className="card-body p-4">
                  <h3 className="mb-3">Set Your Password</h3>
                  {showInvalidNotice && (
                    <div className="alert alert-danger" role="alert">
                      {message || 'This link is invalid or has expired.'}
                    </div>
                  )}

                  {actionStatus === 'ERROR' && (
                    <div className="alert alert-danger" role="alert">
                      {actionData.messages?.map((msg, idx) => (
                        <div key={idx}>{msg}</div>
                      ))}
                    </div>
                  )}

                  {actionStatus === 'SUCCESS' && (
                    <div className="alert alert-success" role="alert">
                      {actionData.messages?.map((msg, idx) => (
                        <div key={idx}>{msg}</div>
                      ))}
                      <div className="mt-3">
                        <a className="btn btn-primary w-100" href="/login">
                          Go to Login
                        </a>
                      </div>
                    </div>
                  )}

                  {isTokenValid && actionStatus !== 'SUCCESS' && (
                    <>
                      <p className="text-muted">
                        Set a password for the account <strong>{email}</strong>.
                      </p>
                      <Form method="post">
                        <div className="mb-3">
                          <label className="form-label">New Password</label>
                          <input
                            type="password"
                            name="password"
                            className="form-control"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            minLength={6}
                            required
                            disabled={isSubmitting}
                          />
                        </div>
                        <div className="mb-3">
                          <label className="form-label">Confirm Password</label>
                          <input
                            type="password"
                            name="confirmPassword"
                            className="form-control"
                            value={confirmPassword}
                            onChange={e => setConfirmPassword(e.target.value)}
                            minLength={6}
                            required
                            disabled={isSubmitting}
                          />
                        </div>
                        <button type="submit" className="document-btn w-100" disabled={isSubmitting}>
                          {isSubmitting ? 'Saving...' : 'Save Password'}
                        </button>
                      </Form>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </FrontLayout>
  );
}
