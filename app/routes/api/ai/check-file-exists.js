// app/routes/api/ai/check-file-exists.jsx
import { json } from '@remix-run/node';
import { QdrantClient } from '@qdrant/js-client-rest';

export async function loader({ request }) {
  try {
    // read ?filename=... from query
    const url = new URL(request.url);
    const filename = url.searchParams.get('filename');
    if (!filename) {
      return json({ exists: false, error: 'No filename provided' }, { status: 400 });
    }

    // environment variables
    const QDRANT_API_URL = process.env.QDRANT_API_URL;
    const QDRANT_API_KEY = process.env.QDRANT_API_KEY;
    const QDRANT_COLLECTION_NAME = process.env.QDRANT_COLLECTION_NAME;

    // init client
    const qdrantClient = new QdrantClient({
      url: QDRANT_API_URL,
      apiKey: QDRANT_API_KEY,
    });

    // check if doc is in Qdrant
    const scrollRes = await qdrantClient.scroll(QDRANT_COLLECTION_NAME, {
      limit: 1,
      filter: {
        must: [{ key: 'metadata.filename', match: { value: filename } }],
      },
    });

    const exists = scrollRes.points && scrollRes.points.length > 0;

    return json({ exists }, { status: 200 });
  } catch (err) {
    console.error('check-file-exists Error =>', err);
    return json({ exists: false, error: err.message }, { status: 500 });
  }
}
