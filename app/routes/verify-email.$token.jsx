import { json } from '@remix-run/node';
import { useLoaderData, Link } from '@remix-run/react';
import FrontLayout from '~/components/FrontLayout';
import { EmailVerification } from '~/models/emailverification';
import { User } from '~/models/user';

export async function loader({ params }) {
  const { token } = params;

  if (!token) {
    return json({ status: 'ERROR', message: 'Invalid verification link.' });
  }

  const record = await EmailVerification.findOne({ token });

  if (!record) {
    return json({ status: 'ERROR', message: 'This verification link is invalid or has expired.' });
  }

  if (record.expiresAt && record.expiresAt < new Date()) {
    await EmailVerification.deleteOne({ _id: record._id });
    return json({ status: 'ERROR', message: 'This verification link has expired.' });
  }

  const user = await User.findById(record.user);

  if (!user) {
    await EmailVerification.deleteOne({ _id: record._id });
    return json({ status: 'ERROR', message: 'User account not found.' });
  }

  if (!user.emailVerified) {
    user.emailVerified = true;
    await user.save();
  }

  await EmailVerification.deleteMany({ user: user._id });

  return json({ status: 'SUCCESS', message: 'Your email has been verified successfully.' });
}

export default function VerifyEmailPage() {
  const { status, message } = useLoaderData();
  const isSuccess = status === 'SUCCESS';

  return (
    <FrontLayout>
      <section className="contact-container">
        <div className="container">
          <div className="row d-grid d-flex justify-content-center">
            <div className="col-lg-6 col-md-8">
              <div className="card shadow-sm">
                <div className="card-body p-4 text-center">
                  <h3 className="mb-3">Email Verification</h3>
                  <div className={`alert ${isSuccess ? 'alert-success' : 'alert-danger'}`} role="alert">
                    {message}
                  </div>
                  <div className="mt-3">
                    <Link className="btn btn-primary" to="/login">
                      Back to Login
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </FrontLayout>
  );
}
