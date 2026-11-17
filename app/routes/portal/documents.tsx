// app/routes/admin/dashboard.jsx
import { Outlet } from '@remix-run/react';
import AdminLayout from '~/components/Layout';
import { redirect, json } from '@remix-run/node';
import { getUserFromSession, requireUserSession } from '~/utils/auth.server';

export async function loader({ request, params }) {
  let user = await getUserFromSession(request);
  if (!user) return redirect('/login');

  return { user };
}

const Documents = () => {
  return (
    <AdminLayout>
      <Outlet />
    </AdminLayout>
  );
};

export default Documents;
