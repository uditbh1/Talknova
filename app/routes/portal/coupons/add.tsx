// app/routes/portal/coupons/add.tsx
import { redirect, json } from '@remix-run/node';
import { useActionData } from '@remix-run/react';
import { getUserFromSession } from '~/utils/auth.server';
import { Coupon } from '~/models/coupon';
import CouponForm from './Form';

export async function action({ request }) {
  const user = await getUserFromSession(request);
  if (!user) return redirect('/login');

  const formData = await request.formData();
  const data = Object.fromEntries(formData);

  console.log(data);

  try {
    await Coupon.create({
      code: data.code,
      discountType: data.discountType,
      discountValue: data.discountValue,
      validFrom: data.validFrom,
      validUntil: data.validUntil,
      maxRedemptions: data.maxRedemptions,
      addedBy: user._id,
    });
    return redirect('/portal/coupons');
  } catch (error) {
    console.error('Failed to create coupon', error);
    return json({ error: 'Failed to create coupon' });
  }
}

export default function AddCoupon() {
  const actionData = useActionData();

  return (
    <div className="card">
      <div className="card-header">
        <h5 className="mb-0">Add New Coupon</h5>
      </div>
      <div className="card-body">
        {actionData?.error && <div className="alert alert-danger">{actionData.error}</div>}
        <CouponForm />
      </div>
    </div>
  );
}
