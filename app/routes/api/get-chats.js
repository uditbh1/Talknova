import { json } from '@remix-run/node';
import { ChatTranscript } from '~/models/chattranscript';

export async function loader({ request }) {
  const url = new URL(request.url);
  const clientId = url.searchParams.get('id');

  if (!clientId) {
    return json({ error: 'Missing required query parameter `id`.' }, { status: 400 });
  }

  try {
    const chats = await ChatTranscript.find({ clientId }).sort({ createdAt: -1 }).lean();

    return json({ chats });
  } catch (error) {
    console.error('Error fetching chat transcripts', error);
    return json({ error: 'Failed to fetch chat transcripts.' }, { status: 500 });
  }
}
