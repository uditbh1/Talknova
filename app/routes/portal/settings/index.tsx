import { useLoaderData, useFetcher, useActionData } from '@remix-run/react';
import { redirect, json } from '@remix-run/node';
import { Link } from '@remix-run/react';
import DisplayActionResponse from '~/components/ui/DisplayActionResponse';
import SubmitButton from '~/components/ui/SubmitBtn';
import { useEffect } from 'react';
import { Settings } from '~/models/settings';
import { getUserFromSession, requireUserSession } from '~/utils/auth.server';

export async function loader({ request }) {
  let user = await getUserFromSession(request);
  if (!user) return redirect('/login');

  const data = await Settings.getAllSettings();

  console.log(data);

  return { user, data };
}

export async function action({ request }) {
  const user = await getUserFromSession(request); // Ensure the user is authenticated
  if (!user) return redirect(`/login`);

  const formData = await request.formData();
  const { AI_MODEL, AI_TEMPERATURE } = Object.fromEntries(formData);

  try {
    // Save the AI_MODEL setting
    await Settings.findOneAndUpdate(
      { key: 'AI_MODEL' }, // Find the AI_MODEL setting
      { value: AI_MODEL }, // Update its value
      { upsert: true, new: true } // Create it if not found
    );

    // Save the AI_TEMPERATURE setting
    await Settings.findOneAndUpdate(
      { key: 'AI_TEMPERATURE' }, // Find the AI_TEMPERATURE setting
      { value: AI_TEMPERATURE }, // Update its value
      { upsert: true, new: true } // Create it if not found
    );

    return json({ messages: ['Settings updated successfully'], status: 'OK' });
  } catch (error) {
    console.error('Error updating settings:', error);
    return json({ messages: ['Failed to update settings'], status: 'ERROR' });
  }
}

export default function SettingsPage() {
  const { user, data } = useLoaderData(); // Load the settings data
  const actionResponse = useActionData(); // Get action response
  const fetcher = useFetcher();

  useEffect(() => {
    feather.replace();
  }, [data]);

  // Predefined options for AI_MODEL
  const aiModelOptions = [
    { label: 'gpt-4o-mini (latest)', value: 'gpt-4o-mini' },
    { label: 'o1-preview (latest)', value: 'o1-preview' },
    { label: 'o1-mini (latest)', value: 'o1-mini' },
  ];

  return (
    <>
      <div className="row">
        <div className="col-lg-12 col-md-12 col-12">
          {/* Page header */}
          <div className="d-flex justify-content-between align-items-center mb-5">
            <div className="mb-2 mb-lg-0">
              <h3 className="mb-0 text-white">System Settings</h3>
            </div>
          </div>
        </div>
      </div>

      <div className="row ">
        <div className="col-xl-12 col-12 mb-5">
          {/* card */}
          <div className="card">
            {/* card header */}
            <div className="card-header ">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <h4 className="mb-0">Settings</h4>
                </div>
              </div>
            </div>
            {/* table */}
            <div className="card-body">
              {/* Display any action responses */}
              {actionResponse && actionResponse.status == 'ERROR' && <DisplayActionResponse actionResponse={actionResponse} />}

              <div className="mb-10 mt-8">
                <div className="row">
                  {/* Form */}
                  <fetcher.Form method="post">
                    {/* AI_MODEL Dropdown */}
                    <div className="form-group mb-5 row">
                      <label htmlFor="AI_MODEL" className="col-sm-3 col-form-label">
                        AI Model
                      </label>
                      <div className="col-sm-9">
                        <select
                          id="AI_MODEL"
                          name="AI_MODEL"
                          className="form-control"
                          defaultValue={data['AI_MODEL']} // Pre-fill with current setting value
                        >
                          {aiModelOptions.map(option => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* AI_TEMPERATURE Input */}
                    <div className="form-group row">
                      <label htmlFor="AI_TEMPERATURE" className="col-sm-3 col-form-label">
                        AI Temperature
                      </label>
                      <div className="col-sm-9">
                        <input
                          type="number"
                          step="0.1"
                          min="0.1"
                          max="10"
                          id="AI_TEMPERATURE"
                          name="AI_TEMPERATURE"
                          className="form-control"
                          defaultValue={data['AI_TEMPERATURE']} // Pre-fill with current setting value
                        />
                      </div>
                    </div>

                    {/* Submit button */}
                    <div className="d-grid d-flex justify-content-between mt-4">
                      <div>
                        <SubmitButton className="btn btn-primary" />
                      </div>
                    </div>
                  </fetcher.Form>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
