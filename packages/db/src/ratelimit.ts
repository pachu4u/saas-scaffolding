import { redis } from './redis.js';

// Sliding-window rate limiter using a Redis sorted set + Lua for atomicity.
// Timestamps (ms) are stored as both score and member (with jitter to avoid
// collisions when two requests arrive at the exact same millisecond).
const SCRIPT = `
local key      = KEYS[1]
local now      = tonumber(ARGV[1])
local window   = tonumber(ARGV[2])
local lim      = tonumber(ARGV[3])
local member   = ARGV[4]

redis.call('ZREMRANGEBYSCORE', key, '-inf', now - window)
local count = tonumber(redis.call('ZCARD', key))

if count < lim then
  redis.call('ZADD', key, now, member)
  redis.call('PEXPIRE', key, window)
  return {1, lim - count - 1, now + window}
end

local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
local reset  = now + window
if oldest[2] then reset = tonumber(oldest[2]) + window end
return {0, 0, reset}
`;

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  /** Unix ms timestamp when the current window resets */
  reset: number;
}

export interface RateLimitOptions {
  /** Logical name for this limit tier, e.g. 'api' or 'tenant' */
  prefix: string;
  /** Discriminator — IP address, tenant ID, or user ID */
  id: string;
  /** Maximum requests per window */
  limit: number;
  /** Window length in milliseconds */
  windowMs: number;
}

export async function checkRateLimit(opts: RateLimitOptions): Promise<RateLimitResult> {
  const key = `rl:${opts.prefix}:${opts.id}`;
  const now = Date.now();
  const member = `${String(now)}-${Math.random().toString(36).slice(2)}`;

  try {
    const result = (await redis.eval(
      SCRIPT,
      1,
      key,
      String(now),
      String(opts.windowMs),
      String(opts.limit),
      member,
    )) as [number, number, number];

    return {
      allowed: result[0] === 1,
      limit: opts.limit,
      remaining: Math.max(0, result[1]),
      reset: result[2],
    };
  } catch {
    // Redis unavailable — fail open so a cache outage never blocks users
    return { allowed: true, limit: opts.limit, remaining: opts.limit, reset: now + opts.windowMs };
  }
}

/** Builds the standard RateLimit-* headers from a result. */
export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    'X-RateLimit-Limit': String(result.limit),
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(Math.ceil(result.reset / 1000)), // Unix seconds
    'Retry-After': result.allowed ? '0' : String(Math.ceil((result.reset - Date.now()) / 1000)),
  };
}
