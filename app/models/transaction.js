import { mongoose } from '~/config/db.server';
var Schema = mongoose.Schema;

const transactionSchema = Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User' },
    vendorTxCode: { type: String, required: true, unique: true },
    amount: { type: Number, required: true },
    plan: { type: Schema.Types.ObjectId, ref: 'Plan' },
    currency: { type: String, required: true },
    description: { type: String, required: true },
    billingSurname: { type: String, required: true },
    billingFirstNames: { type: String, required: true },
    billingAddress1: { type: String, required: true },
    billingCity: { type: String, required: true },
    billingPostCode: { type: String, required: false }, // May or may not be required depending on country
    billingCountry: { type: String, required: true },
    billingState: { type: String, required: false },
    customerEmail: { type: String, required: true },
    customerName: { type: String, required: true },
    note: { type: String, required: false },
    courses: [{ type: Schema.Types.ObjectId, ref: 'Course' }],
    status: { type: String, default: 'INITIATED' },
    statusDetail: { type: String, required: false },
    declineCode: { type: String, required: false },
    cardType: { type: String, required: false },
    last4Digits: { type: String, required: false },
    vpsTxId: { type: String, required: false },
    stripeSessionId: { type: String }, // Checkout Session id (cs_…)
    stripeSubscriptionId: { type: String }, // subscription id if recurring (sub_…)
    period: { type: String, enum: ['monthly', 'yearly'], required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export const Transaction = mongoose.models.Transaction || mongoose.model('Transaction', transactionSchema);
