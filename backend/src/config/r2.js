import { S3Client } from '@aws-sdk/client-s3';

let s3Client;

export function getS3Client() {
  if (!s3Client) {
    s3Client = new S3Client({
      region: 'auto',
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
      },
    });
  }
  return s3Client;
}

export const R2_BUCKET = () => process.env.R2_BUCKET_NAME;
export const R2_PUBLIC_URL = () => process.env.R2_PUBLIC_URL;
