import Redis from 'ioredis';

import { env } from '@platform/config';

const globalForRedis = globalThis as unknown as { redis: Redis | undefined };

export const redis =
  globalForRedis.redis ??
  new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    lazyConnect: false,
  });

if (env.NODE_ENV !== 'production') {
  globalForRedis.redis = redis;
}
