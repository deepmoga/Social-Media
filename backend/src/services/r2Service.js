import { PutObjectCommand, DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { getS3Client, R2_BUCKET, R2_PUBLIC_URL } from '../config/r2.js';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import logger from '../utils/logger.js';

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'video/mp4', 'video/quicktime', 'video/mov',
]);

const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500 MB

export const R2Service = {
  validateFile(mimetype, size) {
    if (!ALLOWED_MIME_TYPES.has(mimetype)) {
      throw new Error(`File type ${mimetype} is not supported`);
    }
    if (size > MAX_FILE_SIZE) {
      throw new Error(`File size exceeds 500 MB limit`);
    }
  },

  generateKey(clientId, originalName) {
    const ext = path.extname(originalName).toLowerCase();
    const id = uuidv4();
    return `clients/${clientId}/media/${id}${ext}`;
  },

  async upload(key, buffer, mimetype) {
    if (!process.env.R2_ACCOUNT_ID || !process.env.R2_ACCESS_KEY_ID || !process.env.R2_SECRET_ACCESS_KEY || !process.env.R2_BUCKET_NAME) {
      throw new Error('Cloudflare R2 not configured. Please add R2 credentials in Settings → API Keys.');
    }
    const client = getS3Client();
    await client.send(new PutObjectCommand({
      Bucket: R2_BUCKET(),
      Key: key,
      Body: buffer,
      ContentType: mimetype,
    }));
    const publicUrl = `${R2_PUBLIC_URL()}/${key}`;
    logger.info('R2: uploaded', { key, size: buffer.length });
    return publicUrl;
  },

  async delete(key) {
    const client = getS3Client();
    await client.send(new DeleteObjectCommand({ Bucket: R2_BUCKET(), Key: key }));
    logger.info('R2: deleted', { key });
  },

  publicUrl(key) {
    return `${R2_PUBLIC_URL()}/${key}`;
  },

  // Generate presigned upload URL for direct-to-R2 browser uploads (optional path)
  async getUploadUrl(key, mimetype, expiresIn = 300) {
    const client = getS3Client();
    const command = new PutObjectCommand({ Bucket: R2_BUCKET(), Key: key, ContentType: mimetype });
    return getSignedUrl(client, command, { expiresIn });
  },
};
