import { env } from '@platform/config';
import { adminDb, redis } from '@platform/db';
import { emailQueue, tenantProvisionQueue } from '@platform/jobs';
import { getVaultClient } from '@platform/vault';

import { getQueueTotals } from './queue-stats';

/**
 * Real dependency checks for the admin dashboard's System Health panel and the
 * /admin/health report. Each check runs in parallel with its own timeout, so a
 * hung dependency shows up as "down" instead of stalling the page.
 *
 * Not used by /api/health or /_health: those stay dependency-free so the load
 * balancer and Docker healthchecks never flap because Postgres or Keycloak is
 * slow.
 */

export type HealthStatus = 'healthy' | 'degraded' | 'down';

export interface HealthCheckResult {
  key: string;
  service: string;
  status: HealthStatus;
  latencyMs: number;
  detail: string;
}

export interface HealthReport {
  status: HealthStatus;
  checkedAt: string;
  checks: HealthCheckResult[];
}

export const CHECK_TIMEOUT_MS = 2_000;

interface CheckOutcome {
  status: HealthStatus;
  detail: string;
}

class TimeoutError extends Error {
  constructor(ms: number) {
    super(`timed out after ${String(ms)}ms`);
    this.name = 'TimeoutError';
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new TimeoutError(ms));
    }, ms);
  });
  return Promise.race([promise, timeout]).finally(() => {
    clearTimeout(timer);
  });
}

/** First line of an error message, trimmed, so driver errors stay readable. */
function describeError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  const firstLine = message.split('\n').find((l) => l.trim().length > 0) ?? 'unknown error';
  return firstLine.trim().slice(0, 200);
}

async function runCheck(
  key: string,
  service: string,
  fn: () => Promise<CheckOutcome>,
  timeoutMs: number,
): Promise<HealthCheckResult> {
  const started = performance.now();
  try {
    const outcome = await withTimeout(fn(), timeoutMs);
    return { key, service, ...outcome, latencyMs: Math.round(performance.now() - started) };
  } catch (err) {
    return {
      key,
      service,
      status: 'down',
      detail: describeError(err),
      latencyMs: Math.round(performance.now() - started),
    };
  }
}

async function checkPostgres(): Promise<CheckOutcome> {
  await adminDb.$queryRaw`SELECT 1`;
  return { status: 'healthy', detail: 'SELECT 1 succeeded' };
}

async function checkRedis(): Promise<CheckOutcome> {
  await redis.ping();
  return { status: 'healthy', detail: 'PING returned PONG' };
}

async function checkKeycloak(): Promise<CheckOutcome> {
  // Prefer the in-cluster issuer so the check doesn't hairpin through the LB.
  const issuer = (env.KEYCLOAK_INTERNAL_ISSUER ?? env.KEYCLOAK_ISSUER).replace(/\/$/, '');
  const res = await fetch(`${issuer}/.well-known/openid-configuration`, {
    cache: 'no-store',
    signal: AbortSignal.timeout(CHECK_TIMEOUT_MS),
  });
  if (!res.ok) {
    return { status: 'down', detail: `OIDC discovery returned HTTP ${String(res.status)}` };
  }
  return { status: 'healthy', detail: `realm ${env.KEYCLOAK_REALM} discovery OK` };
}

/**
 * Workers are healthy when at least one BullMQ worker is connected to the main
 * queue and no queue has failed jobs waiting in its dead-letter set. The tenant-provision worker
 * runs separately in k3s, so it's reported in the detail but a missing one is
 * only "degraded" (tenant signups would stall, everything else still works).
 */
async function checkWorkers(): Promise<CheckOutcome> {
  const [mainWorkers, provisionWorkers, queues] = await Promise.all([
    emailQueue.getWorkersCount(),
    tenantProvisionQueue.getWorkersCount(),
    getQueueTotals(),
  ]);
  const deadJobs = queues.failed;
  const failing = queues.byQueue
    .filter((q) => q.failed > 0)
    .map((q) => `${q.name} ${String(q.failed)}`)
    .join(', ');

  const detail = `${String(mainWorkers)} main / ${String(provisionWorkers)} provisioner workers connected, ${String(deadJobs)} failed jobs${failing ? ` (${failing})` : ''}`;
  if (mainWorkers === 0) return { status: 'down', detail };
  if (provisionWorkers === 0 || deadJobs > 0) return { status: 'degraded', detail };
  return { status: 'healthy', detail };
}

async function checkVault(): Promise<CheckOutcome> {
  const healthy = await getVaultClient().isHealthy();
  return healthy
    ? { status: 'healthy', detail: 'sys/health reports unsealed' }
    : { status: 'down', detail: 'sys/health unreachable, sealed or uninitialised' };
}

const CHECKS: { key: string; service: string; fn: () => Promise<CheckOutcome> }[] = [
  { key: 'postgres', service: 'Database (Postgres)', fn: checkPostgres },
  { key: 'redis', service: 'Redis', fn: checkRedis },
  { key: 'keycloak', service: 'Keycloak (IAM)', fn: checkKeycloak },
  { key: 'workers', service: 'Workers (BullMQ)', fn: checkWorkers },
  { key: 'vault', service: 'HashiCorp Vault', fn: checkVault },
];

export function overallStatus(checks: HealthCheckResult[]): HealthStatus {
  if (checks.some((c) => c.status === 'down')) return 'down';
  if (checks.some((c) => c.status === 'degraded')) return 'degraded';
  return 'healthy';
}

export async function getSystemHealth(timeoutMs = CHECK_TIMEOUT_MS): Promise<HealthReport> {
  const dependencyChecks = await Promise.all(
    CHECKS.map((c) => runCheck(c.key, c.service, c.fn, timeoutMs)),
  );
  // This code is running, so the web tier itself is up by definition.
  const checks: HealthCheckResult[] = [
    {
      key: 'web',
      service: 'Web (Next.js)',
      status: 'healthy',
      latencyMs: 0,
      detail: `serving ${env.BUILD_SHA ?? env.GIT_SHA}`,
    },
    ...dependencyChecks,
  ];
  return { status: overallStatus(checks), checkedAt: new Date().toISOString(), checks };
}
