import { json, redirect } from '@remix-run/node';
import { useLoaderData, useFetcher, Form, Link, useActionData } from '@remix-run/react';
import { useState, useEffect, useRef } from 'react';
import { getUserFromSession } from '~/utils/auth.server';
import { createHiddenFields } from '~/utils/sagepay';
import { Transaction } from '~/models/transaction';
import { Coupon } from '~/models/coupon';
import { getCurrentPlan } from '~/utils/plans';
import { PlanModel } from '~/models/plan';
import FrontLayout from '~/components/FrontLayout';
import { COUNTRIES, US_STATES } from '~/utils/constants';
import type { LoaderFunction } from '@remix-run/node';
import { isAfter } from 'date-fns';

type LoaderData = {
  plan: any;
  user: any;
  currentPlan?: any;
  error?: string;
  US_STATES: string[];
  COUNTRIES: Array<{ code: string; name: string }>;
  isExpired?: boolean;
};

export const loader: LoaderFunction = async ({ request }) => {
  // Get URL parameters
  const url = new URL(request.url);
  const planId = url.searchParams.get('plan');

  if (!planId) {
    return redirect('/');
  }

  const user = await getUserFromSession(request);
  if (!user) {
    return redirect(`/buy-plan-reg?plan=${planId}`);
  }

  // Check if user already has an active plan using the utility
  const currentPlan = await getCurrentPlan(user._id);
  if (currentPlan) {
    const now = new Date();
    const expiryDate = new Date(currentPlan.expiryDate);

    // Check if plan is still valid (not expired)
    if (isAfter(expiryDate, now) && currentPlan.planId.price > 0) {
      return json<LoaderData>({
        error: 'You already have an active paid plan',
        currentPlan,
        user,
        plan: currentPlan.planId,
        US_STATES,
        COUNTRIES,
        isExpired: false,
      });
    }
  }

  // Get the plan details
  const plan = await PlanModel.findOne({
    _id: planId,
    isActive: true,
    isDeleted: false,
  });

  if (!plan) {
    return redirect('/');
  }

  return json<LoaderData>({
    plan,
    user,
    currentPlan,
    US_STATES,
    COUNTRIES,
    isExpired: currentPlan ? true : false,
  });
};

