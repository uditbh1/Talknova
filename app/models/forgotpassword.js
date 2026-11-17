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
  },
  { timestamps: true }
);

export const ForgotPassword = mongoose.models.ForgotPassword || mongoose.model('ForgotPassword', forgotpasswordSchema);
