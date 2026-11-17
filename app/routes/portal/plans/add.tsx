import { redirect, json } from '@remix-run/node';
import { useActionData } from '@remix-run/react';
import type { ActionFunction, LoaderFunction } from '@remix-run/node';

import { PlanModel } from '~/models/plan';
import { getUserFromSession } from '~/utils/auth.server';
import DisplayActionResponse from '~/components/ui/DisplayActionResponse';
import Form from './Form';

export const loader: LoaderFunction = async ({ request }) => {
  const user = await getUserFromSession(request);
  if (!user) return redirect('/login');
  return null;
};

export const action: ActionFunction = async ({ request }) => {
  const formData = await request.formData();

  const name = (formData.get('name') as string) || '';
  const price = parseFloat(formData.get('price') as string); // monthly
  const yearlyPrice = parseFloat(formData.get('yearlyPrice') as string); // yearly
  const billingCycle = (formData.get('billingCycle') as string) || 'MONTHLY';
  const maxDocuments = parseInt(formData.get('maxDocuments') as string);
  const maxFileSize = parseInt(formData.get('maxFileSize') as string);
  const maxUrls = parseInt(formData.get('maxUrls') as string);
  const isActive = formData.get('isActive') === 'on';
  const allowedAgents = parseInt((formData.get('allowedAgents') as string) || '1', 10);

  // ---- validation ----
  const errors: string[] = [];
  if (!name || name.trim().length < 3) errors.push('Name must be at least 3 characters.');
  if (isNaN(price) || price < 0) errors.push('Monthly price must be a valid non-negative number.');
  if (isNaN(yearlyPrice) || yearlyPrice < 0) errors.push('Yearly price must be a valid non-negative number.');
  if (!['MONTHLY', 'YEARLY'].includes(billingCycle)) errors.push('Invalid billing cycle.');
  if (isNaN(maxDocuments) || maxDocuments < 1) errors.push('Maximum documents must be at least 1.');
  if (isNaN(maxFileSize) || maxFileSize < 1) errors.push('Maximum file size must be at least 1MB.');
  if (isNaN(maxUrls) || maxUrls < 1) errors.push('Maximum URLs must be at least 1.');
  if (isNaN(allowedAgents) || allowedAgents < 1) errors.push('Allowed agents must be at least 1.');

  if (errors.length) return json({ messages: errors, status: 'ERROR' });

  try {
    // unique name check (case-insensitive, not deleted)
    const exists = await PlanModel.findOne({
      name: { $regex: new RegExp(`^${name}$`, 'i') },
      isDeleted: false,
    });
    if (exists) {
      return json({
        messages: ['A plan with this name already exists'],
        status: 'ERROR',
      });
    }

    await PlanModel.create({
      name,
      price, // monthly price
      yearlyPrice,
      billingCycle,
      maxDocuments,
      maxFileSize,
      maxUrls,
      isActive,
      allowedAgents,
      // isMonthly ignored (schema default covers it)
    });

    return redirect('/portal/plans');
  } catch (err) {
    console.error('Create plan error:', err);
    return json({
      messages: ['Failed to create plan. Please try again.'],
      status: 'ERROR',
    });
  }
};

export default function AddPlan() {
  const actionResponse = useActionData();

  return (
    <>
      <div className="row">
        <div className="col-lg-12 col-md-12 col-12">
          <div className="d-flex justify-content-between align-items-center mb-5">
            <div className="mb-2 mb-lg-0">
              <h3 className="mb-0 text-white">Add Plan</h3>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-body">
          {actionResponse && actionResponse.status === 'ERROR' && <DisplayActionResponse actionResponse={actionResponse} />}
          <Form />
        </div>
      </div>
    </>
  );
}
