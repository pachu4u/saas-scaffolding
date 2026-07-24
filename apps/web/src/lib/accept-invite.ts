import { adminDb, appendSyncOutbox, withPlatformAdmin } from '@platform/db';

import { enqueueRoleSync } from '@/lib/role-sync';

export type AcceptInviteResult =
  | { success: true; alreadyActive: true; tenantSlug?: never }
  | { success: true; tenantSlug: string | null }
  | { success: false; error: string; status: number };

/**
 * Validates the invite token payload (tenantId/userId already decoded) and
 * activates the TenantUser membership. Shared by the accept API route and
 * the invite page's server action so the action never has to round-trip
 * through its own HTTP layer (that self-fetch doesn't carry the browser's
 * session cookie and gets redirected to /auth/signin by middleware).
 */
export async function acceptInvite(tenantId: string, userId: string): Promise<AcceptInviteResult> {
  const tenantUser = await adminDb.tenantUser.findUnique({
    where: { tenantId_userId: { tenantId, userId } },
  });

  if (!tenantUser) {
    return { success: false, error: 'Invite not found', status: 404 };
  }

  if (tenantUser.status === 'ACTIVE') {
    return { success: true, alreadyActive: true };
  }

  await withPlatformAdmin(async (tx) => {
    await tx.tenantUser.update({
      where: { tenantId_userId: { tenantId, userId } },
      data: { status: 'ACTIVE' },
    });
    await appendSyncOutbox(tx, tenantId, [{ resourceType: 'USER', resourceId: userId }]);
  });

  const tenantCtx = await adminDb.tenant.findUnique({
    where: { id: tenantId },
    select: { slug: true, name: true },
  });

  await adminDb.auditLog.create({
    data: {
      tenantId,
      actorUserId: userId,
      action: 'member.invitation_accepted',
      resourceType: 'tenant_user',
      resourceId: `${tenantId}:${userId}`,
    },
  });

  const { invalidateTenantCache } = await import('@platform/tenant');
  if (tenantCtx) {
    await invalidateTenantCache(tenantCtx.slug);
  }

  await enqueueRoleSync(tenantId);

  return { success: true, tenantSlug: tenantCtx?.slug ?? null };
}
