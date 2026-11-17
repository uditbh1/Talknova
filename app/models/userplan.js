import mongoose from 'mongoose';

const userPlanSchema = new mongoose.Schema(
  {
    clientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    planId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Plan',
      required: true,
    },
    startDate: {
      type: Date,
      required: true,
      default: Date.now,
    },
    expiryDate: {
      type: Date,
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    addedVia: {
      type: String,
      enum: ['SYSTEM', 'ADMIN'],
      required: true,
    },
    addedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    previousPlanId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Plan',
    },
    transactionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Transaction',
      required: false, // Optional, can be linked to a transaction if applicable
    },
    period: { type: String, enum: ['monthly', 'yearly'], required: true },
    notes: String,
    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Ensure client can only have one active plan
userPlanSchema.index(
  { clientId: 1, isActive: 1 },
  {
    unique: true,
    partialFilterExpression: { isActive: true, isDeleted: false },
  }
);

export const UserPlanModel = mongoose.models.UserPlan || mongoose.model('UserPlan', userPlanSchema);
