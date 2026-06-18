import cron from 'node-cron';
import { PostModel } from '../models/Post.js';
import { PublishingService } from '../services/publishingService.js';
import logger from '../utils/logger.js';

// Backup sweep: pick up any scheduled posts that the Bull queue missed
export function startDuePostsJob() {
  cron.schedule('*/3 * * * *', async () => {
    try {
      const now = new Date();
      const duePosts = await PostModel.findScheduledBefore(now);
      if (!duePosts.length) return;

      logger.info(`Due-posts sweep: found ${duePosts.length} post(s)`);
      for (const post of duePosts) {
        try {
          await PublishingService.publishPost(post.id);
        } catch (err) {
          logger.error('Due-posts sweep: failed to publish', { postId: post.id, error: err.message });
        }
      }
    } catch (err) {
      logger.error('Due-posts sweep error', { error: err.message });
    }
  });

  logger.info('Due-posts cron job started (every 3 min)');
}
