import { json, redirect } from '@remix-run/node';
import { useLoaderData, Form } from '@remix-run/react';
import { getUserFromSession } from '~/utils/auth.server';
import { User } from '~/models/user';
import AdminLayout from '~/components/Layout';

export async function loader({ request }) {
  const user = await getUserFromSession(request);
  if (!user) return redirect('/login');

  // Only allow SUPER_ADMIN or ADMIN to access this
  if (!user.roles?.includes('SUPER_ADMIN') && !user.roles?.includes('ADMIN')) {
    return redirect('/portal');
  }

  // Count users without the field
  const usersWithoutField = await User.countDocuments({
    $or: [
      { welcomePopupShown: { $exists: false } },
      { welcomePopupShown: null }
    ]
  });

  const totalUsers = await User.countDocuments({});

  return json({
    usersWithoutField,
    totalUsers,
    message: usersWithoutField > 0 
      ? `${usersWithoutField} users need the welcomePopupShown field initialized`
      : 'All users have the welcomePopupShown field'
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

  if (action === 'init_field') {
    try {
      // Initialize welcomePopupShown field for all users who don't have it
      const result = await User.updateMany(
        {
          $or: [
            { welcomePopupShown: { $exists: false } },
            { welcomePopupShown: null }
          ]
        },
        {
          $set: { welcomePopupShown: false }
        }
      );

      return json({ 
        success: true, 
        message: `Initialized welcomePopupShown field for ${result.modifiedCount} users`,
        modifiedCount: result.modifiedCount
      });
    } catch (error) {
      console.error('Error initializing welcomePopupShown field:', error);
      return json({ error: 'Failed to initialize field: ' + error.message }, { status: 500 });
    }
  }

  return json({ error: 'Invalid action' }, { status: 400 });
}

export default function InitWelcomePopupField() {
  const data = useLoaderData();

  return (
    <AdminLayout>
      <div className="container-fluid py-4">
        <div className="row">
          <div className="col-12">
            <h2 className="mb-4">Initialize Welcome Popup Field</h2>
            
            <div className="card mb-4">
              <div className="card-body">
                <h5 className="card-title">Status</h5>
                <p className="card-text">
                  <strong>Total Users:</strong> {data.totalUsers}<br/>
                  <strong>Users Without Field:</strong> {data.usersWithoutField}
                </p>
                <p className="text-muted">{data.message}</p>
              </div>
            </div>

            {data.usersWithoutField > 0 && (
              <div className="card">
                <div className="card-body">
                  <h5 className="card-title">Action</h5>
                  <p className="card-text">
                    Click the button below to initialize the <code>welcomePopupShown</code> field 
                    for all users who don't have it. This will set it to <code>false</code> for existing users.
                  </p>
                  <Form method="post">
                    <input type="hidden" name="_action" value="init_field" />
                    <button type="submit" className="btn btn-primary">
                      Initialize Field for All Users
                    </button>
                  </Form>
                </div>
              </div>
            )}

            {data.usersWithoutField === 0 && (
              <div className="alert alert-success">
                <strong>All good!</strong> All users have the welcomePopupShown field initialized.
              </div>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}

