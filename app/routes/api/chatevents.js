import { json } from '@remix-run/node';
import { ChatTranscript } from '~/models/chattranscript';

export async function action({ request }) {
  const { clientId, chatId, lead, transcript, agent } = await request.json();

  /* map Flowise → schema */
  const mapped = transcript.map((m, i) => ({
    role: m.type,
    content: m.message,
    createdDate: m.dateTime ? new Date(m.dateTime) : new Date(),
    messageId: m.messageId ?? `${chatId}-${i}`,
    fileUploads: Array.isArray(m.fileUploads) ? m.fileUploads : [],
  }));

  /* upsert without duplicate paths */
  const doc = await ChatTranscript.findOneAndUpdate(
    /* chatId OR (tenant + email) still decides which doc to merge into */
    chatId ? { chatId } : { clientId, 'lead.email': lead?.email ?? null },

    {
      $setOnInsert: { clientId, chatId, agent: agent ? agent : null },
      $set: { lead, messages: mapped, updatedAt: new Date() },
    },
    { upsert: true, new: true }
  );

  return json({ ok: true, id: doc._id });
}
