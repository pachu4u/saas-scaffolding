import { adminDb } from '@platform/db';
import { NextResponse, type NextRequest } from 'next/server';

import { decodeInviteToken } from '../../route';

/**
 * POST /api/team/invite/[token]/accept
 *
 * Validates the invite token and activates the TenantUser membership.
 * Called by the /invite/[token] page server action after the user confirms.
 */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const { tenantId, userId } = decodeInviteToken(token);

  if (!tenantId || !userId) {
    return NextResponse.json({ error: 'Invalid or expired invite link' }, { status: 400 });
  }

  // Verify the TenantUser is in INVITED state
  const tenantUser = await adminDb.tenantUser.findUnique({
    where: { tenantId_userId: { tenantId, userId } },
  });

  if (!tenantUser) {
    return NextResponse.json({ error: 'Invite not found' }, { status: 404 });
  }

  if (tenantUser.status === 'ACTIVE') {
    return NextResponse.json({ success: true, alreadyActive: true });
  }

  // Activate the membership
  await adminDb.tenantUser.update({
    where: { tenantId_userId: { tenantId, userId } },
    data: { status: 'ACTIVE' },
  });

  // Fetch tenant slug for redirect
  const tenantCtx = await adminDb.tenant.findUnique({
    where: { id: tenantId },
    select: { slug: true, name: true },
  });

  // Audit
  await adminDb.auditLog.create({
    data: {
      tenantId,
      actorUserId: userId,
      action: 'member.invitation_accepted',
      resourceType: 'tenant_user',
      resourceId: `${tenantId}:${userId}`,
    },
  });

  // Invalidate tenant cache so the new member is picked up immediately
  const { invalidateTenantCache } = await import('@platform/tenant');
  if (tenantCtx) {
    await invalidateTenantCache(tenantCtx.slug);
  }

  return NextResponse.json({ success: true, tenantSlug: tenantCtx?.slug ?? null });
}
