import { mongoose } from '~/config/db.server';
var Schema = mongoose.Schema;

const leadSchema = new mongoose.Schema(
  {
    name: String,
    email: { type: String, index: true },
    phone: String,
  },
  { _id: false }
);

const messageSchema = new mongoose.Schema(
  {
    role: { type: String, enum: ['userMessage', 'apiMessage', 'leadCaptureMessage'], required: true },
    content: String,
    createdDate: Date,
    messageId: String,
    fileUploads: [String],
  },
  { _id: false }
);

const chatTranscriptSchema = new mongoose.Schema(
  {
    clientId: { type: String, required: true, index: true }, // tenant
    chatId: { type: String, required: true, unique: true }, // Flowise id
    agent: { type: Schema.Types.ObjectId, ref: 'User' },
    lead: leadSchema,
    messages: [messageSchema],
  },
  { timestamps: true /* createdAt + updatedAt */ }
); /* Mongoose docs :contentReference[oaicite:6]{index=6} */

export const ChatTranscript = mongoose.models.ChatTranscript ?? mongoose.model('ChatTranscript', chatTranscriptSchema);
