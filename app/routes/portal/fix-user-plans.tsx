import { json, redirect } from '@remix-run/node';
import { useLoaderData, Form } from '@remix-run/react';
import { getUserFromSession } from '~/utils/auth.server';
import { User } from '~/models/user';
import { PlanModel } from '~/models/plan';
import { UserPlanModel } from '~/models/userplan';
import { assignPlan } from '~/utils/plans';
import { seedDefaultPlans } from '~/models/seeds/plans.server';
import { addDays } from 'date-fns';
import AdminLayout from '~/components/Layout';

export async function loader({ request }) {
  const user = await getUserFromSession(request);
  if (!user) return redirect('/login');

  // Only allow SUPER_ADMIN or ADMIN to access this
  if (!user.roles?.includes('SUPER_ADMIN') && !user.roles?.includes('ADMIN')) {
    return redirect('/portal');
  }

  // Check if plans exist
  const plans = await PlanModel.find({ isDeleted: false });
  const freePlan = await PlanModel.findOne({ defaultPlanType: 'FREE', isActive: true, isDeleted: false });

  // Get all users without plans
  const allUsers = await User.find({ roles: 'CLIENT', deleted: false }).lean();
  const usersWithoutPlans = [];

  for (const u of allUsers) {
    const hasPlan = await UserPlanModel.findOne({ 
      clientId: u._id, 
      isActive: true, 
      isDeleted: false 
    });
    if (!hasPlan) {
      usersWithoutPlans.push(u);
    }
  }

  return json({
    plansCount: plans.length,
    freePlanExists: !!freePlan,
    freePlan,
    usersWithoutPlansCount: usersWithoutPlans.length,
    usersWithoutPlans: usersWithoutPlans.slice(0, 10), // Show first 10
    totalUsers: allUsers.length
  });
}

export async function action({ request }) {
  const user = await getUserFromSession(request);
  if (!user) return redirect('/login');

  if (!user.roles?.includes('SUPER_ADMIN') && !user.roles?.includes('ADMIN')) {
    return json({ error: 'Unauthorized' }, { status: 403 });
  }

  const formData = await request.formData();
  const action = formData.get('_action');

  if (action === 'seed_plans') {
    try {
      await seedDefaultPlans();
      return json({ success: true, message: 'Default plans seeded successfully!' });
    } catch (error) {
      console.error('Seed plans error:', error);
      return json({ error: 'Failed to seed plans: ' + error.message }, { status: 500 });
    }
  }

  if (action === 'assign_plans') {
    try {
      // Ensure FREE plan exists
      let freePlan = await PlanModel.findOne({ defaultPlanType: 'FREE', isActive: true, isDeleted: false });
      
      if (!freePlan) {
        await seedDefaultPlans();
        freePlan = await PlanModel.findOne({ defaultPlanType: 'FREE', isActive: true, isDeleted: false });
      }

      if (!freePlan) {
        return json({ error: 'FREE plan not found and could not be created' }, { status: 500 });
      }

      // Find all users without plans
      const allUsers = await User.find({ roles: 'CLIENT', deleted: false }).lean();
      let assigned = 0;
      let errors = 0;

      for (const u of allUsers) {
        const hasPlan = await UserPlanModel.findOne({ 
          clientId: u._id, 
          isActive: true, 
          isDeleted: false 
        });

        if (!hasPlan) {
          try {
            const trialStartDate = new Date();
            const trialExpiryDate = addDays(trialStartDate, 30);

            await assignPlan({
              clientId: u._id,
              planId: freePlan._id,
              startDate: trialStartDate,
              expiryDate: trialExpiryDate,
              addedVia: 'SYSTEM',
              addedBy: user._id,
              period: 'monthly',
              notes: 'Free trial plan assigned via fix script',
            });
            assigned++;
          } catch (err) {
            console.error(`Failed to assign plan to user ${u._id}:`, err);
            errors++;
          }
        }
      }

      return json({ 
        success: true, 
        message: `Plans assigned successfully! Assigned: ${assigned}, Errors: ${errors}` 
      });
    } catch (error) {
      console.error('Assign plans error:', error);
      return json({ error: 'Failed to assign plans: ' + error.message }, { status: 500 });
    }
  }

  return json({ error: 'Invalid action' }, { status: 400 });
}

export default function FixUserPlans() {
  const data = useLoaderData();

  return (
    <AdminLayout>
      <div className="container-fluid py-4">
        <div className="row">
          <div className="col-12">
            <h2 className="mb-4">Fix User Plans</h2>

            {/* Status Cards */}
            <div className="row mb-4">
              <div className="col-md-4">
                <div className="card">
                  <div className="card-body">
                    <h5 className="card-title">Plans in Database</h5>
                    <p className="card-text display-4">{data.plansCount}</p>
                  </div>
                </div>
              </div>
              <div className="col-md-4">
                <div className="card">
                  <div className="card-body">
                    <h5 className="card-title">FREE Plan Exists</h5>
                    <p className="card-text">
                      {data.freePlanExists ? (
                        <span className="text-success">✓ Yes</span>
                      ) : (
                        <span className="text-danger">✗ No</span>
                      )}
                    </p>
                  </div>
                </div>
              </div>
              <div className="col-md-4">
                <div className="card">
                  <div className="card-body">
                    <h5 className="card-title">Users Without Plans</h5>
                    <p className="card-text display-4">{data.usersWithoutPlansCount}</p>
                    <small className="text-muted">out of {data.totalUsers} total users</small>
                  </div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="row">
              <div className="col-12">
                <div className="card">
                  <div className="card-body">
                    <h5 className="card-title mb-4">Actions</h5>

                    {/* Seed Plans */}
                    {!data.freePlanExists && (
                      <div className="mb-4">
                        <h6>Step 1: Seed Default Plans</h6>
                        <p className="text-muted">
                          Create the FREE, STARTER, and BUSINESS plans in the database.
                        </p>
                        <Form method="post">
                          <input type="hidden" name="_action" value="seed_plans" />
                          <button type="submit" className="btn btn-primary">
                            Seed Default Plans
                          </button>
                        </Form>
                      </div>
                    )}

                    {/* Assign Plans */}
                    {data.freePlanExists && data.usersWithoutPlansCount > 0 && (
                      <div className="mb-4">
                        <h6>Step 2: Assign Plans to Users</h6>
                        <p className="text-muted">
                          Assign the FREE plan to all {data.usersWithoutPlansCount} users who don't have a plan.
                        </p>
                        <Form method="post">
                          <input type="hidden" name="_action" value="assign_plans" />
                          <button type="submit" className="btn btn-success">
                            Assign FREE Plan to All Users
                          </button>
                        </Form>
                      </div>
                    )}

                    {data.freePlanExists && data.usersWithoutPlansCount === 0 && (
                      <div className="alert alert-success">
                        <strong>All good!</strong> All users have plans assigned.
                      </div>
                    )}

                    {/* Show sample users without plans */}
                    {data.usersWithoutPlansCount > 0 && (
                      <div className="mt-4">
                        <h6>Sample Users Without Plans (first 10):</h6>
                        <ul className="list-group">
                          {data.usersWithoutPlans.map((u) => (
                            <li key={u._id} className="list-group-item">
                              {u.firstName} {u.lastName} ({u.email})
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}



