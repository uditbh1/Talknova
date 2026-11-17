// app/routes/portal/plans/index.tsx
import { useLoaderData, Link, useFetcher } from '@remix-run/react';
import { json, redirect } from '@remix-run/node';
import { useState, useEffect } from 'react';
import { Modal } from 'react-bootstrap';
import { toast } from 'react-toastify';
import feather from 'feather-icons';

import type { LoaderFunction, ActionFunction } from '@remix-run/node';
import { PlanModel } from '~/models/plan';
import { getUserFromSession } from '~/utils/auth.server';
import ErrorBoundary from '~/components/ErrorBoundary';

export type Plan = {
  _id: string;
  name: string;
  price: number; // monthly price
  yearlyPrice: number; // yearly price
  billingCycle: 'MONTHLY' | 'YEARLY';
  maxDocuments: number;
  maxFileSize: number;
  maxUrls: number;
  allowedAgents: number;
  isDefault: boolean;
  isActive: boolean;
  isDeleted: boolean;
  defaultPlanType: string | null;
};

type LoaderData = {
  plans: Plan[];
};

export const loader: LoaderFunction = async ({ request }) => {
  const user = await getUserFromSession(request);
  if (!user) return redirect('/login');

  const plans = await PlanModel.find({ isDeleted: false }).sort({ defaultPlanType: 1, createdAt: -1 });
  return json<LoaderData>({ plans });
};

export const action: ActionFunction = async ({ request }) => {
  const formData = await request.formData();
  const _action = formData.get('_action') as string;
  const id = formData.get('id') as string;

  try {
    if (_action === 'toggleActive') {
      const plan = await PlanModel.findById(id);
      if (!plan) return json({ success: false, message: 'Plan not found' }, { status: 404 });

      plan.isActive = !plan.isActive;
      await plan.save();

      return json({
        success: true,
        message: `Plan ${plan.isActive ? 'activated' : 'deactivated'} successfully`,
      });
    }

    if (_action === 'delete') {
      const plan = await PlanModel.findById(id);
      if (!plan) return json({ success: false, message: 'Plan not found' }, { status: 404 });

      if (plan.isDefault) {
        return json({ success: false, message: 'Default plans cannot be deleted' }, { status: 400 });
      }

      plan.isDeleted = true;
      await plan.save();

      return json({ success: true, message: 'Plan deleted successfully' });
    }

    return json({ success: false, message: 'Invalid action' }, { status: 400 });
  } catch (err) {
    console.error('Plan action error:', err);
    return json({ success: false, message: 'An error occurred. Please try again.' }, { status: 500 });
  }
};

