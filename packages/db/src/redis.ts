import { env } from '@platform/config';
import { Redis } from 'ioredis';

const globalForRedis = globalThis as unknown as { redis: Redis | undefined };

const redisUrl = new URL(env.REDIS_URL);

export const redis =
  globalForRedis.redis ??
  new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: 3,
    enableReadyCheck: false,
    lazyConnect: true,
    // ioredis's URL-string constructor enables TLS for rediss:// but doesn't
    // populate `servername` (SNI) from the URL host -- some managed Redis
    // providers front their instances with an SNI-routing gateway that
    // silently drops the connection (ETIMEDOUT/EPIPE, no clear auth or TLS
    // error) without it. Harmless to always set for plain redis:// too.
    ...(redisUrl.protocol === 'rediss:' ? { tls: { servername: redisUrl.hostname } } : {}),
  });

if (env.NODE_ENV !== 'production') {
  globalForRedis.redis = redis;
}
