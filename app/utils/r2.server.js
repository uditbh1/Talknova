import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

let cachedClient = null;
let cachedClientKey = "";

function getR2Config() {
  const bucket = process.env.R2_BUCKET_NAME;
  const accessKeyId = process.env.R2_ACCESS_KEY;
  const secretAccessKey = process.env.R2_SECRET_KEY;
  const endpoint = process.env.R2_S3_API_ENDPOINT;
  const region = process.env.R2_S3_API_REGION ?? "auto";

  if (!bucket) throw new Error("Missing R2_BUCKET_NAME env var.");
  if (!accessKeyId || !secretAccessKey) {
    throw new Error("Missing R2_ACCESS_KEY/R2_SECRET_KEY env vars.");
  }

  return {
    bucket,
    clientConfig: {
      region,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
      ...(endpoint
        ? {
            endpoint,
            forcePathStyle: true,
          }
        : {}),
    },
  };
}

export function createR2ClientAndBucket() {
  const { bucket, clientConfig } = getR2Config();
  const clientKey = JSON.stringify({ bucket, ...clientConfig });

  if (!cachedClient || cachedClientKey !== clientKey) {
    cachedClient = new S3Client(clientConfig);
    cachedClientKey = clientKey;
  }

  return {
    bucket,
    client: cachedClient,
  };
}

export async function bodyToString(body) {
  if (!body) return "";
  if (typeof body.transformToString === "function") {
    return body.transformToString();
  }

  const chunks = [];
  for await (const chunk of body) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return Buffer.concat(chunks).toString("utf-8");
}

export async function putR2TextObject({
  key,
  body,
  contentType = "text/plain; charset=utf-8",
}) {
  const { client, bucket } = createR2ClientAndBucket();

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );

  return key;
}

export async function getR2ObjectString(key) {
  const { client, bucket } = createR2ClientAndBucket();
  const result = await client.send(
    new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    }),
  );

  return bodyToString(result.Body);
}
