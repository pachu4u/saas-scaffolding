import { env } from '@platform/config';
import { Redis } from 'ioredis';

const globalForRedis = globalThis as unknown as { redis: Redis | undefined };

export const redis =
  globalForRedis.redis ??
  new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: 3,
    enableReadyCheck: false,
    lazyConnect: true,
  });

if (env.NODE_ENV !== 'production') {
  globalForRedis.redis = redis;
}
