import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  queryRaw: vi.fn(),
  jobCount: vi.fn(),
  ping: vi.fn(),
  emailWorkers: vi.fn(),
  provisionWorkers: vi.fn(),
  vaultHealthy: vi.fn(),
}));

vi.mock('@platform/config', () => ({
  env: {
    KEYCLOAK_ISSUER: 'https://auth.example.test/realms/saas-platform',
    KEYCLOAK_INTERNAL_ISSUER: undefined,
    KEYCLOAK_REALM: 'saas-platform',
  },
}));
vi.mock('@platform/db', () => ({
  adminDb: { $queryRaw: mocks.queryRaw, job: { count: mocks.jobCount } },
  redis: { ping: mocks.ping },
}));
vi.mock('@platform/jobs', () => ({
  emailQueue: { getWorkersCount: mocks.emailWorkers },
  tenantProvisionQueue: { getWorkersCount: mocks.provisionWorkers },
}));
vi.mock('@platform/vault', () => ({
  getVaultClient: () => ({ isHealthy: mocks.vaultHealthy }),
}));

import { getSystemHealth } from './system-health';

const fetchMock = vi.fn();

function byKey(report: Awaited<ReturnType<typeof getSystemHealth>>, key: string) {
  const check = report.checks.find((c) => c.key === key);
  if (!check) throw new Error(`missing check ${key}`);
  return check;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('fetch', fetchMock);
  mocks.queryRaw.mockResolvedValue([{ '?column?': 1 }]);
  mocks.jobCount.mockResolvedValue(0);
  mocks.ping.mockResolvedValue('PONG');
  mocks.emailWorkers.mockResolvedValue(1);
  mocks.provisionWorkers.mockResolvedValue(1);
  mocks.vaultHealthy.mockResolvedValue(true);
  fetchMock.mockResolvedValue(new Response('{}', { status: 200 }));
});

describe('getSystemHealth', () => {
  it('reports healthy when every dependency answers', async () => {
    const report = await getSystemHealth();
    expect(report.status).toBe('healthy');
    expect(report.checks.map((c) => c.key)).toEqual([
      'web',
      'postgres',
      'redis',
      'keycloak',
      'workers',
      'vault',
    ]);
    expect(report.checks.every((c) => c.status === 'healthy')).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://auth.example.test/realms/saas-platform/.well-known/openid-configuration',
      expect.anything(),
    );
  });

  it('marks a failing dependency down with its error message', async () => {
    mocks.ping.mockRejectedValue(new Error('connect ECONNREFUSED\nstack line'));
    const report = await getSystemHealth();
    expect(report.status).toBe('down');
    expect(byKey(report, 'redis')).toMatchObject({
      status: 'down',
      detail: 'connect ECONNREFUSED',
    });
    expect(byKey(report, 'postgres').status).toBe('healthy');
  });

  it('times out a hung dependency instead of waiting forever', async () => {
    mocks.queryRaw.mockReturnValue(new Promise(() => undefined));
    const report = await getSystemHealth(20);
    expect(byKey(report, 'postgres')).toMatchObject({
      status: 'down',
      detail: 'timed out after 20ms',
    });
  });

  it('treats a non-2xx Keycloak discovery response as down', async () => {
    fetchMock.mockResolvedValue(new Response('nope', { status: 502 }));
    const report = await getSystemHealth();
    expect(byKey(report, 'keycloak')).toMatchObject({
      status: 'down',
      detail: 'OIDC discovery returned HTTP 502',
    });
  });

  it('is down with no main workers and degraded with dead jobs or no provisioner', async () => {
    mocks.emailWorkers.mockResolvedValue(0);
    expect(byKey(await getSystemHealth(), 'workers').status).toBe('down');

    mocks.emailWorkers.mockResolvedValue(2);
    mocks.jobCount.mockResolvedValue(3);
    const degraded = await getSystemHealth();
    expect(byKey(degraded, 'workers')).toMatchObject({
      status: 'degraded',
      detail: '2 main / 1 provisioner workers connected, 3 dead jobs',
    });
    expect(degraded.status).toBe('degraded');

    mocks.jobCount.mockResolvedValue(0);
    mocks.provisionWorkers.mockResolvedValue(0);
    expect(byKey(await getSystemHealth(), 'workers').status).toBe('degraded');
  });

  it('reports Vault down when sys/health is not OK', async () => {
    mocks.vaultHealthy.mockResolvedValue(false);
    expect(byKey(await getSystemHealth(), 'vault').status).toBe('down');
  });
});
