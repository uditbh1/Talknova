// app/routes/portal/coupons/Form.tsx
import { Form, useLoaderData, Link } from '@remix-run/react';
import { useState, useEffect } from 'react';
import SubmitButton from '~/components/ui/SubmitBtn';

export default function CouponForm({ data = {} }) {
  const [code, setCode] = useState(data.code || '');
  const [discountType, setDiscountType] = useState(data.discountType || '');
  const [discountValue, setDiscountValue] = useState(data.discountValue || '');
  const [validFrom, setValidFrom] = useState(data.validFrom ? new Date(data.validFrom).toISOString().split('T')[0] : '');
  const [validUntil, setValidUntil] = useState(data.validUntil ? new Date(data.validUntil).toISOString().split('T')[0] : '');
  const [maxRedemptions, setMaxRedemptions] = useState(data.maxRedemptions || '');
  const [errors, setErrors] = useState({});

  function isBackdate(dateStr) {
    const today = new Date();
    const date = new Date(dateStr);
    today.setHours(0, 0, 0, 0);
    date.setHours(0, 0, 0, 0);
    return date < today;
  }

  function isValidDateRange(startDateStr, endDateStr) {
    const startDate = new Date(startDateStr);
    const endDate = new Date(endDateStr);
    return startDate <= endDate;
  }

  useEffect(() => {
    const newErrors = {};

    // Validate code
    if (!code) {
      newErrors.code = 'Coupon code is required.';
    }

    // Validate discountType
    if (!discountType) {
      newErrors.discountType = 'Discount Type is required.';
    }

    // Validate discountValue
    if (!discountValue) {
      newErrors.discountValue = 'Discount Value is required.';
    } else if (discountType === 'PERCENTAGE' && discountValue > 99) {
      newErrors.discountValue = 'Percentage discount cannot be more than 99%.';
    }

    // Validate dates
    if (!validFrom) {
      newErrors.validFrom = 'Valid From date is required.';
    } else if (isBackdate(validFrom)) {
      newErrors.validFrom = 'Valid From date cannot be in the past.';
    }

    if (!validUntil) {
      newErrors.validUntil = 'Valid Until date is required.';
    } else if (isBackdate(validUntil)) {
      newErrors.validUntil = 'Valid Until date cannot be in the past.';
    }

    // Validate date range
    if (validFrom && validUntil && !isValidDateRange(validFrom, validUntil)) {
      newErrors.validUntil = 'Valid Until date cannot be before Valid From date.';
    }

    setErrors(newErrors);
  }, [code, discountType, discountValue, validFrom, validUntil]);

  // Calculate discount preview
  const sampleAmount = 100; // Sample purchase amount in GBP
  let discountAmount = 0;
  let finalAmount = sampleAmount;

  if (discountType && discountValue) {
    const discountVal = parseFloat(discountValue);
    if (discountType === 'PERCENTAGE') {
      discountAmount = (sampleAmount * discountVal) / 100;
    } else if (discountType === 'FIXED') {
      discountAmount = discountVal;
    }

    // Ensure discount does not exceed the sample amount
    if (discountAmount > sampleAmount) {
      discountAmount = sampleAmount;
    }

    finalAmount = sampleAmount - discountAmount;
  }

  return (
    <Form method="post">
      <div className="row">
        {/* Column 1 */}
        <div className="col-lg-4">
          <div className="mb-3">
            <label htmlFor="code" className="form-label">
              Coupon Code
            </label>
            <input type="text" className="form-control" id="code" name="code" value={code} onChange={e => setCode(e.target.value)} required minLength="3" maxLength="25" />
            {errors.code && <div className="text-danger">{errors.code}</div>}
          </div>

          <div className="mb-3">
            <label htmlFor="discountType" className="form-label">
              Discount Type
            </label>
            <select className="form-control" id="discountType" name="discountType" value={discountType} onChange={e => setDiscountType(e.target.value)} required>
              <option value="">Select Type</option>
              <option value="PERCENTAGE">Percentage</option>
              <option value="FIXED">Fixed Amount</option>
            </select>
            {errors.discountType && <div className="text-danger">{errors.discountType}</div>}
          </div>
        </div>

        {/* Column 2 */}
        <div className="col-lg-4">
          <div className="mb-3">
            <label htmlFor="validFrom" className="form-label">
              Valid From
            </label>
            <input type="date" className="form-control" id="validFrom" name="validFrom" value={validFrom} onChange={e => setValidFrom(e.target.value)} required />
            {errors.validFrom && <div className="text-danger">{errors.validFrom}</div>}
          </div>

          <div className="mb-3">
            <label htmlFor="discountValue" className="form-label">
              Discount Value {discountType === 'PERCENTAGE' ? '%' : discountType === 'FIXED' ? '£' : ''}
            </label>
            <input
              type="number"
              className="form-control"
              id="discountValue"
              name="discountValue"
              value={discountValue}
              onChange={e => setDiscountValue(e.target.value)}
              required
              max={discountType === 'PERCENTAGE' ? '99' : undefined}
            />
            {errors.discountValue && <div className="text-danger">{errors.discountValue}</div>}
          </div>
        </div>

        {/* Column 3 */}
        <div className="col-lg-4">
          <div className="mb-3">
            <label htmlFor="validUntil" className="form-label">
              Valid Until
            </label>
            <input type="date" className="form-control" id="validUntil" name="validUntil" value={validUntil} onChange={e => setValidUntil(e.target.value)} required />
            {errors.validUntil && <div className="text-danger">{errors.validUntil}</div>}
          </div>

          <div className="mb-3">
            <label htmlFor="maxRedemptions" className="form-label">
              Max Redemptions
            </label>
            <input
              type="number"
              className="form-control"
              id="maxRedemptions"
              name="maxRedemptions"
              value={maxRedemptions}
              onChange={e => setMaxRedemptions(e.target.value)}
              min="1"
              max="200"
            />
          </div>
        </div>
      </div>

      {/* Display overall form errors */}
      {Object.keys(errors).length > 0 && <div className="alert alert-danger">Please fix the errors above before submitting the form.</div>}

      {/* Coupon Preview */}
      {code && discountValue && discountType && (
        <div className="alert alert-info mt-4">
          <h4>Coupon Preview</h4>
          <p>
            Use code <strong>{code}</strong> to get {discountType === 'PERCENTAGE' ? `${discountValue}%` : `£${parseFloat(discountValue).toFixed(2)}`} off your purchase!
          </p>
          <p>
            Assuming a purchase of £{sampleAmount.toFixed(2)}, you will save £{discountAmount.toFixed(2)}, and your total will be £{finalAmount.toFixed(2)}.
          </p>
          {validFrom && validUntil && (
            <p>
              Valid from {validFrom} to {validUntil}.
            </p>
          )}
        </div>
      )}

      <div className="row mt-3">
        <div className="col">
          <div className="d-grid d-flex justify-content-between mt-4">
            <div>
              <SubmitButton className="btn btn-primary" disabled={Object.keys(errors).length > 0} />
              <Link className="btn btn-primary ms-3" to="../">
                Cancel
              </Link>
            </div>
          </div>
        </div>
      </div>

      <input type="hidden" name="_id" value={data._id || ''} />
    </Form>
  );
}
