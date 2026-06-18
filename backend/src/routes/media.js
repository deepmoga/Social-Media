import { Router } from 'express';
import multer from 'multer';
import { authenticate } from '../middleware/auth.js';
import { R2Service } from '../services/r2Service.js';
import { ApiError } from '../utils/apiError.js';
import logger from '../utils/logger.js';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 500 * 1024 * 1024 },
  fileFilter(req, file, cb) {
    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/quicktime'];
    cb(null, allowed.includes(file.mimetype));
  },
});

router.post('/upload', authenticate, upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) throw ApiError.badRequest('No file uploaded or file type not supported');
    const { clientId } = req.body;
    if (!clientId) throw ApiError.badRequest('clientId required');

    R2Service.validateFile(req.file.mimetype, req.file.size);
    const key = R2Service.generateKey(clientId, req.file.originalname);
    const publicUrl = await R2Service.upload(key, req.file.buffer, req.file.mimetype);

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
