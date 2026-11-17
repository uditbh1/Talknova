import { useActionData, useLoaderData } from '@remix-run/react';
import FormView from './Form';
import { getUserFromSession, requireUserSession } from '~/utils/auth.server';
import { EmailTemplate } from '~/models/emailtemplate';
import DisplayActionResponse from '~/components/ui/DisplayActionResponse';
import { redirect, json } from '@remix-run/node';

export async function loader({ request, params }) {
  await requireUserSession(request);
  let user = await getUserFromSession(request);
  if (!user) return redirect('/login');

  const { id } = params;
  if (!id) throw new Error('Id not found');

  let data = await EmailTemplate.findById(id).lean();
  if (!data) throw new Error('Email template not found');

  return { user, data };
}

export async function action({ request, params }) {
  const user = await getUserFromSession(request);
  if (!user) return redirect(`/login`);

  const formData = await request.formData();
  const { _id, name, uniqueId, subject, body } = Object.fromEntries(formData);

  if (!_id) return json({ messages: ['Email template not found'], status: 'ERROR' });

  // Validation
  if (!name) return json({ messages: ['Template name is required.'], status: 'ERROR' });
  if (!subject) return json({ messages: ['Subject is required.'], status: 'ERROR' });
  if (!body) return json({ messages: ['Email body is required.'], status: 'ERROR' });

  // Check if uniqueId already exists (except for this template)
  const existingTemplate = await EmailTemplate.findOne({
    uniqueId,
    _id: { $ne: _id },
  }).lean();

  if (existingTemplate) {
    return json({ messages: ['A template with this unique ID already exists.'], status: 'ERROR' });
  }

  try {
    // Update the email template
    await EmailTemplate.findByIdAndUpdate(_id, {
      name,
      uniqueId,
      subject,
      body,
    });

    return redirect(`/portal/email-templates`);
  } catch (error) {
    console.error('Error updating template:', error);
    return json({
      messages: ['Unable to update email template. Please try again.'],
      status: 'ERROR',
    });
  }
}

export default function EditEmailTemplate() {
  const { data } = useLoaderData();
  const actionResponse = useActionData();

  return (
    <>
      <div className="container-fluid">
        <div className="row">
          <div className="col-lg-12 col-md-12 col-12">
            {/* Page header */}
            <div className="mb-5">
              <h3 className="mb-0 text-white">Update Email Template</h3>
            </div>
          </div>
        </div>
        <div>
          {/* row */}
          <div className="row">
            <div className="col-lg-12 col-12">
              <div className="card mb-4">
                <div className="card-body">
                  {actionResponse && actionResponse.status == 'ERROR' && <DisplayActionResponse actionResponse={actionResponse} />}
                  <div>
                    <FormView />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
