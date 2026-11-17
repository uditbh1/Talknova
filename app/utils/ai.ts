// ~/utils/ai.ts
import axios from 'axios';

interface CrawlPayload {
  urls: string[];
}

export async function crawl(payload: CrawlPayload) {
  const CRAWL4AI_URL = process.env.CRAWL4AI_URL;
  const CRAWL4AI_ID = process.env.CRAWL4AI_ID;
  const CRAWL4AI_PWD = process.env.CRAWL4AI_PWD;

  if (!CRAWL4AI_URL || !CRAWL4AI_ID || !CRAWL4AI_PWD) {
    throw new Error('Missing crawler configuration in environment variables.');
  }

  const authToken = Buffer.from(`${CRAWL4AI_ID}:${CRAWL4AI_PWD}`).toString('base64');

  try {
    const response = await axios.post(
      CRAWL4AI_URL + '/crawl',
      { urls: payload.urls },
      {
        headers: {
          Authorization: `Basic ${authToken}`,
          'Content-Type': 'application/json',
        },
      }
    );
    return response.data; // { status: boolean, message: string }
  } catch (error: any) {
    throw new Error(error.response?.data?.message || error.message);
  }
}
