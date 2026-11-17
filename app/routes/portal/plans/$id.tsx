import { redirect, json } from '@remix-run/node';
import { useActionData, useLoaderData, useNavigate } from '@remix-run/react';
import type { LoaderFunction, ActionFunction } from '@remix-run/node';

import { PlanModel } from '~/models/plan';
import { getUserFromSession } from '~/utils/auth.server';
import Form from './Form';

type LoaderData = { plan: any };

export const loader: LoaderFunction = async ({ request, params }) => {
  const user = await getUserFromSession(request);
  if (!user) return redirect('/login');

  const plan = await PlanModel.findById(params.id);
  if (!plan) throw new Response('Plan not found', { status: 404 });

  return json<LoaderData>({ plan });
};

export const action: ActionFunction = async ({ request, params }) => {
  const formData = await request.formData();

  const name = (formData.get('name') as string) || '';
  const price = parseFloat(formData.get('price') as string); // monthly
  const yearlyPrice = parseFloat(formData.get('yearlyPrice') as string); // yearly
  const billingCycle = (formData.get('billingCycle') as string) || 'MONTHLY';
  const maxDocuments = parseInt(formData.get('maxDocuments') as string, 10);
  const maxFileSize = parseInt(formData.get('maxFileSize') as string, 10);
  const maxUrls = parseInt(formData.get('maxUrls') as string, 10);
  const isActive = formData.get('isActive') === 'on';
  const allowedAgents = parseInt((formData.get('allowedAgents') as string) || '1', 10);

  // ---- validation ----
  const messages: string[] = [];
  if (!name || name.trim().length < 3) messages.push('Name must be at least 3 characters.');
  if (isNaN(price) || price < 0) messages.push('Monthly price must be a valid non‑negative number.');
  if (isNaN(yearlyPrice) || yearlyPrice < 0) messages.push('Yearly price must be a valid non‑negative number.');
  if (!['MONTHLY', 'YEARLY'].includes(billingCycle)) messages.push('Invalid billing cycle.');
  if (isNaN(maxDocuments) || maxDocuments < 1) messages.push('Maximum documents must be at least 1.');
  if (isNaN(maxFileSize) || maxFileSize < 1) messages.push('Maximum file size must be at least 1MB.');
  if (isNaN(maxUrls) || maxUrls < 1) messages.push('Maximum URLs must be at least 1.');
  if (isNaN(allowedAgents) || allowedAgents < 1) messages.push('Allowed agents must be at least 1.');

  if (messages.length) return json({ status: 'ERROR', messages }, { status: 400 });

  try {
    const plan = await PlanModel.findById(params.id);
    if (!plan) throw new Error('Plan not found');

    // You said default plans should not have name/billing stuff changed
    if (!plan.isDefault) {
      plan.name = name;
      plan.billingCycle = billingCycle;
    }

    // Always updatable
    plan.price = price;
    plan.yearlyPrice = yearlyPrice;
    plan.maxDocuments = maxDocuments;
    plan.maxFileSize = maxFileSize;
    plan.maxUrls = maxUrls;
    plan.isActive = isActive;
    plan.allowedAgents = allowedAgents;

    await plan.save(); // full validation & middleware. :contentReference[oaicite:0]{index=0}

    return redirect('/portal/plans');
  } catch (err) {
    console.error('Update plan error:', err);
    return json({ status: 'ERROR', messages: ['Failed to update plan. Please try again.'] }, { status: 400 });
  }
};

export default function EditPlan() {
  const { plan } = useLoaderData<LoaderData>();
  const actionData = useActionData<any>();
  const navigate = useNavigate();

  return (
    <>
      <div className="row mb-4">
        <div className="col-lg-12">
          <div className="d-flex justify-content-between align-items-center">
            <h3 className="mb-0">
              Edit Plan: {plan.name}
              {plan.isDefault && <span className="badge bg-info ms-2">Default Plan</span>}
            </h3>
            <button onClick={() => navigate('/portal/plans')} className="btn btn-secondary">
              Back to Plans
            </button>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-body">
          {/* Form component you already use */}
          <Form plan={plan} isEditing={true} />
        </div>
      </div>
    </>
  );
}
