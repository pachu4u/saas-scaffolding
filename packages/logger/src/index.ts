import pino, { type Logger } from 'pino';

import { env } from '@platform/config';

// Prevent logging secrets even if accidentally passed
const REDACT_PATHS = [
  'password', 'secret', 'token', 'authorization', 'cookie',
  'req.headers.authorization', 'req.headers.cookie',
  '*.password', '*.secret', '*.token', '*.hashedToken',
];

const isDev = env.NODE_ENV === 'development';

export const logger: Logger = pino({
  level: isDev ? 'debug' : 'info',
  redact: { paths: REDACT_PATHS, censor: '[REDACTED]' },
  ...(isDev
    ? {
        transport: {
          target: 'pino-pretty',
          options: { colorize: true, translateTime: 'SYS:HH:MM:ss', ignore: 'pid,hostname' },
        },
      }
    : {}),
  base: {
    service: env.OTEL_SERVICE_NAME,
    env: env.NODE_ENV,
  },
  formatters: {
    level(label) {
      return { level: label };
    },
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

/**
 * Create a child logger pre-stamped with request context.
 */
export function requestLogger(fields: {
  requestId: string;
  tenantId?: string;
  userId?: string;
  method?: string;
  path?: string;
}): Logger {
  return logger.child(fields);
}

/**
 * Strip known secret patterns from an object before audit-log storage.
 */
export function scrubSecrets<T extends object>(obj: T): T {
  const SECRET_KEYS = /password|secret|token|key|authorization/i;
  return JSON.parse(
    JSON.stringify(obj, (k, v) => (SECRET_KEYS.test(k) ? '[REDACTED]' : (v as unknown))),
  ) as T;
}
