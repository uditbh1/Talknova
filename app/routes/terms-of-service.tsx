import { Link, useLoaderData } from '@remix-run/react';
import FrontLayout from '~/components/FrontLayout';
import { getUserFromSession } from '~/utils/auth.server';
import { frontendLinks } from '~/utils/frontend-links';

export const links = frontendLinks;

type LoaderData = {
  user: any; // Replace 'any' with your actual user type
};

export async function loader({ request, params }) {
  let user = await getUserFromSession(request);
  return { user };
}

export default function TermsOfService() {
  const { user } = useLoaderData<LoaderData>();

  return (
    <FrontLayout>
      <section className="home-banner-container inner-banner">
        <div className="container-fluid">
          <div className="row">
            <div className="col-lg-12 col-md-12 col-sm-12 col-xs-12">
              <h1>Terms and Conditions – Talknova Limited</h1>
            </div>
          </div>
        </div>
      </section>

      <section className="privacy-container">
        <div className="container">
          <p><strong>Effective Date</strong>: 24/01/2025</p>
        <p>Please read these Terms and Conditions ("Terms") carefully before using the services provided by <b>Talknova Limited</b> ("Talknova", "we", "us", or "our"). By creating an account, using our platform, or accessing our services, you agree to be bound by these Terms.
        </p>
<h3>1. Services Overview</h3>
        <p>Talknova provides AI-powered chat agents ("AI Agents") on a Software-as-a-Service (SaaS) basis, which may include chatbot creation, live chat integration, analytics, and limited website crawling features for content ingestion
        </p>
<h3>2. Eligibility and Account Registration</h3>
<p>To use our services, you must:</p>
<ul>
    <li>Be at least 18 years old</li>
    <li>Provide accurate, complete registration information</li>
    <li>Use the services solely for your business or authorized organization</li>
</ul>
<p>You are responsible for maintaining the confidentiality of your account credentials.</p>
<h3>3. Website Crawling Policy</h3>
<p>Our platform may offer automated web crawling to help train or update your AI chat agent. By using this feature, you agree to the following:</p>
<ul>
    <li><strong>You may only crawl websites you own or have full legal authority to access.</strong></li>
    <li>You <strong>must not crawl third-party websites</strong> without explicit written permission.</li>
    <li>You agree to indemnify and hold Talknova harmless for any misuse of this feature that violates intellectual property rights or terms of external websites.</li>
</ul>
<p>We reserve the right to suspend or terminate your account if unauthorized crawling is detected.</p>

<h3>4. Prohibited Content</h3>
<p>You agree not to upload, feed, or train your AI agent with any content that is:</p>
<ul>
    <li>Defamatory, derogatory, or discriminatory</li>
    <li>Politically sensitive or partisan</li>
    <li>Sexually explicit or suggestive</li>
    <li>Racist, xenophobic, or hate-promoting</li>
    <li>Violent, harassing, or threatening</li>
    <li>False, misleading, or deceptive</li>
</ul>
<p>We reserve the right to remove such content and suspend or terminate any account violating this policy.</p>
<h3>5. Intellectual Property</h3>
<p>All intellectual property rights in our platform, including software, content, designs, and trademarks, remain the exclusive property of Talknova Limited.</p>
<p>Clients retain rights to the content they input or upload, provided it complies with these Terms.</p>
<h3>6. Free Trial & Subscriptions</h3>
<p>We offer a one-month free trial. After this, a paid subscription is required. All billing terms are governed by our <a href="/refund-policy">Refund Policy</a>, which forms part of these Terms.</p>
<p>You may cancel your subscription at any time. Your account will remain active until the end of the current billing cycle.</p>
<h3>7. Data & Privacy</h3>
<p>We handle your data in accordance with our <a href="/privacy-policy">Privacy Policy</a>. You are responsible for complying with applicable data protection laws regarding your end-users’ data, especially if your AI agent interacts with them.</p>
<h3>8. Termination</h3>
<p>We may suspend or terminate your access to the service without notice if:</p>
<ul>
    <li>You violate these Terms</li>
    <li>Your use poses a legal or security risk</li>
    <li>Non-payment or chargeback occurs</li>
</ul>

<h3>9. Disclaimer of Warranties</h3>
<p>The service is provided “as is” and “as available.” We do not guarantee uptime, accuracy, or fitness for a particular purpose. While we work to ensure service reliability, we do not warrant that the service will be error-free or uninterrupted.</p>

<h3>10. Limitation of Liability</h3>
<p>To the maximum extent permitted by law, Talknova Limited shall not be liable for any indirect, incidental, or consequential damages arising out of or relating to the use or inability to use our services.</p>

<h3>11. Changes to Terms</h3>
<p>We may update these Terms from time to time. You will be notified via email or in-app notification. Continued use of the service constitutes acceptance of the updated Terms.</p>
<h3>12. Governing Law</h3>
<p>These Terms are governed by and construed in accordance with the laws of <strong>England and Wales</strong>. Any disputes will be subject to the exclusive jurisdiction of the courts of England.</p>
<a href="/contact-us" className="document-btn"> Contact Us</a>
        </div>
      </section>
    </FrontLayout>
  );
} 