export default function PlansIndex() {
  const { plans } = useLoaderData<LoaderData>();
  const fetcher = useFetcher<any>();
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);

  // Feather icons refresh
  useEffect(() => {
    if (plans?.length) feather.replace();
  }, [plans]);

  // Toast feedback for actions
  useEffect(() => {
    if (fetcher.data?.message) {
      fetcher.data.success ? toast.success(fetcher.data.message) : toast.error(fetcher.data.message);
    }
  }, [fetcher.data]);

  const handleToggleActive = (plan: Plan) => {
    fetcher.submit({ _action: 'toggleActive', id: plan._id }, { method: 'post' });
  };

  const handleDelete = (plan: Plan) => {
    if (plan.isDefault) {
      toast.error('Default plans cannot be deleted');
      return;
    }
    setSelectedPlan(plan);
    setShowDeleteModal(true);
  };

  const confirmDelete = () => {
    if (selectedPlan) {
      fetcher.submit({ _action: 'delete', id: selectedPlan._id }, { method: 'post' });
      setShowDeleteModal(false);
    }
  };

  return (
    <>
      <div className="row">
        <div className="col-lg-12 col-md-12 col-12">
          <div className="d-flex justify-content-between align-items-center mb-5">
            <div className="mb-2 mb-lg-0">
              <h3 className="mb-0 text-white">Plans</h3>
            </div>
            <div>
              <Link className="btn btn-white" to="./add" prefetch="intent">
                Add
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="row">
        <div className="col-xl-12 col-12 mb-5">
          <div className="card">
            <div className="card-header">
              <div className="d-flex justify-content-between align-items-center">
                <h4 className="mb-0">Plans List</h4>
                <div>
                  <form onSubmit={e => e.preventDefault()}>
                    <div className="input-group">
                      <input className="form-control rounded-3" id="searchInput" placeholder="Search" />
                      <span className="input-group-append">
                        <button className="btn ms-n10 rounded-0 rounded-end" type="button">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width={15}
                            height={15}
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth={2}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="feather feather-search text-dark">
                            <circle cx={11} cy={11} r={8} />
                            <line x1={21} y1={21} x2="16.65" y2="16.65" />
                          </svg>
                        </button>
                      </span>
                    </div>
                  </form>
                </div>
              </div>
            </div>

            <div className="card-body">
              <div className="table-responsive table-card">
                <table className="table text-nowrap mb-0 table-centered table-hover">
                  <thead className="table-light">
                    <tr>
                      <th>Name</th>
                      <th>Monthly (£)</th>
                      <th>Yearly (£)</th>
                      <th>Cycle</th>
                      <th>Docs</th>
                      <th>File Size (MB)</th>
                      <th>URLs</th>
                      <th>Agents</th>
                      <th>Status</th>
                      <th>Options</th>
                    </tr>
                  </thead>
                  <tbody>
                    {plans.map(plan => (
                      <tr key={plan._id}>
                        <td>
                          {plan.name} {plan.isDefault && <span className="badge badge-info-soft ms-2">Default</span>}
                        </td>
                        <td>{plan.price === 0 ? 'FREE' : `£${plan?.price?.toFixed(2)}`}</td>
                        <td>{plan.yearlyPrice === 0 ? 'FREE' : `£${plan?.yearlyPrice?.toFixed(2)}`}</td>
                        <td>{plan.billingCycle}</td>
                        <td>{plan.maxDocuments}</td>
                        <td>{plan.maxFileSize}</td>
                        <td>{plan.maxUrls}</td>
                        <td>{plan.allowedAgents ?? 1}</td>
                        <td>
                          <a href="javascript:void(0);" onClick={() => handleToggleActive(plan)} className="text-muted">
                            {plan.isActive ? <span className="badge badge-success-soft">Active</span> : <span className="badge badge-danger-soft">Inactive</span>}
                          </a>
                        </td>
                        <td>
                          <Link to={`${plan._id}`} className="btn btn-ghost btn-icon btn-sm rounded-circle texttooltip" data-template="editOne">
                            <i data-feather="edit" className="icon-xs" />
                            <div id="editOne" className="d-none">
                              <span>Edit</span>
                            </div>
                          </Link>

                          {!plan.isDefault && (
                            <button onClick={() => handleDelete(plan)} className="btn btn-ghost btn-icon btn-sm rounded-circle texttooltip" data-template="deleteOne">
                              <i data-feather="trash-2" className="icon-xs" />
                              <div id="deleteOne" className="d-none">
                                <span>Delete</span>
                              </div>
                            </button>
                          )}

                          {plan.isActive && (
                            <Link to={`/buy-plan?plan=${plan._id}`} className="btn btn-primary btn-sm ms-2">
                              Subscribe
                            </Link>
                          )}
                        </td>
                      </tr>
                    ))}
                    {plans.length === 0 && (
                      <tr>
                        <td colSpan={10} className="text-center py-4">
                          No plans found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <Modal show={showDeleteModal} onHide={() => setShowDeleteModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Confirm Delete</Modal.Title>
        </Modal.Header>
        <Modal.Body>Are you sure you want to delete this plan?</Modal.Body>
        <Modal.Footer>
          <button className="btn btn-secondary" onClick={() => setShowDeleteModal(false)}>
            Cancel
          </button>
          <button className="btn btn-danger" onClick={confirmDelete}>
            Delete
          </button>
        </Modal.Footer>
      </Modal>
    </>
  );
}

export function PageErrorBoundary({ error }: { error: Error }) {
  return <ErrorBoundary error={error} />;
}
