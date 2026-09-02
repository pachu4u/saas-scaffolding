import { Permission, withAuthz } from '@platform/authz';
import { adminDb, checkRateLimit, rateLimitHeaders, withPlatformAdmin } from '@platform/db';
import { type NextRequest, NextResponse } from 'next/server';

import { buildInviteUrl, sendInviteEmail } from '@/lib/send-invite-email';

export const runtime = 'nodejs';

/**
 * POST /api/team/members/[userId]/resend-invite
 * Re-sends the invite email for a still-pending member with a fresh
 * token/expiry, without going through POST /api/team/invite (which now
 * rejects any existing membership, INVITED included — see that route's
 * AlreadyMemberError). Requires USERS_CREATE, same as the original invite.
 */
export const POST = withAuthz<{ params: Promise<{ userId: string }> }>(
  { permission: Permission.USERS_CREATE },
  async (req: NextRequest, { authz, params }) => {
    const { userId } = await params;

    // Same rate limit as the original invite — resend shouldn't be a way to
    // bypass it and spam one invitee's inbox.
    const rl = await checkRateLimit({
      prefix: 'invite',
      id: authz.tenantId,
      limit: 20,
      windowMs: 60 * 60 * 1000,
    });
    if (!rl.allowed) {
      return NextResponse.json(
        { error: 'Too many invites — try again later' },
        { status: 429, headers: rateLimitHeaders(rl) },
      );
    }

    const [tenant, tenantUser, user] = await Promise.all([
      adminDb.tenant.findUnique({ where: { id: authz.tenantId }, select: { name: true } }),
      adminDb.tenantUser.findUnique({
        where: { tenantId_userId: { tenantId: authz.tenantId, userId } },
      }),
      adminDb.user.findUnique({ where: { id: userId }, select: { email: true } }),
    ]);
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    if (!tenantUser || !user) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }
    if (tenantUser.status !== 'INVITED') {
      return NextResponse.json(
        { error: 'This person does not have a pending invite.' },
        { status: 409 },
      );
    }

    const { inviteUrl } = buildInviteUrl(req, userId, authz.tenantId);

    await withPlatformAdmin(async (tx) => {
      await tx.auditLog.create({
        data: {
          tenantId: authz.tenantId,
          actorUserId: authz.user.id,
          action: 'member.invite_resent',
          resourceType: 'user',
          resourceId: userId,
          after: { email: user.email, inviteUrl },
        },
      });
    });

    await sendInviteEmail(user.email, tenant.name, inviteUrl, authz.tenantId);

    return NextResponse.json({ ok: true });
  },
);
