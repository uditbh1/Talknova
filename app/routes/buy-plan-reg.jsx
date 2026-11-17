// app/routes/buy-plan-reg.jsx
// ------------------------------------------------------------
// • Keeps your registration + coupon logic intact
// • Replaces SagePay with Stripe Checkout Session (recurring)
// • Shows the same invoice modal, then redirects to Stripe
// ------------------------------------------------------------

import { json, redirect } from '@remix-run/node';
import { useLoaderData, useFetcher, useActionData } from '@remix-run/react';
import { useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { randomBytes } from 'crypto';

import { getUserFromSession, createUserSession, login } from '~/utils/auth.server';
import { loginValidator } from '~/utils/validators';

import { Coupon } from '~/models/coupon';
import { PlanModel } from '~/models/plan';
import { User } from '~/models/user';
import { ForgotPassword } from '~/models/forgotpassword.server';
import { sendWelcomeEmail } from '~/utils/email.server';

import DisplayActionResponse from '~/components/ui/DisplayActionResponse';
import FrontLayout from '~/components/FrontLayout';
import { COUNTRIES, US_STATES } from '~/utils/constants';

// -------------------- LINKS (Frontend CSS) --------------------
import { frontendLinks } from '~/utils/frontend-links';
export const links = frontendLinks;

// -------------------- LOADER --------------------
export async function loader({ request }) {
  const url = new URL(request.url);
  const planId = url.searchParams.get('plan');
  const period = url.searchParams.get('period') || 'monthly';

  if (!planId) return redirect('/');

  const user = await getUserFromSession(request);
  if (user) return redirect(`/buy-plan?plan=${planId}&period=${period}`);

  const plan = await PlanModel.findOne({ _id: planId, isActive: true, isDeleted: false });
  if (!plan) return redirect('/');

  const yearlyPrice = plan.yearlyPrice || plan.price * 12;

  return json({ plan, US_STATES, COUNTRIES, period, yearlyPrice });
}

// -------------------- ACTION --------------------
export async function action({ request }) {
  const url = new URL(request.url);
  const planId = url.searchParams.get('plan');
  const period = url.searchParams.get('period') || 'monthly';
  
  const formData = await request.formData();
  const _action = formData.get('_action');

  // ---------- LOGIN ----------
  if (_action === 'LOGIN') {
    const formPayload = Object.fromEntries(formData);
    
    let validationResult = await loginValidator(formPayload, true);
    if (!validationResult.status) {
      return json({ 
        messages: Object.values(validationResult.errors).flat(), 
        status: 'ERROR',
        actionType: 'LOGIN'
      });
    }

    let response = await login(formPayload);
    
    if (response.status === 200) {
      const redirectUrl = planId 
        ? `/buy-plan?plan=${planId}&period=${period}` 
        : '/portal';
      const showWelcomePopup = response.showWelcomePopup || false;
      return createUserSession(response.user, redirectUrl, showWelcomePopup);
    }

    return json({ 
      messages: [response.message || 'Login failed'], 
      status: 'ERROR',
      actionType: 'LOGIN'
    });
  }

  // ---------- APPLY COUPON ----------
  if (_action === 'APPLY_COUPON') {
    const couponCode = (formData.get('couponCode') || '').toString().toUpperCase();
    const planId = formData.get('planId')?.toString();

    const coupon = await Coupon.findOne({
      code: couponCode,
      status: true,
      validFrom: { $lte: new Date() },
      validUntil: { $gte: new Date() },
    });

    if (!coupon) return json({ messages: ['Invalid or expired coupon'], status: 'ERROR' });

    if (coupon.maxRedemptions && coupon.timesRedeemed >= coupon.maxRedemptions) {
      return json({ messages: ['Coupon has reached maximum usage'], status: 'ERROR' });
    }

    const plan = await PlanModel.findById(planId);
    if (!plan) return json({ error: 'Plan not found' }, { status: 400 });

    let discountedPrice = plan.price;
    if (coupon.discountType === 'PERCENTAGE') {
      discountedPrice = plan.price - (plan.price * coupon.discountValue) / 100;
    } else {
      discountedPrice = Math.max(0, plan.price - coupon.discountValue);
    }

    return json({
      success: true,
      couponCode,
      originalPrice: plan.price,
      discountedPrice: discountedPrice.toFixed(2),
    });
  }

  // ---------- REGISTER (BASIC INFO ONLY) ----------
  if (_action === 'REGISTER_AND_SHOW_INVOICE') {
    const planId = formData.get('planId')?.toString();
    const plan = await PlanModel.findById(planId);
    if (!plan) return json({ messages: ['Plan not found'], status: 'ERROR' });

    // Collect only basic registration fields (no billing details yet)
    const title = formData.get('title')?.toString() || 'Mr';
    const firstName = formData.get('firstName')?.toString() || '';
    const lastName = formData.get('lastName')?.toString() || '';
    const company = formData.get('company')?.toString() || '';
    const phone = formData.get('phone')?.toString() || '';
    const email = formData.get('userEmail')?.toString() || '';

    // Basic validation
    const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!isEmailValid) {
      return json({ messages: ['Invalid email format.'], status: 'ERROR' });
    }
    if (!firstName || !lastName || !email) {
      return json({ messages: ['Missing required fields'], status: 'ERROR' });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email }).lean();
    if (existingUser) {
      return json({ messages: ['Email already in use.'], status: 'ERROR' });
    }

    // Create user without password (use placeholder) - password will be assigned after payment
    // No plan assigned yet - plan will be assigned after payment
    const placeholderPassword = `PLACEHOLDER_${randomBytes(16).toString('hex')}`; // Temporary placeholder
    const createdUser = await User.create({
      title,
      firstName,
      lastName,
      company,
      email: email.toLowerCase().trim(),
      password: placeholderPassword, // Placeholder - will be replaced after payment
      phone: phone || '',
      dateOfJoining: new Date(),
      roles: ['CLIENT'],
      image: 'avatar-fallback.jpg',
      courses: [],
      emailVerified: false, // Must verify email before proceeding
      status: false, // Inactive until email verified
      fromBuyPlanReg: true, // Mark that this user came from buy-plan-reg flow
    });

    // Generate email verification token
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Delete any existing verification tokens for this user
    await ForgotPassword.deleteMany({ user_id: createdUser._id });

    // Create verification token record with plan info only (no billing details yet)
    try {
      await ForgotPassword.create({
        user_id: createdUser._id,
        token,
        exp_date: expiresAt,
        pendingPlanId: plan._id, // Store selected plan for after verification
        pendingPlanPeriod: period, // Store selected period
        // No billing details stored yet - user will fill them after verification
      });
      console.log('Verification token created for user:', createdUser._id);
    } catch (tokenError) {
      console.error('Failed to create verification token:', tokenError);
    }

    // Build verification link
    const url = new URL(request.url);
    let baseUrl;
    if (url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname.includes('localhost')) {
      baseUrl = `${url.protocol}//${url.host}`;
    } else {
      baseUrl = process.env.SITE_URL || `${url.protocol}//${url.host}`;
    }
    const normalizedBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
    const verificationLink = `${normalizedBase}verify-email/${token}`;

    // Send verification email without password (password will be sent after payment)
    let emailSent = false;
    try {
      emailSent = await sendWelcomeEmail(createdUser, null, verificationLink); // No password yet
      if (emailSent) {
        console.log('Verification email sent to:', createdUser.email);
      } else {
        console.error('Failed to send verification email to:', createdUser.email);
        // Don't fail registration if email fails - user can request resend
      }
    } catch (emailErr) {
      console.error('Error sending verification email:', emailErr);
      emailSent = false;
      // Don't fail registration if email fails - user can request resend
    }

    // User must verify email first, then fill billing details, then proceed to payment
    return json({
      status: 'VERIFICATION_REQUIRED',
      messages: ['Account created successfully. Please verify your email to continue.'],
      emailSent,
      verificationLink: emailSent ? null : verificationLink, // Include verification link if email failed
      planId: plan._id,
      period: period,
      userEmail: email,
    });
  }

  return null;
}

