import { Form as RemixForm, useActionData, useNavigation } from '@remix-run/react';
import { useEffect, useState } from 'react';
import { toast } from 'react-toastify';

import SubmitBtn from '~/components/ui/SubmitBtn';
import CancelBackBtn from '~/components/ui/CancelBackBtn';

type FormProps = {
  plan?: {
    name: string;
    price: number; // monthly price
    yearlyPrice: number;
    billingCycle: 'MONTHLY' | 'YEARLY';
    maxDocuments: number;
    maxFileSize: number;
    maxUrls: number;
    isActive: boolean;
    allowedAgents?: number;
  };
  isEditing?: boolean;
};

type ActionData = {
  messages?: string[];
  status?: string;
};

export default function Form({ plan, isEditing = false }: FormProps) {
  const actionData = useActionData<ActionData>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === 'submitting';

  // show/hide price fields based on billingCycle for UX (schema still needs both)
  const [cycle, setCycle] = useState<'MONTHLY' | 'YEARLY'>(plan?.billingCycle || 'MONTHLY');

  useEffect(() => {
    if (actionData?.status === 'ERROR') {
      actionData.messages?.forEach(m => toast.error(m));
    }
  }, [actionData]);

  return (
    <RemixForm
      method="post"
      onSubmit={e => {
        const form = e.currentTarget;

        const p = parseFloat(form.price.value);
        const yp = parseFloat(form.yearlyPrice.value);
        const maxDocs = parseInt(form.maxDocuments.value);
        const maxSize = parseInt(form.maxFileSize.value);
        const maxUrls = parseInt(form.maxUrls.value);
        const agents = parseInt(form.allowedAgents.value);

        if (isNaN(p) || p < 0) {
          e.preventDefault();
          toast.error('Monthly price must be >= 0');
          return;
        }
        if (isNaN(yp) || yp < 0) {
          e.preventDefault();
          toast.error('Yearly price must be >= 0');
          return;
        }
        if (maxDocs < 1) {
          e.preventDefault();
          toast.error('Max documents must be at least 1');
          return;
        }
        if (maxSize < 1) {
          e.preventDefault();
          toast.error('Max file size must be at least 1MB');
          return;
        }
        if (maxUrls < 1) {
          e.preventDefault();
          toast.error('Max URLs must be at least 1');
          return;
        }
        if (agents < 1) {
          e.preventDefault();
          toast.error('Allowed agents must be at least 1');
          return;
        }
      }}>
      <div className="row g-3">
        <div className="col-md-3">
          <label className="form-label">Plan Name</label>
          <input type="text" name="name" className="form-control" defaultValue={plan?.name} required />
        </div>

        <div className="col-md-3">
          <label className="form-label">Billing Cycle</label>
          <select name="billingCycle" className="form-select" value={cycle} onChange={e => setCycle(e.target.value as 'MONTHLY' | 'YEARLY')}>
            <option value="MONTHLY">Monthly</option>
            <option value="YEARLY">Yearly</option>
          </select>
        </div>

        <div className="col-md-3">
          <label className="form-label">Monthly Price (£)</label>
          <input type="number" step="0.01" name="price" className="form-control" defaultValue={plan?.price} required />
        </div>

        <div className="col-md-3">
          <label className="form-label">Yearly Price (£)</label>
          <input type="number" step="0.01" name="yearlyPrice" className="form-control" defaultValue={plan?.yearlyPrice} required />
        </div>

        <div className="col-md-3">
          <label className="form-label">Allowed Agents</label>
          <select name="allowedAgents" className="form-select" defaultValue={plan?.allowedAgents ?? '1'}>
            {Array.from({ length: 10 }, (_, i) => i + 1).map(n => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>

        <div className="col-md-3">
          <label className="form-label">Max Documents</label>
          <input type="number" name="maxDocuments" className="form-control" defaultValue={plan?.maxDocuments} required />
        </div>

        <div className="col-md-3">
          <label className="form-label">Max File Size (MB)</label>
          <input type="number" name="maxFileSize" className="form-control" defaultValue={plan?.maxFileSize} required />
        </div>

        <div className="col-md-3">
          <label className="form-label">Max URLs</label>
          <input type="number" name="maxUrls" className="form-control" defaultValue={plan?.maxUrls} required />
        </div>

        <div className="col-12">
          <div className="form-check">
            <input type="checkbox" name="isActive" className="form-check-input" defaultChecked={plan?.isActive ?? true} id="isActive" />
            <label className="form-check-label" htmlFor="isActive">
              Active
            </label>
          </div>
        </div>

        <div className="col-12 d-flex gap-2">
          <SubmitBtn className="btn btn-primary" txt={isEditing ? 'Update Plan' : 'Create Plan'} fetcher={null} disabled={isSubmitting} />
          <CancelBackBtn to="/portal/plans" txt="Cancel" />
        </div>
      </div>
    </RemixForm>
  );
}
