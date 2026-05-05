import { adminDb } from '@platform/db';
import { auditLog } from '@platform/logger/audit';

import { SCIM_SCHEMAS, type ScimGroup, type ScimPatchOp } from './types';

export function toScimGroup(
  role: {
    id: string;
    name: string;
    bindings: Array<{ userId: string; user: { email: string } }>;
  },
  baseUrl: string,
): ScimGroup {
  return {
    schemas: [SCIM_SCHEMAS.GROUP],
    id: role.id,
    displayName: role.name,
    members: role.bindings.map((b) => ({
      value: b.userId,
      display: b.user.email,
    })),
    meta: {
      resourceType: 'Group',
      // Roles have no timestamps in schema; use epoch as placeholder
      created: new Date(0).toISOString(),
      lastModified: new Date(0).toISOString(),
      location: `${baseUrl}/scim/v2/Groups/${role.id}`,
    },
  };
}

export async function scimGetGroups(
  tenantId: string,
  params: { startIndex: number; count: number },
) {
  const { startIndex, count } = params;

  const [roles, total] = await Promise.all([
    adminDb.role.findMany({
      where: { tenantId },
      skip: startIndex - 1,
      take: count,
      include: {
        bindings: {
          where: { tenantId },
          include: { user: { select: { email: true } } },
        },
      },
    }),
    adminDb.role.count({ where: { tenantId } }),
  ]);

  return { roles, total };
}

export async function scimGetGroup(tenantId: string, groupId: string) {
  return adminDb.role.findFirst({
    where: { id: groupId, tenantId },
    include: {
      bindings: {
        where: { tenantId },
        include: { user: { select: { email: true } } },
      },
    },
  });
}

export async function scimCreateGroup(
  tenantId: string,
  data: { displayName: string; members?: Array<{ value: string }> },
  actorUserId?: string,
) {
  const role = await adminDb.role.create({
    data: {
      tenantId,
      name: data.displayName,
      isSystem: false,
    },
    include: {
      bindings: { where: { tenantId }, include: { user: { select: { email: true } } } },
    },
  });

  // Add initial members
  if (data.members && data.members.length > 0) {
    await adminDb.roleBinding.createMany({
      data: data.members.map((m) => ({ tenantId, userId: m.value, roleId: role.id })),
      skipDuplicates: true,
    });
  }

  await auditLog({
    tenantId,
    ...(actorUserId ? { actorUserId } : {}),
    action: 'scim.group.create',
    resourceType: 'Role',
    resourceId: role.id,
    after: { name: data.displayName },
  });

  // Re-fetch with members
  return scimGetGroup(tenantId, role.id);
}

export async function scimDeleteGroup(tenantId: string, groupId: string, actorUserId?: string) {
  await adminDb.role.delete({ where: { id: groupId } });

  await auditLog({
    tenantId,
    ...(actorUserId ? { actorUserId } : {}),
    action: 'scim.group.delete',
    resourceType: 'Role',
    resourceId: groupId,
  });
}

export async function scimPatchGroup(
  tenantId: string,
  groupId: string,
  patchOp: ScimPatchOp,
  actorUserId?: string,
) {
  for (const op of patchOp.Operations) {
    const lowerOp = op.op.toLowerCase();

    if (lowerOp === 'replace' && !op.path) {
      // Replace entire group object
      const val = op.value as Record<string, unknown> | undefined;
      if (val?.displayName && typeof val.displayName === 'string') {
        await adminDb.role.update({
          where: { id: groupId },
          data: { name: val.displayName },
        });
      }
    }

    if (op.path === 'members' || op.path === 'members.$ref') {
      const members = (
        Array.isArray(op.value) ? op.value : op.value !== undefined ? [op.value] : []
      ) as Array<{ value: string }>;

      if (lowerOp === 'add') {
        await adminDb.roleBinding.createMany({
          data: members.map((m) => ({ tenantId, userId: m.value, roleId: groupId })),
          skipDuplicates: true,
        });
      } else if (lowerOp === 'remove') {
        await adminDb.roleBinding.deleteMany({
          where: {
            tenantId,
            roleId: groupId,
            userId: { in: members.map((m) => m.value) },
          },
        });
      } else if (lowerOp === 'replace') {
        // Replace all members
        await adminDb.roleBinding.deleteMany({ where: { tenantId, roleId: groupId } });
        if (members.length > 0) {
          await adminDb.roleBinding.createMany({
            data: members.map((m) => ({ tenantId, userId: m.value, roleId: groupId })),
            skipDuplicates: true,
          });
        }
      }
    }
  }

  await auditLog({
    tenantId,
    ...(actorUserId ? { actorUserId } : {}),
    action: 'scim.group.patch',
    resourceType: 'Role',
    resourceId: groupId,
    after: { operations: patchOp.Operations.length },
  });

  return scimGetGroup(tenantId, groupId);
}
