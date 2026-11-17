import type { LoaderFunction, ActionFunction } from '@remix-run/node';
import { json, redirect } from '@remix-run/node';
import { useLoaderData, useFetcher, useActionData, Link } from '@remix-run/react';
import { useEffect, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { isAfter } from 'date-fns';

import { getUserFromSession } from '~/utils/auth.server';
import { getCurrentPlan } from '~/utils/plans';
import { createCheckoutSession } from '~/utils/stripe.server'; /* ⬅ new helper */

import { PlanModel } from '~/models/plan';
import { Coupon } from '~/models/coupon';
import { Transaction } from '~/models/transaction';

import FrontLayout from '~/components/FrontLayout';
import { COUNTRIES, US_STATES } from '~/utils/constants';

/* ---------- links (frontend CSS) ---------- */
import { frontendLinks } from '~/utils/frontend-links';
export const links = frontendLinks;

/* ---------- loader ---------- */
export const loader: LoaderFunction = async ({ request }) => {
  const url = new URL(request.url);
  const planId = url.searchParams.get('plan');
  const period = url.searchParams.get('period') || 'monthly';
  const fromVerification = url.searchParams.get('fromVerification') === 'true';
  if (!planId) return redirect('/');

  const user = await getUserFromSession(request);
  if (!user) return redirect(`/buy-plan-reg?plan=${planId}&period=${period}`);

  const currentPlan = await getCurrentPlan(user._id);
  if (currentPlan && currentPlan.expiryDate && currentPlan.planId && isAfter(new Date(currentPlan.expiryDate), new Date()) && currentPlan.planId.price > 0) {
    return json({
      error: 'You already have an active paid plan',
      currentPlan,
      user,
      plan: currentPlan.planId,
      US_STATES,
      COUNTRIES,
      isExpired: false,
    });
  }

  const plan = await PlanModel.findOne({ _id: planId, isActive: true, isDeleted: false });
  if (!plan) return redirect('/');

  const yearlyPrice = plan.yearlyPrice || (plan.price ? plan.price * 12 : 0);

  // Check if user email is verified - if not, redirect to verification page
  if (user.emailVerified === false || user.emailVerified === undefined) {
    return json({ 
      plan, 
      user, 
      currentPlan, 
      US_STATES, 
      COUNTRIES, 
      period, 
      yearlyPrice,
      emailNotVerified: true 
    });
  }

  // Check if user has complete billing details (for showing payment prompt instead of form)
  const hasCompleteBillingDetails = user.addressLine1 && user.city && user.postcode && user.country;

  return json({ 
    plan, 
    user, 
    currentPlan, 
    US_STATES, 
    COUNTRIES, 
    period, 
    yearlyPrice,
    fromVerification,
    showPaymentPrompt: fromVerification && hasCompleteBillingDetails // Show payment prompt if coming from verification and details are complete
  });
};

/* ---------- action ---------- */
export const action: ActionFunction = async ({ request }) => {
  const user = await getUserFromSession(request);
  if (!user) return redirect('/login');

  const formData = await request.formData();
  const _action = formData.get('_action');
  const period = formData.get('period') || 'monthly';

  if (_action === 'SHOW_INVOICE') {
    // Double-check email verification before allowing payment
    if (user.emailVerified === false || user.emailVerified === undefined) {
      return json({ 
        status: 'ERROR', 
        messages: ['Please verify your email address before proceeding to payment.'] 
      });
    }

    const plan = await PlanModel.findById(formData.get('planId'));
    if (!plan) return json({ status: 'ERROR', messages: ['Plan not found'] });

    const firstName = formData.get('firstName')!.toString();
    const lastName = formData.get('lastName')!.toString();
    const addr1 = formData.get('addr1')!.toString();
    const city = formData.get('city')!.toString();
    const postcode = formData.get('postcode')!.toString();
    const billingCountry = formData.get('country')!.toString();
    const billingState = formData.get('billingState')?.toString() || '';

    const price = period === 'yearly' ? plan.yearlyPrice || plan.price * 12 : plan.price;
    const amountPence = Math.round(price * 100);

    const vendorTxCode = `PLAN${Date.now()}-${uuidv4()}`;
    const tx = await Transaction.create({
      user: user._id,
      vendorTxCode,
      amount: price,
      plan: plan._id,
      currency: 'GBP',
      description: `${plan.name} Plan Purchase (${period})`,
      billingSurname: lastName,
      billingFirstNames: firstName,
      billingAddress1: addr1,
      billingCity: city,
      billingPostCode: postcode,
      billingCountry,
      billingState,
      customerEmail: user.email,
      customerName: `${firstName} ${lastName}`,
      period,
      status: 'PENDING',
    });

    const { url } = await createCheckoutSession({
      amountPence,
      currency: 'GBP',
      planName: plan.name,
      clientReferenceId: tx._id.toString(),
      customerEmail: user.email,
      tx: {
        _id: tx._id.toString(),
        user: tx.user.toString(),
        plan: tx.plan.toString(),
      },
    });

    return json({
      status: 'OK',
      redirectUrl: url,
      amount: price.toFixed(2),
      currency: 'GBP',
    });
  }

  return null;
};

/* ---------- component ---------- */
export default function BuyPlan() {
  const { plan, user, currentPlan, error, US_STATES, COUNTRIES, isExpired, period, yearlyPrice, emailNotVerified, showPaymentPrompt } = useLoaderData<any>();

  const fetcher = useFetcher();
  const actionResp = useActionData();

  const [country, setCountry] = useState('GB');
  const [isUS, setIsUS] = useState(false);
  const [showInvoice, setShowInvoice] = useState(false);
  const [invoiceData, setInvoiceData] = useState<FetcherData | null>(null);

  /* country toggle */
  useEffect(() => setIsUS(country === 'US'), [country]);

  /* invoice data listener */
  useEffect(() => {
    if (fetcher.data?.status === 'OK' && fetcher.data.redirectUrl) {
      // If coming from payment prompt, redirect directly to Stripe
      if (showPaymentPrompt) {
        console.log('Redirecting to Stripe from payment prompt:', fetcher.data.redirectUrl);
        window.location.href = fetcher.data.redirectUrl;
        return;
      }
      // Otherwise show invoice modal (for regular flow)
      setInvoiceData(fetcher.data);
      setShowInvoice(true);
    }
  }, [fetcher.data, showPaymentPrompt]);

  /* redirect to Stripe */
  const proceedToGateway = () => {
    if (invoiceData?.redirectUrl) window.location.assign(invoiceData.redirectUrl);
  };

  /* ---- early exit when email not verified ---- */
  if (emailNotVerified) {
    return (
      <FrontLayout>
        <section className="expand-container">
          <div className="container">
            <div className="row d-grid d-flex justify-content-center">
              <div className="col-lg-8 col-md-12">
                <div className="alert alert-warning">
                  <h4>Email Verification Required</h4>
                  <p>Please verify your email address before proceeding to payment.</p>
                  <p>We've sent a verification email to <strong>{user.email}</strong>. Please check your inbox (including spam folder) and click the verification link.</p>
                  <div className="mt-3">
                    <Link to="/portal" className="btn btn-primary me-2">
                      Go to Dashboard
                    </Link>
                    <Link to="/login" className="btn btn-secondary">
                      Back to Login
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </FrontLayout>
    );
  }

  /* ---- early exit when user already subscribed ---- */
  if (error) {
    return (
      <FrontLayout>
        <section className="expand-container">
          <div className="container">
            <div className="alert alert-warning">
              <h4>You already have an active plan</h4>
              <p>Current Plan: {currentPlan?.planId?.name || 'N/A'}</p>
              <p>Valid until: {currentPlan?.expiryDate ? new Date(currentPlan.expiryDate).toLocaleDateString() : 'N/A'}</p>
              <Link to="/portal" className="btn btn-primary">
                Dashboard
              </Link>
            </div>
          </div>
        </section>
      </FrontLayout>
    );
  }

  /* ---- Show Payment Prompt instead of form if coming from verification with complete details ---- */
  if (showPaymentPrompt) {
    const price = period === 'yearly' ? yearlyPrice : (plan.price || 0);
    
    return (
      <FrontLayout>
        <section className="contact-container">
          <div className="container">
            <div className="row d-grid d-flex justify-content-center">
              <div className="col-lg-8 col-md-12">
                <h3>Complete Your Subscription</h3>
                
                <div className="card">
                  <div className="card-body">
                    {/* Plan Summary */}
                    <div className="mb-4">
                      <h4>Plan: {plan.name}</h4>
                      <div className="price mb-3">
                        <h3>
                          <i className="fas fa-pound-sign" /> {price}
                          {period === 'yearly' ? <small>/yr</small> : <small>/mo</small>}
                        </h3>
                      </div>
                      <div className="features">
                        <ul className="list-unstyled">
                          <li>
                            <i className="fas fa-check text-success" /> {period === 'yearly' ? plan.maxDocuments * 2 : plan.maxDocuments} Documents
                            {period === 'yearly' && <span className="text-success ms-1">(2x)</span>}
                          </li>
                          <li>
                            <i className="fas fa-check text-success" /> {period === 'yearly' ? plan.maxFileSize * 2 : plan.maxFileSize}MB File Size
                            {period === 'yearly' && <span className="text-success ms-1">(2x)</span>}
                          </li>
                          <li>
                            <i className="fas fa-check text-success" /> {period === 'yearly' ? plan.maxUrls * 2 : plan.maxUrls} URLs
                            {period === 'yearly' && <span className="text-success ms-1">(2x)</span>}
                          </li>
                        </ul>
                      </div>
                    </div>

                    {/* Billing Address Summary */}
                    <div className="mb-4">
                      <h5>Billing Address</h5>
                      <p className="mb-1"><strong>{user.firstName} {user.lastName}</strong></p>
                      <p className="mb-1">{user.addressLine1}</p>
                      {user.addressLine2 && <p className="mb-1">{user.addressLine2}</p>}
                      <p className="mb-1">{user.city} {user.postcode}</p>
                      <p className="mb-0">{user.country}{user.state ? `, ${user.state}` : ''}</p>
                    </div>

                    {/* Payment Actions */}
                    <div className="d-grid gap-2 d-md-flex justify-content-md-end mt-4">
                      <Link to="/portal" className="btn btn-secondary">
                        Cancel
                      </Link>
                      <fetcher.Form method="post" className="d-inline">
                        <input type="hidden" name="_action" value="SHOW_INVOICE" />
                        <input type="hidden" name="planId" value={plan._id.toString()} />
                        <input type="hidden" name="period" value={period} />
                        <input type="hidden" name="firstName" value={user.firstName} />
                        <input type="hidden" name="lastName" value={user.lastName} />
                        <input type="hidden" name="addr1" value={user.addressLine1 || ''} />
                        <input type="hidden" name="addr2" value={user.addressLine2 || ''} />
                        <input type="hidden" name="city" value={user.city || ''} />
                        <input type="hidden" name="postcode" value={user.postcode || ''} />
                        <input type="hidden" name="country" value={user.country || 'GB'} />
                        <input type="hidden" name="billingState" value={user.state || ''} />
                        <button 
                          type="submit" 
                          className="btn btn-primary"
                          disabled={fetcher.state === 'submitting'}
                        >
                          {fetcher.state === 'submitting' ? 'Processing...' : 'Proceed to Payment'}
                        </button>
                      </fetcher.Form>
                    </div>
                    
                    {/* Show error if payment fails */}
                    {fetcher.data?.status === 'ERROR' && (
                      <div className="alert alert-danger mt-3">
                        {fetcher.data.messages?.map((msg, idx) => (
                          <div key={idx}>{msg}</div>
                        ))}
                      </div>
                    )}
                    
                    {/* Show loading state */}
                    {fetcher.state === 'submitting' && (
                      <div className="alert alert-info mt-3">
                        <i className="fas fa-spinner fa-spin me-2"></i>
                        Preparing your payment...
                      </div>
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

  return (
    <FrontLayout>
      {/* =====================  Main Section  ===================== */}
      <section className="contact-container">
        <div className="container">
          <div className="row d-grid d-flex justify-content-center">
            <div className="col-lg-8 col-md-12">
              <h3>Subscribe to {plan.name}</h3>

              {currentPlan && isExpired && (
                <div className="alert alert-info mb-4">
                  <h5>Your Previous Plan</h5>
                  <p>Plan: {currentPlan?.planId?.name || 'N/A'}</p>
                  <p>Expired on: {currentPlan?.expiryDate ? new Date(currentPlan.expiryDate).toLocaleDateString() : 'N/A'}</p>
                  <p>You can now purchase a new plan.</p>
                </div>
              )}

              <div className="card">
                <div className="card-body">
                  {/* --- price & features --- */}
                  <div className="price mb-2">
                    <h4>
                      <i className="fas fa-pound-sign" /> {period === 'yearly' ? yearlyPrice : (plan.price || 0)}
                      {period === 'yearly' ? <small>/yr</small> : <small>/mo</small>}
                    </h4>
                    <p className="text-muted">{period === 'yearly' ? 'Yearly Subscription' : 'Monthly Subscription'}</p>
                  </div>
                  <div className="features mb-2">
                    <ul className="list-unstyled">
                      <li>
                        <i className="fas fa-check text-success" /> {period === 'yearly' ? plan.maxDocuments * 2 : plan.maxDocuments} Documents
                        {period === 'yearly' && <span className="text-success ms-1">(2x)</span>}
                      </li>
                      <li>
                        <i className="fas fa-check text-success" /> {period === 'yearly' ? plan.maxFileSize * 2 : plan.maxFileSize}MB File Size
                        {period === 'yearly' && <span className="text-success ms-1">(2x)</span>}
                      </li>
                      <li>
                        <i className="fas fa-check text-success" /> {period === 'yearly' ? plan.maxUrls * 2 : plan.maxUrls} URLs
                        {period === 'yearly' && <span className="text-success ms-1">(2x)</span>}
                      </li>
                    </ul>
                  </div>

                  {/* --- Billing Form --- */}
                  <div className="billing-form mt-2">
                    <h4>Billing Details</h4>
                    <fetcher.Form method="post">
                      <input type="hidden" name="_action" value="SHOW_INVOICE" />
                      <input type="hidden" name="planId" value={plan._id.toString()} />
                      <input type="hidden" name="period" value={period} />

                      <div className="row g-3">
                        <div className="col-md-6">
                          <label className="form-label">First Name</label>
                          <input type="text" name="firstName" className="form-control" required defaultValue={user.firstName} />
                        </div>
                        <div className="col-md-6">
                          <label className="form-label">Last Name</label>
                          <input type="text" name="lastName" className="form-control" required defaultValue={user.lastName} />
                        </div>
                        <div className="col-12">
                          <label className="form-label">Email</label>
                          <input type="email" name="userEmail" className="form-control" required defaultValue={user.email} />
                        </div>
                        <div className="col-12">
                          <label className="form-label">Address</label>
                          <input type="text" name="addr1" className="form-control" required defaultValue={user.addressLine1} />
                        </div>
                        <div className="col-12">
                          <label className="form-label">Address 2</label>
                          <input type="text" name="addr2" className="form-control" defaultValue={user.addressLine2} />
                        </div>
                        <div className="col-md-4">
                          <label className="form-label">City</label>
                          <input type="text" name="city" className="form-control" required defaultValue={user.city} />
                        </div>
                        <div className="col-md-4">
                          <label className="form-label">Postcode</label>
                          <input type="text" name="postcode" className="form-control" required defaultValue={user.postcode} />
                        </div>
                        <div className="col-md-4">
                          <label className="form-label">Country</label>
                          <select name="country" className="form-select" required value={country} onChange={e => setCountry(e.target.value)}>
                            <option value="">Select</option>
                            {COUNTRIES.map(c => (
                              <option key={c.code} value={c.code}>
                                {c.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        {isUS && (
                          <div className="col-md-6">
                            <label className="form-label">State</label>
                            <select name="billingState" className="form-select" required>
                              <option value="">Select a state</option>
                              {US_STATES.map(st => (
                                <option key={st} value={st}>
                                  {st}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}

                        <div className="col-12">
                          <button type="submit" className="document-btn">
                            Proceed to Payment
                          </button>
                        </div>
                      </div>
                    </fetcher.Form>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =====================  Invoice Modal  ===================== */}
      {showInvoice && invoiceData?.status === 'OK' && (
        <div className="modal fade show" style={{ display: 'block' }} role="dialog">
          <div className="modal-dialog modal-lg modal-dialog-centered" role="document">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Order Summary</h5>
                <button type="button" className="btn-close" onClick={() => setShowInvoice(false)} aria-label="Close" />
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
