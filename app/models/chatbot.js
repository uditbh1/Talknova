//create student module schema

import { mongoose } from '~/config/db.server';
var Schema = mongoose.Schema;

var chatbotSchema = new Schema(
  {
    name: { type: String, required: true },
    agentId: { type: Number, required: true },
    clients: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    prompt: { type: String, default: '' },
    temperature: { type: Number, default: 0.5 },
    description: { type: String, default: '' },
    documents: [{ type: String, required: true }],
    weburls: [{ type: String }],
    otherFiles: [{ type: String }],
    mdFile: { type: String, default: '' },
    theme: { type: Object, default: {} },
    initialized: { type: Boolean, default: false },
    isApproved: { type: Boolean, default: false },
    status: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const ChatBot = mongoose.models.ChatBot || mongoose.model('ChatBot', chatbotSchema);
