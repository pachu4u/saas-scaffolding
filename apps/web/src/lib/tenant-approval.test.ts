import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  tenant: null as null | { id: string; name: string; status: string; provisioningStatus: string },
  updates: [] as { status?: string }[],
  audits: [] as string[],
  emails: [] as { to: string; templateId: string }[],
  kcUser: null as null | { id: string; emailVerified: boolean },
  deletedKc: [] as string[],
  otherLive: 0,
  provisioned: [] as string[],
}));

vi.mock('@platform/config', () => ({ env: { AUTH_URL: 'https://saas.example.test' } }));
vi.mock('@platform/db', () => ({
  adminDb: {
    tenant: {
      findUnique: () => Promise.resolve(m.tenant),
      update: ({ data }: { data: { status?: string } }) => {
        m.updates.push(data);
        return Promise.resolve({});
      },
    },
    tenantUser: {
      findFirst: () => Promise.resolve({ user: { email: 'founder@acme.test' } }),
      count: () => Promise.resolve(m.otherLive),
    },
  },
  withPlatformAdmin: (fn: (tx: unknown) => Promise<void>) =>
    fn({
      auditLog: {
        create: ({ data }: { data: { action: string } }) => {
          m.audits.push(data.action);
          return Promise.resolve({});
        },
      },
    }),
}));
vi.mock('@platform/notifications', () => ({
  sendEmail: (p: { to: string; templateId: string }) => {
    m.emails.push({ to: p.to, templateId: p.templateId });
    return Promise.resolve();
  },
}));
vi.mock('@/lib/keycloak-admin', () => ({
  findKeycloakUserByEmail: () => Promise.resolve(m.kcUser),
  deleteKeycloakUser: (id: string) => {
    m.deletedKc.push(id);
    return Promise.resolve();
  },
}));
vi.mock('@/lib/verify-email', () => ({
  startTenantProvisioning: (id: string) => {
    m.provisioned.push(id);
    return Promise.resolve();
  },
}));

import { approveTenant, rejectTenant } from './tenant-approval';

beforeEach(() => {
  m.tenant = { id: 't1', name: 'Acme', status: 'PENDING_APPROVAL', provisioningStatus: 'PENDING' };
  m.updates = [];
  m.audits = [];
  m.emails = [];
  m.kcUser = { id: 'kc1', emailVerified: true };
  m.deletedKc = [];
  m.otherLive = 0;
  m.provisioned = [];
});

describe('approveTenant', () => {
  it('activates, starts provisioning when the email is verified, and tells the applicant', async () => {
    const out = await approveTenant('t1', 'admin1');
    expect(out).toEqual({ ok: true, status: 'ACTIVE', provisioning: true });
    expect(m.updates).toContainEqual({ status: 'ACTIVE' });
    expect(m.provisioned).toEqual(['t1']);
    expect(m.audits).toEqual(['tenant.approved']);
    expect(m.emails).toEqual([{ to: 'founder@acme.test', templateId: 'tenant-approved' }]);
  });

  it('waits for email verification before provisioning', async () => {
    m.kcUser = { id: 'kc1', emailVerified: false };
    const out = await approveTenant('t1', null);
    expect(out).toMatchObject({ ok: true, provisioning: false });
    expect(m.provisioned).toEqual([]);
  });

  it('refuses a tenant that is not pending', async () => {
    m.tenant = { id: 't1', name: 'Acme', status: 'ACTIVE', provisioningStatus: 'COMPLETED' };
    const out = await approveTenant('t1', null);
    expect(out).toMatchObject({ ok: false, httpStatus: 422 });
    expect(m.updates).toEqual([]);
  });
});

describe('rejectTenant', () => {
  it('soft-deletes, removes the login and emails the applicant', async () => {
    const out = await rejectTenant('t1', 'admin1');
    expect(out).toEqual({ ok: true, status: 'DELETED' });
    expect(m.updates).toContainEqual({ status: 'DELETED' });
    expect(m.deletedKc).toEqual(['kc1']);
    expect(m.audits).toEqual(['tenant.rejected']);
    expect(m.emails[0]?.templateId).toBe('tenant-rejected');
    expect(m.provisioned).toEqual([]);
  });

  it('keeps the login when the applicant belongs to another live workspace', async () => {
    m.otherLive = 1;
    await rejectTenant('t1', null);
    expect(m.deletedKc).toEqual([]);
  });
});
