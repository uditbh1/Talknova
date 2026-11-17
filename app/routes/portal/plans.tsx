import { Outlet } from '@remix-run/react';
import AdminLayout from '~/components/Layout';
import { redirect, json } from '@remix-run/node';
import { getUserFromSession } from '~/utils/auth.server';
import type { LoaderFunction } from '@remix-run/node';

export const loader: LoaderFunction = async ({ request }) => {
  let user = await getUserFromSession(request);
  if (!user) return redirect('/login');

  return json({ user });
};

export default function Plans() {
  return (
    <AdminLayout>
      <Outlet />
    </AdminLayout>
  );
} 