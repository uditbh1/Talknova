import { mongoose } from '~/config/db.server';

const emailHistorySchema = new mongoose.Schema(
  {
    to: { type: String, default: 'NA', required: false },
    from: { type: String, default: 'NA', required: false },
    bcc: [{ type: String, default: [], required: false }],
    cc: [{ type: String, default: [], required: false }],
    subject: { type: String, default: 'NA', required: false },
    html: { type: String, default: 'NA', required: false },
    tplId: { type: mongoose.Schema.Types.ObjectId, ref: 'EmailTemplate', required: false },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false }, //Logged User
    deleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const MailHistory = mongoose.models.MailHistory || mongoose.model('MailHistory', emailHistorySchema);
