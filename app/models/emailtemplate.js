import { mongoose } from '~/config/db.server';

const emailtemplateSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    uniqueId: { type: String, required: true }, //auto-generated same as name but in uppercase and with spaces change to underscores
    subject: { type: String, required: true },
    body: { type: String, required: true },
    placeholders: [{ type: String, required: true }],
    status: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const EmailTemplate = mongoose.models.EmailTemplate || mongoose.model('EmailTemplate', emailtemplateSchema);
