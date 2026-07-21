import { adminDb, withTenant } from '@platform/db';
import { auditLog } from '@platform/logger/audit';

import { SCIM_SCHEMAS, type ScimUser } from './types.js';

export function toScimUser(
  user: { id: string; externalId: string; email: string; createdAt: Date; updatedAt: Date },
  baseUrl: string,
): ScimUser {
  return {
    schemas: [SCIM_SCHEMAS.USER],
    id: user.id,
    externalId: user.externalId,
    userName: user.email,
    emails: [{ value: user.email, primary: true, type: 'work' }],
    active: true,
    meta: {
      resourceType: 'User',
      created: user.createdAt.toISOString(),
      lastModified: user.updatedAt.toISOString(),
      location: `${baseUrl}/scim/v2/Users/${user.id}`,
    },
  };
}

export async function scimGetUsers(
  tenantId: string,
  params: {
    filter?: string;
    startIndex: number;
    count: number;
  },
) {
  const { startIndex, count } = params;

  const [users, total] = await withTenant(tenantId, async (tx) => {
    const tenantUsers = await tx.tenantUser.findMany({
      skip: startIndex - 1,
      take: count,
      include: { user: true },
    });
    const totalCount = await tx.tenantUser.count();
    return [tenantUsers.map((tu) => tu.user), totalCount] as const;
  });

  return { users, total };
}

export async function scimCreateUser(
  tenantId: string,
  data: {
    userName: string;
    externalId?: string;
    name?: { givenName?: string; familyName?: string };
    active?: boolean;
  },
  actorUserId?: string,
) {
  const email = data.userName.toLowerCase();

  // Idempotent: if externalId already exists for this tenant, return existing
  if (data.externalId) {
    const existing = await adminDb.externalIdentity.findUnique({
      where: { tenantId_idp_idpUserId: { tenantId, idp: 'scim', idpUserId: data.externalId } },
      include: { user: true },
    });
    if (existing) return existing.user;
  }

  // Upsert user by email
  const user = await adminDb.user.upsert({
    where: { email },
    update: {},
    create: { email, externalId: data.externalId ?? email, status: 'ACTIVE' },
  });

  // Link to tenant
  await adminDb.tenantUser.upsert({
    where: { tenantId_userId: { tenantId, userId: user.id } },
    update: {},
    create: { tenantId, userId: user.id, status: 'ACTIVE' },
  });

  // Track external identity
  if (data.externalId) {
    await adminDb.externalIdentity.upsert({
      where: { tenantId_idp_idpUserId: { tenantId, idp: 'scim', idpUserId: data.externalId } },
      update: {},
      create: {
        tenantId,
        userId: user.id,
        idp: 'scim',
        idpUserId: data.externalId,
        raw: data,
      },
    });
  }

  await auditLog({
    tenantId,
    ...(actorUserId ? { actorUserId } : {}),
    action: 'scim.user.create',
    resourceType: 'User',
    resourceId: user.id,
    after: { email: user.email },
  });

  return user;
}

export async function scimDeleteUser(tenantId: string, userId: string, actorUserId?: string) {
  await withTenant(tenantId, (tx) =>
    tx.tenantUser.delete({ where: { tenantId_userId: { tenantId, userId } } }),
  );

  await auditLog({
    tenantId,
    ...(actorUserId ? { actorUserId } : {}),
    action: 'scim.user.delete',
    resourceType: 'User',
    resourceId: userId,
  });
}
