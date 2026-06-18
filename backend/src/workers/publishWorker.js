import { getPostQueue } from '../queues/postQueue.js';
import { PublishingService } from '../services/publishingService.js';
import logger from '../utils/logger.js';

export function startPublishWorker() {
  const queue = getPostQueue();

  queue.process(async (job) => {
    const { postId } = job.data;
    logger.info('Worker: processing post', { postId, jobId: job.id });
    const status = await PublishingService.publishPost(postId);
    logger.info('Worker: post processed', { postId, status });
    return { postId, status };
  });

  logger.info('Publish worker started');
}