export async function action({ request }) {
  const user = await getUserFromSession(request);
  if (!user) {
    return redirect('/login');
  }

  const formData = await request.formData();
  const _action = formData.get('_action');

  // Handle coupon application
  if (_action === 'APPLY_COUPON') {
    const couponCode = (formData.get('couponCode') || '').toUpperCase();
    const planId = formData.get('planId');

    const coupon = await Coupon.findOne({
      code: couponCode,
      status: true,
      validFrom: { $lte: new Date() },
      validUntil: { $gte: new Date() },
    });

    if (!coupon) {
      return json({ error: 'Invalid or expired coupon' }, { status: 400 });
    }

    if (coupon.maxRedemptions && coupon.timesRedeemed >= coupon.maxRedemptions) {
      return json({ error: 'Coupon has reached maximum usage' }, { status: 400 });
    }

    const plan = await PlanModel.findById(planId);
    if (!plan) {
      return json({ error: 'Plan not found' }, { status: 400 });
    }

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

  // Handle payment initiation
  if (_action === 'SHOW_INVOICE') {
    const planId = formData.get('planId');
    const plan = await PlanModel.findById(planId);
    if (!plan) {
      return json({ messages: ['Plan not found'], status: 'ERROR' });
    }

    // Get form data
    const firstName = formData.get('firstName') || '';
    const lastName = formData.get('lastName') || '';
    const userEmail = formData.get('userEmail') || '';
    const addr1 = formData.get('addr1') || '';
    const addr2 = formData.get('addr2') || '';
    const city = formData.get('city') || '';
    const country = formData.get('country') || '';
    const postcode = formData.get('postcode') || '';
    const billingState = formData.get('billingState') || '';
    const amount = formData.get('amount') || plan.price.toString();
    const currency = 'GBP';

    if (!firstName || !lastName || !userEmail || !addr1 || !city || !country) {
      return json({ messages: ['Missing required fields'], status: 'ERROR' });
    }

    const vendorTxCode = `PLAN${Date.now()}`;
    const description = `${plan.name} Plan Purchase`;

    try {
      // Create transaction record
      const newTx = await Transaction.create({
        user: user._id,
        vendorTxCode,
        amount: parseFloat(amount),
        plan: plan._id,
        currency,
        description,
        billingSurname: lastName,
        billingFirstNames: firstName,
        billingAddress1: addr1,
        billingAddress2: addr2,
        billingCity: city,
        billingPostCode: postcode,
        billingCountry: country,
        billingState: country === 'US' ? billingState : '',
        customerEmail: userEmail,
        customerName: `${firstName} ${lastName}`,
        note: `Plan Purchase: ${plan._id}`,
      });

      // Build SagePay fields
      const sage_flds = {
        VendorTxCode: vendorTxCode,
        Amount: parseFloat(amount).toFixed(2),
        Currency: currency,
        Description: description,
        SuccessURL: process.env.SITE_URL + 'payment-response',
        FailureURL: process.env.SITE_URL + 'payment-response',
        BillingSurname: lastName,
        BillingFirstnames: firstName,
        BillingAddress1: addr1,
        BillingAddress2: addr2,
        BillingCity: city,
        BillingState: country === 'US' ? billingState : '',
        BillingPostCode: postcode,
        BillingCountry: country,
        DeliverySurname: lastName,
        DeliveryFirstnames: firstName,
        DeliveryAddress1: addr1,
        DeliveryAddress2: addr2,
        DeliveryCity: city,
        DeliveryState: country === 'US' ? billingState : '',
        DeliveryPostCode: postcode,
        DeliveryCountry: country,
        VendorEMail: 'pradeep@klaspad.com',
        SendEMail: 1,
        CustomerEMail: userEmail,
        CustomerName: `${firstName} ${lastName}`,
      };

      // Create crypt
      const sageHiddenFields = createHiddenFields(sage_flds);
      if (sageHiddenFields.status === 0) {
        return json({ messages: [sageHiddenFields.message], status: 'ERROR' });
      }

      const sageOptions = {
        vendor: process.env.SAGEPAY_VENDOR,
        url: process.env.SAGEPAY_URL,
        protocol: process.env.SAGEPAY_PROTOCOL,
        success_url: process.env.SAGEPAY_SUCCESS_URL,
        failure_url: process.env.SAGEPAY_FAILURE_URL,
      };

      return json({
        status: 'OK',
        transactionId: newTx._id.toString(),
        vendorTxCode,
        amount: parseFloat(amount).toFixed(2),
        currency,
        description,
        firstName,
        lastName,
        userEmail,
        addr1,
        addr2,
        city,
        country,
        billingState,
        postcode,
        sageOptions,
        crypt: sageHiddenFields.crypt,
      });
    } catch (err) {
      console.error('SHOW_INVOICE error:', err);
      return json({ messages: ['Error creating transaction'], status: 'ERROR' });
    }
  }

  return null;
}

interface FetcherData {
  status?: 'OK' | 'ERROR';
  success?: boolean;
  error?: string;
  discountedPrice?: string;
  amount?: string;
  currency?: string;
  firstName?: string;
  lastName?: string;
  addr1?: string;
  addr2?: string;
  city?: string;
  postcode?: string;
  sageOptions?: {
    protocol: string;
    vendor: string;
    url: string;
  };
  crypt?: string;
}

export default function BuyPlan() {
  const { plan, user, currentPlan, error, US_STATES, COUNTRIES, isExpired } = useLoaderData<LoaderData>();
  const fetcher = useFetcher<FetcherData>();
  const [country, setCountry] = useState('GB');
  const [isUS, setIsUS] = useState(false);
  const [showInvoice, setShowInvoice] = useState(false);
  const [invoiceData, setInvoiceData] = useState<FetcherData | null>(null);
  const invoiceFormRef = useRef<HTMLFormElement>(null);
  const actionResponse = useActionData();

  useEffect(() => {
    if (country === 'US') {
      setIsUS(true);
    } else {
      setIsUS(false);
    }
  }, [country]);

  // Listen for invoice response
  useEffect(() => {
    if (fetcher.data?.status === 'OK') {
      setInvoiceData(fetcher.data);
      setShowInvoice(true);
    }
  }, [fetcher.data]);

  // If user already has a paid plan
  if (error) {
    return (
      <FrontLayout>
        <section className="expand-container">
          <div className="container">
            <div className="alert alert-warning">
              <h4>You already have an active plan</h4>
              <p>Current Plan: {currentPlan.planId.name}</p>
              <p>Valid until: {new Date(currentPlan.expiryDate).toLocaleDateString()}</p>
              <p>Please wait for your current plan to expire before purchasing a new one.</p>
              <p>
                If you need to cancel your current plan or have any other requests, please contact us at <a href="mailto:support@klaspad.com">support@klaspad.com</a>.
              </p>
              <Link to="/portal" className="btn btn-primary">
                Dashboard
              </Link>
            </div>
          </div>
        </section>
      </FrontLayout>
    );
  }

  // If user has an expired plan, show warning but allow purchase
  const ExpiredPlanWarning = currentPlan && isExpired && (
    <div className="alert alert-info mb-4">
      <h5>Your Previous Plan</h5>
      <p>Plan: {currentPlan.planId.name}</p>
      <p>Expired on: {new Date(currentPlan.expiryDate).toLocaleDateString()}</p>
      <p>You can now purchase a new plan.</p>
    </div>
  );

  // On "Proceed" in the invoice modal, submit hidden form to SagePay
  const proceedToGateway = () => {
    if (invoiceFormRef.current) {
      invoiceFormRef.current.submit();
    }
  };

  return (
    <FrontLayout>
      <section className="document-container bg-light">
        <div className="container">
          <div className="row d-grid d-flex justify-content-center">
            <div className="col-lg-8 col-md-12 col-sm-12 col-xs-12">
              <h4>Subscribe to {plan.name}</h4>

              {ExpiredPlanWarning}

              <div className="card">
                <div className="card-body">
                  {/* Plan Details */}
                  <div className="price mb-4">
                    <h3>
                      <i className="fas fa-pound-sign"></i> {plan.price}
                      {plan.isMonthly && <small>/mo</small>}
                    </h3>
                  </div>

                  <div className="features mb-4">
                    <ul className="list-unstyled">
                      <li>
                        <i className="fas fa-check text-success"></i> {plan.maxDocuments} Documents
                      </li>
                      <li>
                        <i className="fas fa-check text-success"></i> {plan.maxFileSize}MB File Size
                      </li>
                      <li>
                        <i className="fas fa-check text-success"></i> {plan.maxUrls} URLs
                      </li>
                    </ul>
                  </div>

                  {/* Billing Form */}
                  <div className="billing-form mt-4">
                    <h5>These details will be used for payment method</h5>
                    <h6 className="mb-4">Billing Details</h6>

                    <fetcher.Form method="post">
                      <input type="hidden" name="_action" value="SHOW_INVOICE" />
                      <input type="hidden" name="planId" value={plan._id} />

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
                          <input type="text" name="addr1" className="form-control" required placeholder="e.g. 123 Main Street" defaultValue={user.addressLine1} />
                        </div>

                        <div className="col-md-6">
                          <label className="form-label">City</label>
                          <input type="text" name="city" className="form-control" required defaultValue={user.city} />
                        </div>

                        <div className="col-md-6">
                          <label className="form-label">Postcode</label>
                          <input type="text" name="postcode" className="form-control" required defaultValue={user.postcode} />
                        </div>

                        <div className="col-md-6">
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
                          <button type="submit" className="btn btn-primary w-100">
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

      {/* Invoice Modal */}
      {showInvoice && invoiceData?.status === 'OK' && (
        <div className="modal fade show" style={{ display: 'block' }} role="dialog">
          <div className="modal-dialog modal-lg" role="document">
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
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowInvoice(false)}>
                  Cancel
                </button>
                <button type="button" className="btn btn-primary" onClick={proceedToGateway}>
                  Proceed to Payment
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Hidden SagePay Form */}
      {invoiceData?.status === 'OK' && (
        <form ref={invoiceFormRef} method="POST" action={invoiceData.sageOptions.url} style={{ display: 'none' }}>
          <input type="hidden" name="VPSProtocol" value={invoiceData.sageOptions.protocol} />
          <input type="hidden" name="TxType" value="PAYMENT" />
          <input type="hidden" name="Vendor" value={invoiceData.sageOptions.vendor} />
          <input type="hidden" name="Crypt" value={invoiceData.crypt} />
        </form>
      )}
    </FrontLayout>
  );
}
