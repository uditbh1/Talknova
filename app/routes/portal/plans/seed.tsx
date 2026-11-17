import { redirect, json } from '@remix-run/node';
import { getUserFromSession } from '~/utils/auth.server';
import { seedDefaultPlans } from '~/models/seeds/plans.server';
import type { LoaderFunction } from '@remix-run/node';

export const loader: LoaderFunction = async ({ request }) => {
  const user = await getUserFromSession(request);
  if (!user) return redirect('/login');

  await seedDefaultPlans();
  return redirect('/portal/plans');
}; 