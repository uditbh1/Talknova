// app/routes/portal/coupons/$id.tsx
import { redirect, json } from '@remix-run/node';
import { useLoaderData, useActionData } from '@remix-run/react';
import { getUserFromSession } from '~/utils/auth.server';
import { Coupon } from '~/models/coupon';
import CouponForm from './Form';

export async function loader({ params }) {
  const coupon = await Coupon.findById(params.id).lean();
  if (!coupon) throw new Error('Coupon not found');
  return json({ coupon });
}

export async function action({ request, params }) {
  const user = await getUserFromSession(request);
  if (!user) return redirect('/login');

  const formData = await request.formData();
  const data = Object.fromEntries(formData);

  try {
    await Coupon.findByIdAndUpdate(params.id, {
      code: data.code,
      discountType: data.discountType,
      discountValue: data.discountValue,
      validFrom: data.validFrom,
      validUntil: data.validUntil,
      maxRedemptions: data.maxRedemptions,
      updatedBy: user._id,
    });
    return redirect('/portal/coupons');
  } catch (error) {
    return json({ error: 'Failed to update coupon' });
  }
}

export default function EditCoupon() {
  const { coupon } = useLoaderData();
  const actionData = useActionData();

  return (
    <div className="card">
      <div className="card-header">
        <h5 className="mb-0">Edit Coupon</h5>
      </div>
      <div className="card-body">
        {actionData?.error && <div className="alert alert-danger">{actionData.error}</div>}
        <CouponForm data={coupon} />
      </div>
    </div>
  );
}
