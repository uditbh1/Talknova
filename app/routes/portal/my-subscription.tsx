// app/routes/dashboard.jsx
import { useLoaderData, Await, useRouteError, isRouteErrorResponse, Link } from '@remix-run/react';
import { redirect, defer, json } from '@remix-run/node';
import { Suspense } from 'react';

import { getUserFromSession } from '~/utils/auth.server';
import { Course } from '~/models/course';
import { User } from '~/models/user';
import { PlanModel } from '~/models/plan';
import { getCurrentPlan } from '~/utils/plans';

import AdminLayout from '~/components/Layout';

// ───────────────────────────────────────────────────────────
// Helper functions
// ───────────────────────────────────────────────────────────
async function fetchAdminData() {
  const courses = await Course.find({ status: true }).populate('user').lean();
  const providers = await User.find({ roles: 'COURSEPROVIDER' }).lean();
  return { courses, providers };
}

async function fetchTeacherData(user) {
  const courses = await Course.find({ user: user._id }).lean();
  const courseIds = courses.map(c => c._id);
  const totalLearners = await Course.countDocuments({ _id: { $in: courseIds } });
  return { courses, totalLearners };
}

async function fetchClientData(user) {
  const currentPlan = await getCurrentPlan(user._id);
  const plans = await PlanModel.find({ isActive: true, isDeleted: false }).sort({
    price: 1,
  });
  return { currentPlan, plans };
}

// ───────────────────────────────────────────────────────────
// Loader
// ───────────────────────────────────────────────────────────
export const loader = async ({ request }) => {
  const user = await getUserFromSession(request);
  if (!user) return redirect('/login');

  const roles = user.roles || [];
  let dataPromise;

  if (roles.includes('SUPER_ADMIN')) dataPromise = fetchAdminData();
  else if (roles.includes('COURSEPROVIDER')) dataPromise = fetchTeacherData(user);
  else if (roles.includes('CLIENT')) dataPromise = fetchClientData(user);
  else throw json({ message: 'Unauthorized' }, { status: 401 });

  return defer({ user, roles, data: dataPromise });
};

// ───────────────────────────────────────────────────────────
// Dashboards
// ───────────────────────────────────────────────────────────
const AdminDashboard = ({ data }) => <div className="row" />;

const ProviderDashboard = ({ data }) => <div className="row" />;

