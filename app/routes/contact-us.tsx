import { useLoaderData, useFetcher, useActionData, Form } from '@remix-run/react';
import FrontLayout from '~/components/FrontLayout';
import { useEffect, useState } from 'react';
import { loginValidator } from '~/utils/validators';
import { redirect, json } from '@remix-run/node';
import { getUserFromSession, createUserSession, login } from '~/utils/auth.server';
import { User } from '~/models/user';
import DisplayActionResponse from '~/components/ui/DisplayActionResponse';
import { ContactUsModel } from '~/models/contact'; // Import ContactUs model
import { frontendLinks } from '~/utils/frontend-links';

export const links = frontendLinks;

const defaultPassword = 'Member@123!';
const SITENAME = process.env.SITENAME;

export async function loader({ request, params }) {
  let user = await getUserFromSession(request);
  console.log('user', user);

  return { user, SITENAME };
}

export async function action({ request }) {
  const formData = await request.formData();
  const { name, email, phone, company, message } = Object.fromEntries(formData);

  // Validation
  const errors = [];
  if (!name) errors.push('Name is required.');
  if (!email) errors.push('Email is required.');
  if (!phone) errors.push('Phone is required.');
  if (!company) errors.push('Company/Institute is required.');
  if (!message) errors.push('Message is required.');

  if (errors.length > 0) {
    return json({ messages: errors, status: 'ERROR' });
  }

  // Save to database
  try {
    await ContactUsModel.create({ name, email, phone, company, message });
    return json({
      messages: [
        'Thank you for reaching out to us! We have successfully received your message. A member of our team will review your inquiry and get back to you as soon as possible.',
      ],
      status: 'OK',
    });
  } catch (error) {
    return json({ messages: ['An error occurred while sending your message.'], status: 'ERROR' });
  }
}

const ContactPage = () => {
  const { user } = useLoaderData();
  const [formSubmitted, setFormSubmitted] = useState(false);
  const actionResponse = useActionData();

  useEffect(() => {
    console.log('actionResponse', actionResponse);
    if (actionResponse && actionResponse.status == 'OK') {
      setFormSubmitted(true);
    }
  }, [actionResponse]);

  return (
    <FrontLayout>
      <div>
        <div>
          
          {/*banner part end*/}
          <section className="contact-container">
            <div className="container">
              <div className="row">
                <div className="col-lg-6 col-md-6 col-sm-12 col-xs-12 contact-rightbar">
                  {formSubmitted ? (
                    <div className="alert alert-success" role="alert">
                      Thank you for reaching out to us! We have successfully received your message. A member of our team will review your inquiry and get back to you as soon as
                      possible.
                    </div>
                  ) : (
                    <Form method="post" name="contactForm" id="contactForm">
                      <div className="row">
                        <h3>Contact Us</h3>
                        {actionResponse?.status && <DisplayActionResponse actionResponse={actionResponse} />}
                        <div className="col-lg-6">
                          <label>Full Name</label>
                          <input type="text" className="form-control input-field" name="name" required />
                        </div>
                        <div className="col-lg-6">
                          <label>Email</label>
                          <input type="email" className="form-control input-field" name="email" required />
                        </div>
                        <div className="col-lg-6">
                          <label>Phone</label>
                          <input type="tel" className="form-control input-field" name="phone" required />
                        </div>
                        <div className="col-lg-6">
                          <label>Company/Institute</label>
                          <input type="text" className="form-control input-field" name="company" required />
                        </div>
                        <div className="col-lg-12">
                          <label>Message</label>
                          <textarea rows={5} name="message" className="form-control textarea-input rounded-0" required defaultValue={''} />
                        </div>
                        <div className="g-recaptcha" data-sitekey="6LffibEZAAAAAIBcerLsdy3c7_dcVyNfVZbeLjTb" />
                        <div className="col-lg-12 col-msg-12 col-sm-12 col-xs-12 mt-4">
                          <button type="submit" name="submit" value="Submit" className="document-btn">
                            Submit
                          </button>
                        </div>
                      </div>
                    </Form>
                  )}
                </div>
                <div className="col-lg-6 col-md-6 col-sm-12 col-xs-12 contact-leftbar">
                  <iframe
                    src="https://www.google.com/maps/embed?pb=!1m16!1m12!1m3!1d2484.2206089640135!2d0.06166377641914261!3d51.49081901191473!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!2m1!1s1004%20The%20Vista%20Building%2030%20Calderwood%20Street%20London%20SE18%206JH%20%20!5e0!3m2!1sen!2sin!4v1753357741050!5m2!1sen!2sin"
                    className="h-100"
                    width="100%"
                    height={450}
                    style={{ border: 0 }}
                    allowFullScreen
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                  />
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </FrontLayout>
  );
};

export default ContactPage;
