import { PassThrough } from "stream";
import slugify from "slugify";
import mime from "mime-types";
import AWS from "aws-sdk";
import type { UploadHandler } from "@remix-run/node";
import { writeAsyncIterableToWritable } from "@remix-run/node";

const { STORAGE_ACCESS_KEY, STORAGE_SECRET, STORAGE_REGION, STORAGE_BUCKET } =
  process.env;

// Don't throw at module load - check during upload instead
// This allows the app to start even if env vars are missing, but uploads will fail with clear errors

let s3: AWS.S3 | null = null;

function getS3Client(): AWS.S3 {
  if (!s3) {
    if (
      !(
        STORAGE_ACCESS_KEY &&
        STORAGE_SECRET &&
        STORAGE_REGION &&
        STORAGE_BUCKET
      )
    ) {
      throw new Error(
        `S3 storage is not configured. Missing required environment variables: ` +
          `${!STORAGE_ACCESS_KEY ? "STORAGE_ACCESS_KEY " : ""}` +
          `${!STORAGE_SECRET ? "STORAGE_SECRET " : ""}` +
          `${!STORAGE_REGION ? "STORAGE_REGION " : ""}` +
          `${!STORAGE_BUCKET ? "STORAGE_BUCKET " : ""}`
      );
    }
    s3 = new AWS.S3({
      credentials: {
        accessKeyId: STORAGE_ACCESS_KEY,
        secretAccessKey: STORAGE_SECRET,
      },
      region: STORAGE_REGION,
    });
  }
  return s3;
}

const uploadStream = ({ Key }: Pick<AWS.S3.Types.PutObjectRequest, "Key">) => {
  const s3Client = getS3Client();
  const pass = new PassThrough();
  const mimeType = mime.lookup(Key) || "application/octet-stream";
  return {
    writeStream: pass,
    promise: s3Client
      .upload({
        Bucket: STORAGE_BUCKET!,
        Key,
        Body: pass,
        ContentType: mimeType,
      })
      .promise(),
  };
};

export async function uploadStreamToS3(data: any, filename: string) {
  try {
    // Validate environment variables are set
    if (
      !STORAGE_ACCESS_KEY ||
      !STORAGE_SECRET ||
      !STORAGE_REGION ||
      !STORAGE_BUCKET
    ) {
      throw new Error(
        `Missing S3 configuration. Required: STORAGE_ACCESS_KEY, STORAGE_SECRET, STORAGE_REGION, STORAGE_BUCKET. ` +
          `Found: ${JSON.stringify({
            hasAccessKey: !!STORAGE_ACCESS_KEY,
            hasSecret: !!STORAGE_SECRET,
            hasRegion: !!STORAGE_REGION,
            hasBucket: !!STORAGE_BUCKET,
          })}`
      );
    }

    const slugifyName = slugify(filename);
    const uniqueName = `${Date.now().toString()}-${slugifyName}`;
    const stream = uploadStream({
      Key: uniqueName,
    });
    await writeAsyncIterableToWritable(data, stream.writeStream);
    const file = await stream.promise;
    console.log(
      `[S3 Upload] File uploaded successfully: ${filename} -> ${file.Key}`
    );
    return file.Key;
  } catch (error) {
    console.error(
      `[S3 Upload] Error in uploadStreamToS3 for ${filename}:`,
      error
    );
    throw error;
  }
}

export const s3UploadHandler: UploadHandler = async ({ filename, data }) => {
  if (filename == "") return ""; //No file uploaded
  if (!filename) return undefined; //Normal form submission

  try {
    const uploadedFileLocation = await uploadStreamToS3(data, filename!);
    console.log(
      `[S3 Upload] Successfully uploaded: ${filename} -> ${uploadedFileLocation}`
    );
    return uploadedFileLocation;
  } catch (error) {
    console.error(`[S3 Upload] Error uploading file ${filename}:`, error);
    // Re-throw the error so it can be caught by the action handler
    throw new Error(
      `Failed to upload file ${filename}: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
};

export async function renameS3File(oldFilename: string, newFilename: string) {
  try {
    const s3Client = getS3Client();
    if (!STORAGE_BUCKET) {
      console.error("STORAGE_BUCKET is not defined.");
      return false;
    }

    let uniqueFilename: string = newFilename;
    let StorageBucket: string = STORAGE_BUCKET;

    // Function to check if a file exists in the bucket
    async function fileExists(filename: string): Promise<boolean> {
      try {
        await s3Client
          .headObject({
            Bucket: StorageBucket,
            Key: filename,
          })
          .promise();
        return true;
      } catch (error) {
        return false;
      }
    }

    // Check if the file already exists, and create a unique name if it does
    while (await fileExists(uniqueFilename)) {
      const randomDigits: number = Math.floor(Math.random() * 900) + 100; // Generate a random three-digit number
      uniqueFilename = `${
        newFilename.split(".")[0]
      }_${randomDigits}.${newFilename.split(".").pop()}`;
    }

    // Copy the old file with the unique filename
    await s3Client
      .copyObject({
        Bucket: STORAGE_BUCKET,
        CopySource: `${STORAGE_BUCKET}/${oldFilename}`,
        Key: uniqueFilename,
      })
      .promise();

    return uniqueFilename; // Return the unique filename if the operation was successful
  } catch (error) {
    console.error(error);
    return false; // Return false if any error occurs
  }
}