const ClientDashboard = ({ data }) => {
  const { currentPlan } = data;

  return (
    <>
      {/* ───── Current Plan / No Plan ───── */}
      <div className="row mb-4">
        {currentPlan ? (
          <div className="col-12">
            <div className="card h-100 card-lift">
              <div className="card-body">
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <div>
                    <h4 className="mb-0">Current Plan</h4>
                  </div>
                  <div className="icon-shape icon-md bg-primary-soft text-primary rounded-2">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width={20}
                      height={20}
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="feather feather-award">
                      <circle cx="12" cy="8" r="7"></circle>
                      <polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"></polyline>
                    </svg>
                  </div>
                </div>

                <div className="table-responsive">
                  <table className="table table-hover mb-0">
                    <tbody>
                      <tr>
                        <td>
                          <strong>Plan Name</strong>
                        </td>
                        <td>{currentPlan.planId.name}</td>
                      </tr>
                      <tr>
                        <td>
                          <strong>Start Date</strong>
                        </td>
                        <td>{new Date(currentPlan.startDate).toLocaleDateString()}</td>
                      </tr>
                      <tr>
                        <td>
                          <strong>Expiry Date</strong>
                        </td>
                        <td>{new Date(currentPlan.expiryDate).toLocaleDateString()}</td>
                      </tr>
                      <tr>
                        <td>
                          <strong>Billing Period</strong>
                        </td>
                        <td>
                          <span className={`badge ${currentPlan.period === 'yearly' ? 'badge-success-soft' : 'badge-primary-soft'}`}>
                            {currentPlan.period === 'yearly' ? 'Yearly' : 'Monthly'}
                          </span>
                        </td>
                      </tr>
                      <tr>
                        <td>
                          <strong>Next Billing Date</strong>
                        </td>
                        <td>
                          {new Date(currentPlan.expiryDate).toLocaleDateString()}
                          {new Date(currentPlan.expiryDate) > new Date() ? (
                            <span className="text-success ms-2">(Active)</span>
                          ) : (
                            <span className="text-danger ms-2">(Expired)</span>
                          )}
                        </td>
                      </tr>
                      <tr>
                        <td>
                          <strong>Max Documents</strong>
                        </td>
                        <td>
                          {currentPlan.period === 'yearly' ? currentPlan.planId.maxDocuments * 2 : currentPlan.planId.maxDocuments}
                          {currentPlan.period === 'yearly' && <span className="text-success ms-1">(2x yearly bonus)</span>}
                        </td>
                      </tr>
                      <tr>
                        <td>
                          <strong>Max File Size</strong>
                        </td>
                        <td>
                          {currentPlan.period === 'yearly' ? currentPlan.planId.maxFileSize * 2 : currentPlan.planId.maxFileSize}MB
                          {currentPlan.period === 'yearly' && <span className="text-success ms-1">(2x yearly bonus)</span>}
                        </td>
                      </tr>
                      <tr>
                        <td>
                          <strong>Max URLs</strong>
                        </td>
                        <td>
                          {currentPlan.period === 'yearly' ? currentPlan.planId.maxUrls * 2 : currentPlan.planId.maxUrls}
                          {currentPlan.period === 'yearly' && <span className="text-success ms-1">(2x yearly bonus)</span>}
                        </td>
                      </tr>
                      {currentPlan.planId.allowedAgents && (
                        <tr>
                          <td>
                            <strong>Allowed Agents</strong>
                          </td>
                          <td>
                            {currentPlan.period === 'yearly' ? currentPlan.planId.allowedAgents * 2 : currentPlan.planId.allowedAgents}
                            {currentPlan.period === 'yearly' && <span className="text-success ms-1">(2x yearly bonus)</span>}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="col-12">
            <div className="alert alert-info">
              <h5>No Active Plan</h5>
              <p>You don’t have a subscription yet. Pick one below to get started.</p>
            </div>
          </div>
        )}
      </div>

      {/* ───── Subscription Details (bottom) ───── */}
      <div className="row mt-5">
        <div className="col-12 mb-5">
          <div className="card h-100">
            <div className="card-header">
              <h3 className="mb-0">Subscription Details (Dummy)</h3>
            </div>
            <div className="card-body">
              <table className="table table-bordered mb-0">
                <thead>
                  <tr>
                    <th>Date Registered</th>
                    <th>Valid Till</th>
                    <th>Amount Paid</th>
                    <th>Invoices</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Replace static rows with real history if/when available */}
                  <tr>
                    <td>12/04/2025</td>
                    <td>11/05/2025</td>
                    <td>Free</td>
                    <td>
                      <button className="btn btn-ghost btn-icon btn-sm rounded-circle">
                        <i data-feather="eye" className="icon-xs"></i>
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

// ───────────────────────────────────────────────────────────
// Main page
// ───────────────────────────────────────────────────────────
export default function PortalDashboard() {
  const { user, roles, data } = useLoaderData();

  return (
    <AdminLayout>
      <div className="row">
        <div className="col-12">
          <h3 className="mb-5 text-white">My Subscription</h3>
        </div>
      </div>

      <Suspense fallback={<div>Loading…</div>}>
        <Await resolve={data}>
          {resolved => {
            if (roles.includes('SUPER_ADMIN')) return <AdminDashboard data={resolved} />;
            if (roles.includes('COURSEPROVIDER')) return <ProviderDashboard data={resolved} />;
            if (roles.includes('CLIENT')) return <ClientDashboard data={resolved} />;
            return null;
          }}
        </Await>
      </Suspense>
    </AdminLayout>
  );
}

// ───────────────────────────────────────────────────────────
// Error Boundary
// ───────────────────────────────────────────────────────────
export function ErrorBoundary() {
  const error = useRouteError();

  if (isRouteErrorResponse(error)) {
    return (
      <AdminLayout>
        <div className="error-container">
          <h1>Error {error.status}</h1>
          <p>{error.data || error.statusText}</p>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="error-container">
        <h1>An unexpected error occurred</h1>
        <p>{error instanceof Error ? error.message : 'Unknown error'}</p>
      </div>
    </AdminLayout>
  );
}
