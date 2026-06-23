import { Router } from 'express';
import { body, query as qv } from 'express-validator';
import { authenticate } from '../middleware/auth.js';
import { requireClientAccess, validate } from '../middleware/clientAccess.js';
import { PostModel } from '../models/Post.js';
import { schedulePost, cancelScheduledPost } from '../queues/postQueue.js';
import { PublishingService } from '../services/publishingService.js';
import { ApiError } from '../utils/apiError.js';
import { query } from '../config/database.js';

const router = Router();
router.use(authenticate);

// Create a post
router.post('/', validate([
  body('clientId').isInt({ min: 1 }),
  body('caption').optional().isString(),
  body('content_type').isIn(['image', 'video', 'carousel', 'story']),
  body('status').optional().isIn(['draft', 'scheduled', 'publishing']),
  body('scheduled_time').optional().isISO8601(),
  body('accountIds').isArray({ min: 1 }),
  body('media').isArray({ min: 1 }),
]), requireClientAccess, async (req, res, next) => {
  try {
    const { clientId, caption, content_type, status, scheduled_time, timezone, accountIds, media } = req.body;

    // Validate: scheduled posts must have a time
    if (status === 'scheduled' && !scheduled_time) throw ApiError.badRequest('scheduled_time required for scheduled posts');
    if (scheduled_time && new Date(scheduled_time) <= new Date()) throw ApiError.badRequest('scheduled_time must be in the future');

    const result = await PostModel.create({
      client_id: clientId,
      caption,
      content_type,
      status: status || 'draft',
      scheduled_time: scheduled_time || null,
      timezone: timezone || 'Asia/Kolkata',
      created_by: req.user.id,
    });
    const postId = result.insertId;

    // Save media items
    for (let i = 0; i < media.length; i++) {
      const m = media[i];
      await PostModel.addMedia({
        post_id: postId,
        media_url: m.url,
        media_type: m.mediaType,
        order_index: i,
        r2_key: m.r2Key,
        file_size: m.fileSize || null,
        mime_type: m.mimeType || null,
        width: m.width || null,
        height: m.height || null,
        duration_s: m.duration || null,
        cover_url: m.coverUrl || null,
      });
    }

    // Save platform targets
    for (const accountId of accountIds) {
      await PostModel.addPlatform(postId, accountId);
    }

    // If scheduled, enqueue the Bull job
    if (status === 'scheduled' && scheduled_time) {
      await schedulePost(postId, scheduled_time);
    }

    // If "publish now"
    if (status === 'publishing') {
      PublishingService.publishPost(postId).catch(err =>
        console.error('Immediate publish failed', { postId, error: err.message })
      );
    }

    res.status(201).json({ success: true, postId });
  } catch (err) { next(err); }
});

// Get posts for a client
router.get('/', validate([
  qv('clientId').optional().isInt(),
  qv('status').optional().isIn(['draft', 'scheduled', 'publishing', 'published', 'failed', 'partially_failed']),
  qv('limit').optional().isInt({ min: 1, max: 100 }),
  qv('offset').optional().isInt({ min: 0 }),
]), async (req, res, next) => {
  try {
    const { clientId, status, limit, offset } = req.query;
    if (!clientId) throw ApiError.badRequest('clientId required');
    const posts = await PostModel.findByClient(clientId, { status, limit: parseInt(limit || 50), offset: parseInt(offset || 0) });
    res.json({ success: true, posts });
  } catch (err) { next(err); }
});

// Calendar range
router.get('/calendar', async (req, res, next) => {
  try {
    const { clientId, start, end } = req.query;
    if (!start || !end) throw ApiError.badRequest('start and end dates required');
    const posts = await PostModel.findInRange(clientId || null, start, end);
    res.json({ success: true, posts });
  } catch (err) { next(err); }
});

// Get single post with media + platforms
router.get('/:id', async (req, res, next) => {
  try {
    const post = await PostModel.findById(req.params.id);
    if (!post) throw ApiError.notFound('Post not found');
    const [media, platforms] = await Promise.all([
      PostModel.getMedia(req.params.id),
      PostModel.getPlatforms(req.params.id),
    ]);
    res.json({ success: true, post, media, platforms });
  } catch (err) { next(err); }
});

// Update a post
router.patch('/:id', async (req, res, next) => {
  try {
    const post = await PostModel.findById(req.params.id);
    if (!post) throw ApiError.notFound('Post not found');
    if (post.status === 'published') throw ApiError.badRequest('Cannot edit a published post');

    const { caption, scheduled_time, status, accountIds, media } = req.body;
    const updates = {};
    if (caption !== undefined) updates.caption = caption;
    if (scheduled_time !== undefined) updates.scheduled_time = scheduled_time;
    if (status !== undefined) updates.status = status;

    if (Object.keys(updates).length) await PostModel.update(req.params.id, updates);

    if (media) {
      await PostModel.clearMedia(req.params.id);
      for (let i = 0; i < media.length; i++) {
        const m = media[i];
        await PostModel.addMedia({ post_id: req.params.id, media_url: m.url, media_type: m.mediaType, order_index: i, r2_key: m.r2Key, file_size: m.fileSize, mime_type: m.mimeType });
      }
    }

    if (accountIds) {
      await query('DELETE FROM post_platforms WHERE post_id = ?', [req.params.id]);
      for (const aId of accountIds) await PostModel.addPlatform(req.params.id, aId);
    }

    // Re-schedule in queue if time changed
    if (scheduled_time) {
      await cancelScheduledPost(req.params.id);
      await schedulePost(req.params.id, scheduled_time);
    }

    res.json({ success: true });
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const post = await PostModel.findById(req.params.id);
    if (!post) throw ApiError.notFound();
    if (post.status === 'published' && req.user.role !== 'admin') throw ApiError.forbidden('Only admins can delete published posts');
    await cancelScheduledPost(req.params.id);
    await PostModel.delete(req.params.id);
    res.json({ success: true });
  } catch (err) { next(err); }
});

// Retry a failed platform publish
router.post('/:id/retry/:postPlatformId', async (req, res, next) => {
  try {
    await PublishingService.retryPlatform(req.params.postPlatformId);
    res.json({ success: true, message: 'Retry initiated' });
  } catch (err) { next(err); }
});

// Publish now (move from draft)
router.post('/:id/publish-now', async (req, res, next) => {
  try {
    const post = await PostModel.findById(req.params.id);
    if (!post) throw ApiError.notFound();
    if (!['draft', 'scheduled', 'failed'].includes(post.status)) throw ApiError.badRequest('Post is not publishable');

    await PostModel.update(req.params.id, { status: 'publishing' });
    PublishingService.publishPost(req.params.id).catch(err =>
      console.error('Publish-now failed', { postId: req.params.id, error: err.message })
    );
    res.json({ success: true, message: 'Publishing started' });
  } catch (err) { next(err); }
});

// Publish logs for a post platform
router.get('/:id/logs/:postPlatformId', async (req, res, next) => {
  try {
    const logs = await query(
      'SELECT * FROM publish_logs WHERE post_platform_id = ? ORDER BY logged_at DESC',
      [req.params.postPlatformId]
    );
    res.json({ success: true, logs });
  } catch (err) { next(err); }
});

export default router;
