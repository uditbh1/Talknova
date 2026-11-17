//create student module schema

import { mongoose } from '~/config/db.server';
var Schema = mongoose.Schema;

var cartSchema = new Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    courses: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Course' }],
    appliedCoupon: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Coupon',
    },
  },
  { timestamps: true }
);

export const Cart = mongoose.models.Cart || mongoose.model('Cart', cartSchema);
