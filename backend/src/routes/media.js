import { Router } from 'express';
import multer from 'multer';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { authenticate } from '../middleware/auth.js';
import { R2Service } from '../services/r2Service.js';
import { ApiError } from '../utils/apiError.js';
import logger from '../utils/logger.js';

const router = Router();

// Use disk storage to avoid OOM crashes on large video uploads
const upload = multer({
  storage: multer.diskStorage({
    destination: os.tmpdir(),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `odm-upload-${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
    },
  }),
  limits: { fileSize: 500 * 1024 * 1024 },
  fileFilter(req, file, cb) {
    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/quicktime'];
    cb(null, allowed.includes(file.mimetype));
  },
});

router.post('/upload', authenticate, upload.single('file'), async (req, res, next) => {
  const tmpPath = req.file?.path;
  try {
    if (!req.file) throw ApiError.badRequest('No file uploaded or file type not supported');
    const { clientId } = req.body;
    if (!clientId) throw ApiError.badRequest('clientId required');

    R2Service.validateFile(req.file.mimetype, req.file.size);
    const key = R2Service.generateKey(clientId, req.file.originalname);

    // Stream from disk to R2 — no RAM spike for large videos
    const fileStream = fs.createReadStream(tmpPath);
    const publicUrl = await R2Service.uploadStream(key, fileStream, req.file.mimetype, req.file.size);

    const mediaType = req.file.mimetype.startsWith('video/') ? 'video' : 'image';

    res.json({
      success: true,
      media: {
        url: publicUrl,
        r2Key: key,
        mediaType,
        mimeType: req.file.mimetype,
        fileSize: req.file.size,
        originalName: req.file.originalname,
      },
    });
  } catch (err) {
    next(err);
  } finally {
    if (tmpPath) fs.unlink(tmpPath, () => {});
  }
});

router.post('/presign', authenticate, async (req, res, next) => {
  try {
    const { clientId, filename, mimetype, size } = req.body;
    if (!clientId || !filename || !mimetype || !size) throw ApiError.badRequest('clientId, filename, mimetype, size required');
    R2Service.validateFile(mimetype, parseInt(size));
    const key = R2Service.generateKey(clientId, filename);
    const uploadUrl = await R2Service.getUploadUrl(key, mimetype, 600);
    const publicUrl = R2Service.publicUrl(key);
    res.json({ success: true, uploadUrl, key, publicUrl });
  } catch (err) { next(err); }
});

router.delete('/delete', authenticate, async (req, res, next) => {
  try {
    const { r2Key } = req.body;
    if (!r2Key) throw ApiError.badRequest('r2Key required');
    await R2Service.delete(r2Key);
    res.json({ success: true });
  } catch (err) { next(err); }
});

export default router;
