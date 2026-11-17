import { Link, useLoaderData } from '@remix-run/react';
import FrontLayout from '~/components/FrontLayout';
import { getUserFromSession } from '~/utils/auth.server';
import { frontendLinks } from '~/utils/frontend-links';

export const links = frontendLinks;

export async function loader({ request, params }) {
  let user = await getUserFromSession(request);
  return { user };
}

export default function RefundPolicy() {
  const { user } = useLoaderData();

  return (
    <FrontLayout>
      <section className="home-banner-container inner-banner">
        <div className="container-fluid">
          <div className="row">
            <div className="col-lg-12 col-md-12 col-sm-12 col-xs-12">
              <h1>Refund Policy – Talknova Limited</h1>
            </div>
          </div>
        </div>
      </section>

      <section className="privacy-container">
        <div className="container">
          <p><strong>Effective Date</strong>: 24/01/2025</p>
        <p>At Talknova Limited, we are committed to delivering high-quality AI chatbot services and ensuring transparency in how our subscriptions work. This Refund Policy outlines our terms regarding payments, cancellations, and refunds.</p>
        <h3>1. Free Trial</h3>
        <p>We offer a <strong>one-month free trial</strong> for all new users. During this period, you can access our platform, explore its features, and evaluate its fit for your business at no cost.</p>
        <p>No payment is required to begin the trial, and you may cancel at any time during the trial period without being charged.</p>
        <h3>2. Subscription & Billing</h3>
        <p>After the free trial ends, your subscription will automatically begin, and your selected payment method will be charged based on the plan you have chosen.</p>
        <p>Subscriptions are billed in advance on a recurring monthly or annual basis (depending on your selection).</p>
        <h3>3. Refunds</h3>
        <p><strong>We do not offer refunds</strong> for any subscription fees once a billing cycle has started.</p>
        <p>By subscribing after the free trial, you acknowledge and agree to this no-refund policy, as ample time is provided to evaluate our service during the trial period.</p>
        <p>This applies to:</p>
        <ul>
            <li>Monthly and annual subscriptions</li>
            <li>Partial usage</li>
            <li>User inaction (e.g., forgetting to cancel before renewal)</li>
        </ul>
        <h3>4. Cancellations</h3>
        <p>You may cancel your subscription <strong>at any time</strong> through your account dashboard or by contacting our support team.</p>
<ul>
    <li><strong>If cancelled, your service will remain active until the end of the current billing period</strong>, after which no further charges will be made.</li>
    <li>Cancellations take effect at the end of your current billing cycle. No pro-rata refunds will be issued for unused time.</li>
</ul>
<h3>5. Exceptions</h3>
<p>In rare and exceptional cases (e.g., billing errors or fraudulent activity), we may, at our sole discretion, issue a refund. These requests are evaluated individually.</p>
<p>To inquire about such a case, please </p>
<a href="/contact-us" className="document-btn"> Contact Us</a>
        </div>
      </section>
    </FrontLayout>
  );
} 