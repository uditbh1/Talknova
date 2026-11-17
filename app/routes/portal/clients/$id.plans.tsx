import { useLoaderData, useFetcher } from '@remix-run/react';
import { json, redirect } from '@remix-run/node';
import { useState, useEffect } from 'react';
import { format, addDays } from 'date-fns';
import { Modal } from 'react-bootstrap';
import { PlanModel } from '~/models/plan';
import { User } from '~/models/user';
import { getUserFromSession } from '~/utils/auth.server';
import { getCurrentPlan, getPlanHistory, assignPlan } from '~/utils/plans';
import type { LoaderFunction, ActionFunction } from '@remix-run/node';
import { toast } from 'react-toastify';

type LoaderData = {
  client: {
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  availablePlans: Array<{
    _id: string;
    name: string;
    price: number;
    isMonthly: boolean;
  }>;
  currentPlan: any;
  planHistory: any[];
};

export const loader: LoaderFunction = async ({ request, params }) => {
  const user = await getUserFromSession(request);
  if (!user) return redirect('/login');

  const { id } = params;
  if (!id) throw new Error('Client ID is required');

  try {
    const [client, availablePlans, currentPlan, planHistory] = await Promise.all([
      User.findById(id).lean(),
      PlanModel.find({ isActive: true, isDeleted: false }).lean(),
      getCurrentPlan(id),
      getPlanHistory(id)
    ]);

    if (!client) {
      throw new Error('Client not found');
    }

    return json<LoaderData>({
      client,
      availablePlans,
      currentPlan,
      planHistory
    });
  } catch (error) {
    console.error('Client plans loader error:', error);
    throw new Error('Failed to load client plans data');
  }
};

export const action: ActionFunction = async ({ request, params }) => {
  const user = await getUserFromSession(request);
  if (!user) return redirect('/login');

  const formData = await request.formData();
  const data = Object.fromEntries(formData);
  
  try {
    if (data._action === 'assignPlan') {
      await assignPlan({
        clientId: params.id!,
        planId: data.planId as string,
        startDate: data.startDate ? new Date(data.startDate as string) : undefined,
        expiryDate: data.expiryDate ? new Date(data.expiryDate as string) : undefined,
        addedVia: 'ADMIN',
        addedBy: user._id,
        notes: data.notes as string
      });

      return json({ success: true, message: 'Plan assigned successfully' });
    }

    return json({ success: false, message: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Client plans action error:', error);
    return json({ 
      success: false, 
      message: 'Failed to process request' 
    }, { status: 500 });
  }
};

export default function ClientPlans() {
  const { client, availablePlans, currentPlan, planHistory } = useLoaderData<LoaderData>();
  const fetcher = useFetcher();
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<any>(null);

  useEffect(() => {
    if (fetcher.data?.success) {
      setShowAssignModal(false);
      toast.success(fetcher.data.message);
    } else if (fetcher.data?.message) {
      toast.error(fetcher.data.message);
    }
  }, [fetcher.data]);

  return (
    <>
      <div className="row">
        <div className="col-lg-12 col-md-12 col-12">
          <div className="d-flex justify-content-between align-items-center mb-5">
            <div className="mb-2 mb-lg-0">
              <h3 className="mb-0 text-white">Plan Management: {client.firstName} {client.lastName}</h3>
            </div>
            <div>
              <button 
                className="btn btn-white"
                onClick={() => setShowAssignModal(true)}
              >
                Assign New Plan
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Current Plan Card */}
      <div className="row">
        <div className="col-xl-12 col-12 mb-5">
          <div className="card">
            <div className="card-header">
              <h4 className="mb-0">Current Plan</h4>
            </div>
            <div className="card-body">
              {currentPlan ? (
                <div className="row">
                  <div className="col-md-6">
                    <h5>{currentPlan.planId.name}</h5>
                    <p className="text-muted">
                      {currentPlan.planId.price === 0 ? 'FREE' : 
                        `£${currentPlan.planId.price}${currentPlan.planId.isMonthly ? '/mo' : ''}`}
                    </p>
                  </div>
                  <div className="col-md-6">
                    <p>
                      <strong>Start Date:</strong> {format(new Date(currentPlan.startDate), 'PPP')}
                    </p>
                    <p>
                      <strong>Expiry Date:</strong> {format(new Date(currentPlan.expiryDate), 'PPP')}
                    </p>
                  </div>
                </div>
              ) : (
                <p>No active plan</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Plan History */}
      <div className="row">
        <div className="col-xl-12 col-12 mb-5">
          <div className="card">
            <div className="card-header">
              <h4 className="mb-0">Plan History</h4>
            </div>
            <div className="card-body">
              <div className="table-responsive">
                <table className="table text-nowrap">
                  <thead>
                    <tr>
                      <th>Plan</th>
                      <th>Start Date</th>
                      <th>Expiry Date</th>
                      <th>Added Via</th>
                      <th>Added By</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {planHistory.map((history) => (
                      <tr key={history._id}>
                        <td>{history.planId.name}</td>
                        <td>{format(new Date(history.startDate), 'PP')}</td>
                        <td>{format(new Date(history.expiryDate), 'PP')}</td>
                        <td>
                          <span className={`badge badge-${history.addedVia === 'SYSTEM' ? 'info' : 'primary'}-soft`}>
                            {history.addedVia}
                          </span>
                        </td>
                        <td>{history.addedBy.firstName} {history.addedBy.lastName}</td>
                        <td>
                          <span className={`badge badge-${history.isActive ? 'success' : 'secondary'}-soft`}>
                            {history.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Assign Plan Modal */}
      <Modal show={showAssignModal} onHide={() => setShowAssignModal(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>Assign New Plan</Modal.Title>
        </Modal.Header>
        <fetcher.Form method="post" onSubmit={(e) => {
          // Optional: Add any form validation here
        }}>
          <Modal.Body>
            <div className="mb-3">
              <label className="form-label">Select Plan</label>
              <select 
                name="planId" 
                className="form-select"
                onChange={(e) => {
                  const plan = availablePlans.find(p => p._id === e.target.value);
                  setSelectedPlan(plan);
                }}
                required
              >
                <option value="">Choose a plan...</option>
                {availablePlans.map((plan) => (
                  <option key={plan._id} value={plan._id}>
                    {plan.name} - {plan.price === 0 ? 'FREE' : `£${plan.price}${plan.isMonthly ? '/mo' : ''}`}
                  </option>
                ))}
              </select>
            </div>

            <div className="row">
              <div className="col-md-6">
                <div className="mb-3">
                  <label className="form-label">Start Date</label>
                  <input
                    type="date"
                    name="startDate"
                    className="form-control"
                    defaultValue={format(new Date(), 'yyyy-MM-dd')}
                  />
                </div>
              </div>
              <div className="col-md-6">
                <div className="mb-3">
                  <label className="form-label">Expiry Date</label>
                  <input
                    type="date"
                    name="expiryDate"
                    className="form-control"
                    defaultValue={format(addDays(new Date(), 30), 'yyyy-MM-dd')}
                  />
                </div>
              </div>
            </div>

            <div className="mb-3">
              <label className="form-label">Notes</label>
              <textarea
                name="notes"
                className="form-control"
                rows={3}
                placeholder="Any additional notes..."
              />
            </div>

            <input type="hidden" name="_action" value="assignPlan" />
          </Modal.Body>
          <Modal.Footer>
            <button 
              type="button" 
              className="btn btn-secondary" 
              onClick={() => setShowAssignModal(false)}
              disabled={fetcher.state === 'submitting'}
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className="btn btn-primary"
              disabled={fetcher.state === 'submitting'}
            >
              {fetcher.state === 'submitting' ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2" />
                  Assigning...
                </>
              ) : (
                'Assign Plan'
              )}
            </button>
          </Modal.Footer>
        </fetcher.Form>
      </Modal>
    </>
  );
} 