// -------------------- COMPONENT --------------------
export default function BuyPlanReg() {
  const { plan, US_STATES, COUNTRIES, period, yearlyPrice } = useLoaderData();
  const fetcher = useFetcher();
  const actionResponse = useActionData();

  const [country, setCountry] = useState('GB');
  const [isUS, setIsUS] = useState(false);
  const [showInvoice, setShowInvoice] = useState(false);
  const [invoiceData, setInvoiceData] = useState(null);
  const [activeTab, setActiveTab] = useState('signup'); // 'login' or 'signup'

  useEffect(() => setIsUS(country === 'US'), [country]);

  useEffect(() => {
    if (fetcher.data && fetcher.data.status === 'OK') {
      setInvoiceData(fetcher.data);
      setShowInvoice(true);
    }
    // Switch to login tab if login error occurs
    if (fetcher.data && fetcher.data.status === 'ERROR' && fetcher.data.actionType === 'LOGIN') {
      setActiveTab('login');
    }
  }, [fetcher.data]);

  function proceedToGateway() {
    if (invoiceData?.redirectUrl) window.location.assign(invoiceData.redirectUrl);
  }

  if (!plan) {
    return (
      <FrontLayout>
        <section className="expand-container">
          <div className="container">
            <div className="alert alert-danger">Invalid Plan</div>
          </div>
        </section>
      </FrontLayout>
    );
  }

  return (
    <FrontLayout>
      <section className="contact-container">
        <div className="container">
          <div className="row d-grid d-flex justify-content-center">
            <div className="col-lg-8 col-md-12 col-sm-12 col-xs-12">
              <h3>Subscribe to {plan.name}</h3>

              {/* Tab Navigation */}
              <div className="card mb-3">
                <div className="card-body p-0">
                  <ul className="nav nav-tabs" role="tablist">
                    <li className="nav-item" role="presentation">
                      <button
                        className={`nav-link ${activeTab === 'login' ? 'active' : ''}`}
                        onClick={() => setActiveTab('login')}
                        type="button"
                        role="tab"
                      >
                        Already have an account? Log In
                      </button>
                    </li>
                    <li className="nav-item" role="presentation">
                      <button
                        className={`nav-link ${activeTab === 'signup' ? 'active' : ''}`}
                        onClick={() => setActiveTab('signup')}
                        type="button"
                        role="tab"
                      >
                        New Account? Sign Up
                      </button>
                    </li>
                  </ul>
                </div>
              </div>

              <div className="card">
                <div className="card-body">
                  {fetcher.data && fetcher.data.status === 'ERROR' && <DisplayActionResponse actionResponse={fetcher.data} />}
                  {fetcher.data && fetcher.data.status === 'OK' && <DisplayActionResponse actionResponse={fetcher.data} />}
                  {fetcher.data && fetcher.data.status === 'VERIFICATION_REQUIRED' && (
                    <div className="alert alert-info">
                      <h5>Account Created</h5>
                      <p>Verification email sent to <strong>{fetcher.data.userEmail}</strong>.</p>
                      <p className="mb-0">Check your email and click the verification link to continue.</p>
                      {!fetcher.data.emailSent && (
                        <div className="alert alert-warning mt-3 mb-0">
                          <strong>Email not sent.</strong> Verification link: <a href={fetcher.data.verificationLink} target="_blank" rel="noopener noreferrer" className="small">{fetcher.data.verificationLink}</a>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Plan Details */}
                  <div className="price mb-3">
                    <h4>
                      <i className="fas fa-pound-sign"></i> {period === 'yearly' ? yearlyPrice : plan.price}
                      {period === 'yearly' ? <small>/yr</small> : <small>/mo</small>}
                    </h4>
                    <p className="text-muted">{period === 'yearly' ? 'Yearly Subscription' : 'Monthly Subscription'}</p>
                  </div>
                  <div className="features mb-3">
                    <ul className="list-unstyled">
                      <li>
                        <i className="fas fa-check text-success"></i> {period === 'yearly' ? plan.maxDocuments * 2 : plan.maxDocuments} Documents
                        {period === 'yearly' && <span className="text-success ms-1">(2x)</span>}
                      </li>
                      <li>
                        <i className="fas fa-check text-success"></i> {period === 'yearly' ? plan.maxFileSize * 2 : plan.maxFileSize}MB File Size
                        {period === 'yearly' && <span className="text-success ms-1">(2x)</span>}
                      </li>
                      <li>
                        <i className="fas fa-check text-success"></i> {period === 'yearly' ? plan.maxUrls * 2 : plan.maxUrls} URLs
                        {period === 'yearly' && <span className="text-success ms-1">(2x)</span>}
                      </li>
                    </ul>
                  </div>

                  {/* Login Form */}
                  {activeTab === 'login' && (
                    <div className="login-form mt-2">
                      <h4>Log In to Your Account</h4>
                      <fetcher.Form method="post">
                        <input type="hidden" name="_action" value="LOGIN" />
                        <div className="row g-3">
                          <div className="col-12">
                            <label className="form-label">Email</label>
                            <input type="email" name="email" className="form-control" required />
                          </div>
                          <div className="col-12">
                            <label className="form-label">Password</label>
                            <input type="password" name="password" className="form-control" required />
                          </div>
                          <div className="col-12">
                            <a href="/forgot-password" className="text-muted">Forgot password?</a>
                          </div>
                          <div className="col-12">
                            <button type="submit" className="document-btn">
                              Log In & Continue to Payment
                            </button>
                          </div>
                        </div>
                      </fetcher.Form>
                    </div>
                  )}

                  {/* Registration Form (Basic Info Only) */}
                  {activeTab === 'signup' && !(fetcher.data && fetcher.data.status === 'VERIFICATION_REQUIRED') && (
                  <div className="billing-form mt-2">
                    <h4>Create New Account</h4>
                    <fetcher.Form method="post">
                      <input type="hidden" name="_action" value="REGISTER_AND_SHOW_INVOICE" />
                      <input type="hidden" name="planId" value={plan._id} />
                      <input type="hidden" name="period" value={period} />

                      <div className="row g-3">
                        <div className="col-md-6">
                          <label className="form-label">Title</label>
                          <select name="title" className="form-select" required>
                            <option value="Mr">Mr</option>
                            <option value="Mrs">Mrs</option>
                            <option value="Ms">Ms</option>
                            <option value="Dr">Dr</option>
                          </select>
                        </div>
                        <div className="col-md-6">
                          <label className="form-label">First Name</label>
                          <input type="text" name="firstName" className="form-control" required />
                        </div>
                        <div className="col-md-6">
                          <label className="form-label">Last Name</label>
                          <input type="text" name="lastName" className="form-control" required />
                        </div>
                        <div className="col-md-6">
                          <label className="form-label">Company</label>
                          <input type="text" name="company" className="form-control" />
                        </div>
                        <div className="col-md-6">
                          <label className="form-label">Phone</label>
                          <input type="text" name="phone" className="form-control" />
                        </div>
                        <div className="col-md-6">
                          <label className="form-label">Email</label>
                          <input type="email" name="userEmail" className="form-control" required />
                        </div>

                        <div className="col-12">
                          <div className="alert alert-info mb-0">
                            After verification, you'll be asked to fill in your billing details and proceed to payment. A temporary password will be sent to you after successful payment.
                          </div>
                        </div>

                        <div className="col-12">
                          <button type="submit" className="document-btn">
                            Create Account & Verify Email
                          </button>
                        </div>
                      </div>
                    </fetcher.Form>
                  </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Invoice Modal - Only show for OK status, not for VERIFICATION_REQUIRED */}
      {showInvoice && invoiceData && invoiceData.status === 'OK' && (
        <div className="modal fade show" style={{ display: 'block' }} role="dialog">
          <div className="modal-dialog modal-lg modal-dialog-centered" role="document">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Order Summary</h5>
                <button type="button" className="btn-close" onClick={() => setShowInvoice(false)} aria-label="Close"></button>
              </div>
              <div className="modal-body">
                <p>
                  <strong>Plan:</strong> {plan.name}
                </p>
                <p>
                  <strong>Amount:</strong> {invoiceData.currency} {invoiceData.amount}
                </p>
                <p>
                  <strong>Billed To:</strong> {invoiceData.firstName} {invoiceData.lastName}
                </p>
                <p>
                  <strong>Address:</strong> {invoiceData.addr1}
                  {invoiceData.addr2 && `, ${invoiceData.addr2}`}, {invoiceData.city} {invoiceData.postcode}
                </p>
                
                {invoiceData.emailSent ? (
                  <div className="alert alert-info mt-3">
                    <strong>Important:</strong> We've sent a verification email to <strong>{invoiceData.userEmail}</strong> with your temporary password and verification link. Please check your email (including spam folder) before proceeding to payment.
                    <br /><br />
                    You must verify your email before you can log in to your account.
                  </div>
                ) : (
                  <div className="alert alert-warning mt-3">
                    <strong>Email Delivery Issue:</strong> We couldn't send the verification email to {invoiceData.userEmail}. 
                    <br /><br />
                    <strong>Your temporary password:</strong> <code className="bg-light p-1 rounded">{invoiceData.temporaryPassword}</code>
                    <br /><br />
                    <strong>Verification link:</strong> <a href={invoiceData.verificationLink} target="_blank" rel="noopener noreferrer" className="small">{invoiceData.verificationLink}</a>
                    <br /><br />
                    <strong>Please save these credentials.</strong> You must verify your email before you can log in to your account.
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowInvoice(false)}>
                  Cancel
                </button>
                <button type="button" className="btn btn-success" onClick={proceedToGateway}>
                  Proceed to Payment
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </FrontLayout>
  );
}
