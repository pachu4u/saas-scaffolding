import { Permission, invalidateAuthzCache, withAuthz } from '@platform/authz';
import { adminDb, appendSyncOutbox, withPlatformAdmin } from '@platform/db';
import { type NextRequest, NextResponse } from 'next/server';

import { enqueueRoleSync } from '@/lib/role-sync';

export const runtime = 'nodejs';

/**
 * PATCH /api/team/members/[userId]
 * Body: { status: 'SUSPENDED' | 'ACTIVE' }
 * Suspends ("Remove") or reinstates a tenant member. Suspension is a soft
 * removal — it revokes access (getActiveMemberships only considers
 * status: ACTIVE) without deleting the TenantUser row or its role
 * bindings, so a later reinstate restores exactly what they had. Requires
 * USERS_DELETE.
 */
export const PATCH = withAuthz<{ params: Promise<{ userId: string }> }>(
  { permission: Permission.USERS_DELETE },
  async (req: NextRequest, { authz, params }) => {
    const { userId } = await params;
    const body = (await req.json()) as { status?: string };
    const status = body.status;
    if (status !== 'SUSPENDED' && status !== 'ACTIVE') {
      return NextResponse.json(
        { error: 'status must be "SUSPENDED" or "ACTIVE"' },
        { status: 422 },
      );
    }

    if (userId === authz.user.id) {
      return NextResponse.json(
        { error: 'You cannot remove yourself from the team' },
        { status: 422 },
      );
    }

    const tenantUser = await adminDb.tenantUser.findUnique({
      where: { tenantId_userId: { tenantId: authz.tenantId, userId } },
    });
    if (!tenantUser) return NextResponse.json({ error: 'Member not found' }, { status: 404 });

    await withPlatformAdmin(async (tx) => {
      await tx.tenantUser.update({
        where: { tenantId_userId: { tenantId: authz.tenantId, userId } },
        data: { status },
      });

      await tx.auditLog.create({
        data: {
          tenantId: authz.tenantId,
          actorUserId: authz.user.id,
          action: status === 'SUSPENDED' ? 'member.removed' : 'member.reinstated',
          resourceType: 'TenantUser',
          resourceId: userId,
          after: { status },
        },
      });

      await appendSyncOutbox(tx, authz.tenantId, [{ resourceType: 'USER', resourceId: userId }]);
    });

    // A cached permission check must not let a just-removed member through
    // for up to 120s — see the role route's identical comment.
    await invalidateAuthzCache(authz.tenantId, userId);

    // Propagate the status change to the tenant's Riogentix instance.
    await enqueueRoleSync(authz.tenantId);

    return NextResponse.json({ ok: true, status });
  },
);
