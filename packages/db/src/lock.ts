import crypto from 'crypto';

import { redis } from './redis.js';

// Release only if we still hold the lock — avoids releasing a lock acquired
// by a newer holder after our TTL already expired.
const RELEASE_SCRIPT = `
if redis.call('get', KEYS[1]) == ARGV[1] then
  return redis.call('del', KEYS[1])
end
return 0
`;

export interface WithLockResult<T> {
  /** True if the lock was acquired and `fn` ran. */
  acquired: boolean;
  value?: T;
}

/**
 * Runs `fn` while holding an exclusive Redis lock keyed by `key`. If the lock
 * is already held (e.g. an overlapping retry of the same job), `fn` is
 * skipped and `acquired: false` is returned instead of racing.
 *
 * Fails open (treats the lock as acquired) if Redis is unreachable — a
 * correctness nice-to-have shouldn't turn a cache outage into a full outage.
 */
export async function withLock<T>(
  key: string,
  ttlMs: number,
  fn: () => Promise<T>,
): Promise<WithLockResult<T>> {
  const token = crypto.randomUUID();
  let acquired = true;
  try {
    const result = await redis.set(key, token, 'PX', ttlMs, 'NX');
    acquired = result === 'OK';
  } catch {
    // Redis unavailable — fail open.
  }

  if (!acquired) return { acquired: false };

  try {
    const value = await fn();
    return { acquired: true, value };
  } finally {
    await redis.eval(RELEASE_SCRIPT, 1, key, token).catch(() => undefined);
  }
}
