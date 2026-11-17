import { mongoose } from '~/config/db.server';

const planSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    price: { type: Number, required: true }, //Monthly price
    yearlyPrice: { type: Number, required: true }, //Yearly price
    isMonthly: { type: Boolean, default: true }, //ignore this for now
    billingCycle: { type: String, enum: ['MONTHLY', 'YEARLY'], default: 'MONTHLY' },
    maxDocuments: { type: Number, required: true },
    maxFileSize: { type: Number, required: true }, // in MB
    maxUrls: { type: Number, required: true },
    isDefault: { type: Boolean, default: false }, // For FREE, STARTER, BUSINESS plans
    isActive: { type: Boolean, default: true },
    isDeleted: { type: Boolean, default: false }, // For soft delete
    allowedAgents: { type: Number, default: 1 }, // Number of agents allowed
    defaultPlanType: {
      type: String,
      enum: ['FREE', 'STARTER', 'BUSINESS', null],
      default: null,
    },
  },
  { timestamps: true }
);

export const PlanModel = mongoose.models.Plan || mongoose.model('Plan', planSchema);
