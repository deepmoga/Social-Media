import Bull from 'bull';
import { getRedis } from '../config/redis.js';
import logger from '../utils/logger.js';

let queue;

export function getPostQueue() {
  if (!queue) {
    const redisConfig = {
      host: process.env.REDIS_HOST || '127.0.0.1',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD || undefined,
    };

    queue = new Bull('post-publishing', { redis: redisConfig });

    queue.on('error', (err) => logger.error('Bull queue error', { error: err.message }));
    queue.on('failed', (job, err) =>
      logger.error('Bull job failed', { jobId: job.id, data: job.data, error: err.message })
    );
    queue.on('completed', (job) =>
      logger.info('Bull job completed', { jobId: job.id, data: job.data })
    );
  }
  return queue;
}

export async function schedulePost(postId, scheduledTime) {
  const queue = getPostQueue();
  const delay = new Date(scheduledTime).getTime() - Date.now();
  const job = await queue.add(
    { postId },
    {
      delay: Math.max(delay, 0),
      attempts: 3,
      backoff: { type: 'exponential', delay: 60000 },
      removeOnComplete: 100,
      removeOnFail: 200,
      jobId: `post-${postId}`,
    }
  );
  logger.info('Post scheduled in queue', { postId, scheduledTime, jobId: job.id, delay });
  return job.id;
}

export async function cancelScheduledPost(postId) {
  const queue = getPostQueue();
  const job = await queue.getJob(`post-${postId}`);
  if (job) {
    await job.remove();
    logger.info('Post removed from queue', { postId });
  }
}
