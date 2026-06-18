import Redis from 'ioredis';
import logger from '../utils/logger.js';

let client;

export function getRedis() {
  if (!client) {
    client = new Redis({
      host: process.env.REDIS_HOST || '127.0.0.1',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD || undefined,
      maxRetriesPerRequest: 3,
      lazyConnect: false,
      retryStrategy: (times) => {
        if (times > 10) return null;
        return Math.min(times * 200, 2000);
      },
    });

    client.on('connect', () => logger.info('Redis: connected'));
    client.on('error', (err) => logger.error('Redis error', { error: err.message }));
    client.on('reconnecting', () => logger.warn('Redis: reconnecting'));
  }
  return client;
}

export async function testConnection() {
  const redis = getRedis();
  await redis.ping();
  logger.info('Redis: ping OK');
}
