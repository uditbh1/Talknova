import { redirect } from '@remix-run/node';
import { useLoaderData } from '@remix-run/react';
import { useEffect } from 'react';
import jwt from 'jsonwebtoken';
import FrontLayout from '~/components/FrontLayout';
import { User } from '~/models/user';
import { createUserSession, getUserFromSession } from '~/utils/auth.server';
import { frontendLinks } from '~/utils/frontend-links';

export const links = frontendLinks;

const SITENAME = process.env.SITENAME;

export async function loader({ request }) {
  // Check if user is already logged in
  let user = await getUserFromSession(request);
  if (user) return redirect('/portal');

  const url = new URL(request.url);
  const token = url.searchParams.get('token');

  if (!token) {
    return {
      error: 'Invalid or missing magic link token.',
      success: false,
      user: null,
      SITENAME
    };
  }

  try {
    // Verify JWT token
    const jwtSecret = process.env.JWT_SECRET || 'your-secret-key';
    const decoded = jwt.verify(token, jwtSecret);

    if (decoded.type !== 'magic_link') {
      return {
        error: 'Invalid token type.',
        success: false,
        user: null,
        SITENAME
      };
    }

    // Find user and check token
    const foundUser = await User.findById(decoded.userId);
    
    if (!foundUser) {
      return {
        error: 'User not found.',
        success: false,
        user: null,
        SITENAME
      };
    }

    // Check if token matches and hasn't expired
    if (foundUser.magicLinkToken !== token || 
        !foundUser.magicLinkExpiry || 
        new Date() > foundUser.magicLinkExpiry) {
      return {
        error: 'Magic link has expired or been used. Please request a new one.',
        success: false,
        user: null,
        SITENAME
      };
    }

    // Clear the magic link token (single use)
    await User.findByIdAndUpdate(foundUser._id, {
      $unset: { 
        magicLinkToken: 1, 
        magicLinkExpiry: 1 
      }
    });

    // Format user object properly for session (like in login function)
    const userObj = foundUser.toObject();
    userObj.fullName = `${userObj.firstName} ${userObj.lastName}`;
    userObj.initials = `${userObj.firstName.charAt(0)}${userObj.lastName.charAt(0)}`;
    delete userObj.password;
    delete userObj.magicLinkToken;
    delete userObj.magicLinkExpiry;

    // Create user session and redirect
    return createUserSession(userObj, '/portal');

  } catch (error) {
    console.error('Magic link verification error:', error);
    
    let errorMessage = 'An error occurred during verification. Please try again.';
    
    if (error.name === 'TokenExpiredError') {
      errorMessage = 'Magic link has expired. Please request a new one.';
    } else if (error.name === 'JsonWebTokenError') {
      errorMessage = 'Invalid magic link. Please request a new one.';
    }

    return {
      error: errorMessage,
      success: false,
      user: null,
      SITENAME
    };
  }
}

export default function MagicLinkVerify() {
  const data = useLoaderData();

  useEffect(() => {
    if (data.success) {
      // This shouldn't render if successful (should redirect)
      window.location.href = '/dashboard';
    }
  }, [data.success]);

  return (
    <FrontLayout>
      <div className="main-content">
        <section className="py-5">
          <div className="container">
            <div className="row justify-content-center">
              <div className="col-lg-6">
                <div className="card shadow">
                  <div className="card-body p-5 text-center">
                    {data.success ? (
                      <div>
                        <div className="text-success mb-3">
                          <i className="fas fa-check-circle fa-3x"></i>
                        </div>
                        <h3 className="text-success">Login Successful!</h3>
                        <p className="text-muted">Redirecting to your dashboard...</p>
                        <div className="spinner-border text-primary mt-3"></div>
                      </div>
                    ) : (
                      <div>
                        <div className="text-danger mb-3">
                          <i className="fas fa-times-circle fa-3x"></i>
                        </div>
                        <h3 className="text-danger">Login Failed</h3>
                        <p className="text-muted mb-4">{data.error}</p>
                        
                        <div className="text-center">
                          <a href="/magic-link" className="document-btn me-2" style={{display: 'inline-block'}}>
                            <i className="fas fa-magic me-2"></i>
                            Request New Magic Link
                          </a>
                          <a href="/login" className="document-btn" style={{display: 'inline-block'}}>
                            <i className="fas fa-sign-in-alt me-2"></i>
                            Back to Login
                          </a>
                        </div>
                      </div>
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