import { mongoose } from '~/config/db.server';

const contactSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, required: true },
    company: { type: String, required: true },
    message: { type: String, required: true },
  },
  { timestamps: true }
);

export const ContactUsModel = mongoose.models.ContactUs || mongoose.model('ContactUs', contactSchema);
