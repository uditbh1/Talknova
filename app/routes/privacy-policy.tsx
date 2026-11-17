import { Link, useLoaderData } from '@remix-run/react';
import FrontLayout from '~/components/FrontLayout';
import { getUserFromSession } from '~/utils/auth.server';
import { frontendLinks } from '~/utils/frontend-links';

export const links = frontendLinks;

export async function loader({ request, params }) {
  let user = await getUserFromSession(request);
  return { user };
}

export default function PrivacyPolicy() {
  const { user } = useLoaderData();
  
  return (
    <FrontLayout>
      <section className="home-banner-container inner-banner">
        <div className="container-fluid">
          <div className="row">
            <div className="col-lg-12 col-md-12 col-sm-12 col-xs-12">
              <h1>Privacy Policy – Talknova Limited</h1>
            </div>
          </div>
        </div>
      </section>

      <section className="privacy-container">
        <div className="container">
          <p><strong>Effective Date</strong>: 24/01/2025</p>
        <p>Talknova Limited ("Talknova", "we", "us", "our") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, store, and protect your personal data when you visit our website, sign up for our services, or use our AI chatbot platform on a Software-as-a-Service (SaaS) model.</p>
        <h3>1. Who We Are</h3>
        <p>Talknova Limited is a company registered in the United Kingdom, providing AI-powered chat agent solutions for websites on a SaaS basis.</p>
        <p class="mb-0"><strong>Company Registration Number</strong>:15284520</p>
         <p class="mb-0"><strong>Registered Address</strong>:1004, The Vista Building, 30 Calderwood Street, London SE18 6JH </p>
         <p class="mb-0"><strong>Email</strong>:admin@talknova.ai </p>
         <p><strong>Data Controller</strong>:Talknova Limited
        </p>
        <h3>2. What Information We Collect</h3>
        <p>We collect and process the following types of personal data:</p>
        <p><strong> a) From Website Visitors:</strong></p>
        <ul>
            <li>Name, email, and contact details (via contact forms or chat)</li>
            <li>IP address and browser/device data</li>
            <li>Cookies and tracking information</li>
        </ul>
        <p><strong> b) From Customers and Trial Users:</strong></p>
        <ul>
            <li>Company name, contact person, billing details</li>
            <li>Login credentials (email, encrypted passwords)</li>
            <li>Chatbot usage data (interactions, analytics, preferences)</li>
            <li>End-user chat interactions (if enabled)</li>
        </ul>

         <p><strong> c) From End-Users (Your Customers):</strong></p>
        <ul>
            <li>Limited personal data (chat content) depending on how you configure your chatbot</li>
            <li>We process this data strictly as a <strong>data processor</strong> on your behalf</li>
        </ul>

        <h3>3. Legal Bases for Processing</h3>
        <p>We process your data under the following lawful bases:</p>
        <ul>
            <li><strong>Consent</strong>– when you opt-in or sign up</li>
            <li><strong>Contract</strong>– to deliver our services</li>
            <li><strong>Legitimate Interests</strong>– to improve service, prevent fraud, marketing (if permitted)</li>
            <li><strong>Legal Obligation</strong>– for regulatory or tax compliance</li>
        </ul>
	<h3>4. How We Use Your Data</h3>
    <p>We use your information to:</p>
        <ul>
        <li>Provide and manage our AI chatbot services</li>
        <li>Offer customer support and technical assistance</li>
        <li>Communicate updates, offers, or changes to services</li>
        <li>Monitor and improve our platform’s performance</li>
        <li>Comply with legal and financial obligations</li>
        </ul>

        <h3>5. Cookies and Tracking</h3>
        <p>We use cookies and similar technologies for</p>
        <ul>
            <li>Site analytics</li>
            <li>User experience improvements</li>
            <li>Marketing and re-targeting (where consented)</li>
        </ul>
        <p>You can manage cookie preferences in your browser or via our cookie banner.</p>
        <h3>6. Data Sharing and Third Parties</h3>
        <p class="mb-0">We do not sell your data.</p>
        <p>We may share data with trusted third-party service providers for:</p>
        <ul>
        <li>Cloud hosting</li>
        <li>Payment processing (e.g., Stripe, PayPal)</li>
        <li>Email communication (e.g., Mailchimp)</li>
        <li>Analytics (e.g., Google Analytics)</li>
        </ul>
        <p>All third parties are vetted and compliant with UK GDPR.</p>
        <h3>7. Data Retention</h3>
        <ul>
            <li>Customer data is retained for the duration of your subscription and up to 6 years for legal compliance.</li>
            <li>Chatbot data may be deleted upon request or automatically at the end of your service period.</li>
            <li>Free trial accounts inactive for 90 days may be deleted.</li>
        </ul>

        <h3>8. Your Rights (Under UK GDPR)</h3>
        <p>You have the right to:</p>
        <ul>
        <li>Access your data</li>
        <li>Correct or update data</li>
        <li>Request deletion (right to be forgotten)</li>
        <li>Object to processing</li>
        <li>Withdraw consent at any time</li>
        <li>Lodge a complaint with the <strong>ICO (Information Commissioner’s Office)</strong></li>
        </ul>
        <p>To exercise your rights, contact us at: [Insert DPO email or support contact]</p>
        <h3>9. Data Security</h3>
        <p>We implement strict measures to protect your data, including:</p>
        <ul>
            <li>Encryption (in-transit and at-rest)</li>
            <li>Access control and authentication</li>
            <li>Regular security audits</li>
        </ul>

        <h3>10. International Transfers</h3>
        <p>If data is transferred outside the UK (e.g., via US-based cloud services), we ensure adequate protection via <strong>Standard Contractual Clauses (SCCs)</strong> or <strong>UK IDTA</strong> mechanisms.</p>

        <h3>11. Children’s Privacy</h3>
        <p>Our services are not directed to individuals under 18. We do not knowingly collect data from minors.</p>

        <h3>12. Changes to This Policy</h3>
<p>We may update this Privacy Policy periodically. You will be notified of significant changes via email or through our website.</p>
<a href="/contact-us" className="document-btn"> Contact Us</a>
        </div>
      </section>
    </FrontLayout>
  );
} 