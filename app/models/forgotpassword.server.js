import { mongoose } from '~/config/db.server';

const forgotpasswordSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    token: {
      type: String,
      required: true,
    },
    exp_date: {
      type: Date,
      default: +new Date() + 1 * 24 * 60 * 60 * 1000,
      required: true,
    },
    // Store selected plan info for new user signup flow
    pendingPlanId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Plan',
      required: false,
    },
    pendingPlanPeriod: {
      type: String,
      enum: ['monthly', 'yearly'],
      required: false,
    },
    // Store billing details for payment after verification
    pendingBillingDetails: {
      type: {
        firstName: String,
        lastName: String,
        addr1: String,
        addr2: String,
        city: String,
        postcode: String,
        country: String,
        billingState: String,
      },
      required: false,
    },
    // Store temporary password temporarily for post-verification email
    temporaryPassword: {
      type: String,
      required: false,
    },
  },
  { timestamps: true }
);

export const ForgotPassword = mongoose.models.ForgotPassword || mongoose.model('ForgotPassword', forgotpasswordSchema);
