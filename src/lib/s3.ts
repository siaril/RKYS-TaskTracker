import { S3Client } from "@aws-sdk/client-s3";

// S3-compatible object storage for uploaded images. Works with AWS S3 (set the
// AWS_* vars) or any S3-compatible store like Cloudflare R2 (also set S3_ENDPOINT).
// If not configured, the app falls back to local disk (fine for local dev).

const bucket = process.env.S3_BUCKET;
const region = process.env.AWS_REGION;
const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
const endpoint = process.env.S3_ENDPOINT; // optional (e.g. R2)

export const S3_BUCKET = bucket ?? "";

export const isS3Configured = Boolean(bucket && region && accessKeyId && secretAccessKey);

export const s3 = isS3Configured
  ? new S3Client({
      region,
      endpoint: endpoint || undefined,
      forcePathStyle: Boolean(endpoint), // needed for R2/MinIO-style endpoints
      credentials: { accessKeyId: accessKeyId!, secretAccessKey: secretAccessKey! },
    })
  : null;

export const UPLOAD_PREFIX = "uploads/";
