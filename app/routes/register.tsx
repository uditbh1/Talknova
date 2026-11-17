import { useLoaderData, useActionData, Form } from '@remix-run/react';
import FrontLayout from '~/components/FrontLayout';
import { useEffect, useState } from 'react';
import { Link } from '@remix-run/react';
import DisplayActionResponse from '~/components/ui/DisplayActionResponse';
import { redirect, json } from '@remix-run/node';
import { getUserFromSession } from '~/utils/auth.server';
import { User } from '~/models/user';
import { sendWelcomeEmail } from '~/utils/email.server';
import { assignFreePlanToUser } from '~/utils/plans';
import { frontendLinks } from '~/utils/frontend-links';
//import countriesJson from '~/utils/countries.json';

export const links = frontendLinks;

const defaultPassword = 'Member@123!';
const SITENAME = process.env.SITENAME;

export async function loader({ request }) {
  let user = await getUserFromSession(request);

  if (user) return redirect('/');

  // Fetch countries data
  // Dynamically import the JSON file
  const countriesModule = await import('/utils/countries.json');

  // Access the default export containing the JSON data
  const countriesData = countriesModule.default;

  // Now countriesData should be an array, and you can use map on it
  const countries = countriesData.map(country => country.name.common).sort();

  return { SITENAME, countries };
}

export async function action({ request }) {
  const user = await getUserFromSession(request);
  if (user) return redirect('/');

  const formData = await request.formData();
  const firstName = formData.get('firstName');
  const lastName = formData.get('lastName');
  const email = formData.get('email');
  const password = formData.get('password') || defaultPassword;
  const phone = formData.get('phone') || '0000000';
  const city = formData.get('city');
  const country = formData.get('country');
  const postcode = formData.get('postcode');

  // Validate email format
  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  if (!isEmailValid) return json({ messages: ['Invalid email or password.'], status: 'ERROR' });

  // Check if email already exists
  const emailExists = await User.findOne({ email }).lean();
  if (emailExists) return json({ messages: ['Email already in use.'], status: 'ERROR' });

  const today = new Date();

  // Prepare user data
  const data = {
    firstName,
    lastName,
    email,
    roles: ['CLIENT'],
    phone,
    password,
    city,
    postcode,
    country,
    dateOfJoining: today,
    image: 'avatar-fallback.jpg',
    courses: [],
  };

  // Create user in the database
  const response = await User.create(data);

  if (!response) return json({ messages: ['Unable to save data.'], status: 'ERROR' });

  // Assign FREE plan to new user
  try {
    await assignFreePlanToUser(response._id, response._id);
  } catch (planError) {
    console.error('Failed to assign free plan:', planError);
    // Don't fail registration if plan assignment fails - user is already saved
  }

  // Send welcome email
  try {
    await sendWelcomeEmail(response);
  } catch (emailError) {
    console.error('Failed to send welcome email:', emailError);
    // Don't fail registration if email fails
  }

  return json({ status: 'OK', messages: ['Your account has been created successfully. Please login.'] });
}

const RegisterPage = () => {
  const { SITENAME, countries } = useLoaderData();
  const actionResponse = useActionData();

  //useEffect if actionResponse is OK, clear the form
  useEffect(() => {
    if (actionResponse && actionResponse.status === 'OK') {
      document.querySelector('form').reset();
    }
  }, [actionResponse]);

  return (
    <FrontLayout>
      <section className="contact-container">
        <div className="container">
          <div className="document-block">
            <div className="row d-grid d-flex justify-content-center">
              <div className="col-lg-8 col-md-12 col-sm-12 col-xs-12">
                <Form method="post" className="login" data-discover="true">
                  <h3>Sign Up</h3>
                  <div className="card">
                    <div className="card-body">
                      {actionResponse && actionResponse.status === 'ERROR' && <DisplayActionResponse actionResponse={actionResponse} />}
                      {actionResponse && actionResponse.status === 'OK' && <DisplayActionResponse actionResponse={actionResponse} />}
                      <div className="row">
                        <div className="col-lg-6 mb-3">
                          <label className="form-label">First Name</label>
                          <input type="text" className="form-control" name="firstName" required />
                        </div>
                        <div className="col-lg-6 mb-3">
                          <label className="form-label">Last Name</label>
                          <input type="text" className="form-control" name="lastName" required />
                        </div>
                        <div className="col-lg-6 mb-3">
                          <label className="form-label">Email</label>
                          <input type="email" className="form-control" name="email" required />
                        </div>
                        <div className="col-lg-6 mb-3">
                          <label className="form-label">Password</label>
                          <input type="password" className="form-control" name="password" required defaultValue={defaultPassword} minLength="5" />
                        </div>
                        <div className="col-lg-6 mb-3">
                          <label className="form-label">Phone</label>
                          <input type="text" className="form-control" name="phone" required />
                        </div>
                        <div className="col-lg-6 mb-3">
                          <label className="form-label">City</label>
                          <input type="text" className="form-control" name="city" required />
                        </div>
                        <div className="col-lg-6 mb-3">
                          <label className="form-label">Postcode</label>
                          <input type="text" className="form-control" name="postcode" required />
                        </div>
                        <div className="col-lg-6 mb-3">
                          <label className="form-label">Country</label>
                          <select className="form-select" name="country" required>
                            <option value="">Select</option>
                            {countries &&
                              countries.map(country => (
                                <option key={country} value={country}>
                                  {country}
                                </option>
                              ))}
                          </select>
                        </div>
                        <div className="col-lg-12 mt-3 mb-3">
                          <button type="submit" className="document-btn">
                            Sign Up
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </Form>
                <div className="text-center mt-3">
                  <p>
                    By signing up, you agree to our <a href="terms-of-service">Terms of Service</a> and <a href="privacy-policy">Privacy Policy</a>.
                  </p>
                  <p>
                    Already have an account? <Link to="/login">Log in</Link>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </FrontLayout>
  );
};

export default RegisterPage;
