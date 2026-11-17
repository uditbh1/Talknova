// app/routes/portal/coupons/index.tsx
import { json } from '@remix-run/node';
import { useLoaderData, Link } from '@remix-run/react';
import { Coupon } from '~/models/coupon';

export async function loader() {
  const coupons = await Coupon.find().sort({ createdAt: -1 }).lean();
  return json({ coupons });
}

export default function CouponList() {
  const { coupons } = useLoaderData();
  
  return (
    <div className="card">
      <div className="card-header d-flex justify-content-between align-items-center">
        <h5 className="mb-0">Coupons</h5>
        <Link to="add" className="btn btn-primary">Add New Coupon</Link>
      </div>
      <div className="card-body">
        <div className="table-responsive">
          <table className="table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Type</th>
                <th>Value</th>
                <th>Valid From</th>
                <th>Valid Until</th>
                <th>Used</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {coupons.map(coupon => (
                <tr key={coupon._id}>
                  <td>{coupon.code}</td>
                  <td>{coupon.discountType}</td>
                  <td>
                    {coupon.discountType === 'PERCENTAGE' ? 
                      `${coupon.discountValue}%` : 
                      `£${coupon.discountValue}`}
                  </td>
                  <td>{new Date(coupon.validFrom).toLocaleDateString()}</td>
                  <td>{new Date(coupon.validUntil).toLocaleDateString()}</td>
                  <td>{coupon.timesRedeemed}</td>
                  <td>{coupon.status ? 'Active' : 'Inactive'}</td>
                  <td>
                    <Link to={`${coupon._id}`}>Edit</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}