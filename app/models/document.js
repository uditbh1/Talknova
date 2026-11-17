//create student module schema

import { mongoose } from '~/config/db.server';
var Schema = mongoose.Schema;

var documentSchema = new Schema(
  {
    title: { type: String, required: true },
    file: { type: String, required: true },
    description: { type: String, required: false, default: '' },
    isVideo: { type: Boolean, default: false },
    videoUrl: { type: String, required: false, default: '' },
    isVector: { type: Boolean, default: false },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    status: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const Document = mongoose.models.Document || mongoose.model('Document', documentSchema);
