import { json } from '@remix-run/node';
import crypto from 'crypto';
import { User } from '~/models/user';
import { EmailVerification } from '~/models/emailverification';
import { sendEmailVerificationEmail } from '~/utils/email';

export async function loader() {
  return json({ message: 'Method not allowed' }, { status: 405 });
}

export async function action({ request }) {
  if (request.method !== 'POST') {
    return json({ message: 'Method not allowed' }, { status: 405 });
  }

  const formData = await request.formData();
  const email = formData.get('email')?.toString().trim().toLowerCase();

  if (!email) {
    return json({ message: 'Email is required.' }, { status: 400 });
  }

  const user = await User.findOne({ email, deleted: false });

  if (!user) {
    return json({ message: 'If an account exists, a verification email will be sent shortly.' });
  }

  if (user.emailVerified) {
    return json({ message: 'This email is already verified.' });
  }

  await EmailVerification.deleteMany({ user: user._id });

  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await EmailVerification.create({ user: user._id, token, expiresAt });

  const siteUrl = process.env.SITE_URL || process.env.APP_URL || 'http://localhost:3000/';
  const normalizedUrl = siteUrl.endsWith('/') ? siteUrl : `${siteUrl}/`;
  const verificationLink = `${normalizedUrl}verify-email/${token}`;

  const sent = await sendEmailVerificationEmail(user, verificationLink);

  if (!sent) {
    return json({ message: 'Unable to send verification email. Please try again later.' }, { status: 500 });
  }

  return json({ message: 'Verification email sent. Please check your inbox.' });
}
