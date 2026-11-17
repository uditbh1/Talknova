import { useLoaderData, useActionData } from '@remix-run/react';
import DisplayActionResponse from '~/components/ui/DisplayActionResponse';
import { getUserFromSession, requireUserSession } from '~/utils/auth.server';
import FormView from './Form';
import { redirect, json } from '@remix-run/node';
import { EmailTemplate } from '~/models/emailtemplate';

export async function loader({ request }) {
  await requireUserSession(request);
  let user = await getUserFromSession(request);
  if (!user) return redirect('/login');

  return { user };
}

export async function action({ request }) {
  const user = await getUserFromSession(request);
  if (!user) return redirect(`/login`);

  const formData = await request.formData();
  const { name, uniqueId, subject, body } = Object.fromEntries(formData);

  // Validation
  if (!name) return json({ messages: ['Template name is required.'], status: 'ERROR' });
  if (!subject) return json({ messages: ['Subject is required.'], status: 'ERROR' });
  if (!body) return json({ messages: ['Email body is required.'], status: 'ERROR' });

  // Generate uniqueId from name if not provided
  const finalUniqueId = uniqueId || name.toUpperCase().replace(/\s+/g, '_');

  // Check if uniqueId already exists
  const existingTemplate = await EmailTemplate.findOne({ uniqueId: finalUniqueId }).lean();
  if (existingTemplate) {
    return json({ messages: ['A template with this unique ID already exists.'], status: 'ERROR' });
  }

  try {
    // Create the email template
    await EmailTemplate.create({
      name,
      uniqueId: finalUniqueId,
      subject,
      body,
      status: true,
    });

    return redirect(`/portal/email-templates`);
  } catch (error) {
    console.error('Error creating template:', error);
    return json({
      messages: ['Unable to save email template. Please try again.'],
      status: 'ERROR',
    });
  }
}

export default function Index() {
  const actionResponse = useActionData();

  return (
    <>
      <div className="row">
        <div className="col-lg-12 col-md-12 col-12">
          {/* Page header */}
          <div className="d-flex justify-content-between align-items-center mb-5">
            <div className="mb-2 mb-lg-0">
              <h3 className="mb-0 text-white">Add Email Template</h3>
            </div>
          </div>
        </div>
      </div>

      <div className="row">
        <div className="col-xl-12 col-12 mb-5">
          {/* card  */}
          <div className="card">
            {/* card header  */}

            {/* form  */}
            <div className="card-body">
              {actionResponse?.status === 'ERROR' && <DisplayActionResponse actionResponse={actionResponse} />}
              <FormView />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
