import { Outlet } from '@remix-run/react';
import AdminLayout from '~/components/Layout';
import { redirect, json } from '@remix-run/node';
import { getUserFromSession } from '~/utils/auth.server';

export async function loader({ request, params }) {
  let user = await getUserFromSession(request);
  if (!user) return redirect('/login');

  return { user };
}

const ContactUs = () => {
  return (
    <AdminLayout>
      <Outlet />
    </AdminLayout>
  );
};

export default ContactUs; 