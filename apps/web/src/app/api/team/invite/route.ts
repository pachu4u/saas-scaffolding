import crypto from 'crypto';

import { PLATFORM_ROLE_NAMES, Permission, withAuthz } from '@platform/authz';
import type { PlanFeatures } from '@platform/billing';
import {
  adminDb,
  appendSyncOutbox,
  withPlatformAdmin,
  checkRateLimit,
  rateLimitHeaders,
} from '@platform/db';
import { NextResponse, type NextRequest } from 'next/server';

import { decodeInviteToken } from '@/lib/invite-token';
import { enqueueRoleSync } from '@/lib/role-sync';
import { buildInviteUrl, sendInviteEmail } from '@/lib/send-invite-email';

class SeatLimitError extends Error {
  constructor(public readonly seatLimit: number) {
    super(`Plan seat limit (${String(seatLimit)}) reached`);
  }
}

class AlreadyMemberError extends Error {
  constructor(public readonly status: 'ACTIVE' | 'INVITED' | 'SUSPENDED') {
    super(`User already has ${status} membership in this tenant`);
  }
}

/**
 * POST /api/team/invite
 * Body: { email: string; roleId: string }
 *
 * Creates a TenantUser record with status INVITED and sends an invite email.
 * Requires USERS_CREATE.
 */
export const POST = withAuthz({ permission: Permission.USERS_CREATE }, async (req, { authz }) => {
  const tenantCtx = { tenantId: authz.tenantId };

  // Rate limit: 20 invites per hour per tenant
  const rl = await checkRateLimit({
    prefix: 'invite',
    id: tenantCtx.tenantId,
    limit: 20,
    windowMs: 60 * 60 * 1000,
  });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many invites — try again later' },
      { status: 429, headers: rateLimitHeaders(rl) },
    );
  }

  const body = (await req.json()) as { email?: string; roleId?: string; appRoleIds?: string[] };
  const { email, roleId, appRoleIds = [] } = body;

  if (!email || !roleId) {
    return NextResponse.json({ error: 'email and roleId are required' }, { status: 400 });
  }

  // Platform-level roles are never assignable via a tenant's own invite flow.
  if ((PLATFORM_ROLE_NAMES as readonly string[]).includes(roleId)) {
    return NextResponse.json(
      { error: `Role "${roleId}" cannot be assigned within a tenant` },
      { status: 403 },
    );
  }

  // Normalise email
  const normalizedEmail = email.trim().toLowerCase();

  // Fetch the tenant name for the invite email
  const tenant = await adminDb.tenant.findUnique({
    where: { id: tenantCtx.tenantId },
    select: { name: true },
  });
  if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

  // Enforce the plan's seat limit (mirrors the "N of M seats used" figure shown
  // in /admin and /admin/billing, which was previously display-only).
  const subscription = await adminDb.subscription.findUnique({
    where: { tenantId: tenantCtx.tenantId },
    include: { plan: true },
  });
  const planFeatures = (subscription?.plan.features ?? {}) as Partial<PlanFeatures>;
  const seatLimit =
    typeof planFeatures.users?.maxCount === 'number' ? planFeatures.users.maxCount : null;

  // All writes use withPlatformAdmin to bypass FORCE ROW LEVEL SECURITY
  const user = await withPlatformAdmin(async (tx) => {
    // Resolve or create the invited user record
    let foundUser = await tx.user.findUnique({ where: { email: normalizedEmail } });
    foundUser ??= await tx.user.create({
      data: {
        email: normalizedEmail,
        // externalId will be filled on first SSO login
        externalId: `pending-${crypto.randomUUID()}`,
      },
    });

    const existingMembership = await tx.tenantUser.findUnique({
      where: { tenantId_userId: { tenantId: tenantCtx.tenantId, userId: foundUser.id } },
    });

    // One invite attempt per (tenant, email) at a time — re-inviting an
    // ACTIVE member would silently demote them back to INVITED via the
    // upsert below (getActiveMemberships/access checks only ever look at
    // status === ACTIVE), locking them out until they "accept" an invite
    // they never needed. An already-INVITED person has a pending invite in
    // flight; a SUSPENDED one has a dedicated Reinstate action (PATCH
    // /api/team/members/[userId]) — route them there instead of overloading
    // invite with resend/reinstate semantics it wasn't built for.
    if (existingMembership) {
      throw new AlreadyMemberError(existingMembership.status);
    }

    // Only a brand-new tenant member consumes a seat.
    if (seatLimit !== null) {
      const currentSeats = await tx.tenantUser.count({ where: { tenantId: tenantCtx.tenantId } });
      if (currentSeats >= seatLimit) {
        throw new SeatLimitError(seatLimit);
      }
    }

    // Always a fresh row — existingMembership already threw above otherwise.
    await tx.tenantUser.create({
      data: {
        tenantId: tenantCtx.tenantId,
        userId: foundUser.id,
        status: 'INVITED',
      },
    });

    // Assign requested role — either a system role or one of this tenant's
    // own custom roles, looked up by name.
    const role = await tx.role.findFirst({
      where: { name: roleId, OR: [{ isSystem: true }, { tenantId: tenantCtx.tenantId }] },
    });
    if (role) {
      await tx.roleBinding.upsert({
        where: {
          tenantId_userId_roleId: {
            tenantId: tenantCtx.tenantId,
            userId: foundUser.id,
            roleId: role.id,
          },
        },
        create: { tenantId: tenantCtx.tenantId, userId: foundUser.id, roleId: role.id },
        update: {},
      });
    }

    // Additive connected-app roles (e.g. Riogentix) requested alongside the
    // primary tenant role — mirrors POST /api/team/roles/[id]/members/[userId],
    // only reachable for roles this tenant actually has an active app instance for.
    const appRoles = appRoleIds.length
      ? await tx.role.findMany({
          where: { id: { in: appRoleIds }, tenantId: null, appId: { not: null }, isSystem: true },
        })
      : [];
    const assignableAppRoles = appRoles.length
      ? await (async () => {
          const instances = await tx.connectedAppInstance.findMany({
            where: {
              tenantId: tenantCtx.tenantId,
              status: 'ACTIVE',
              appId: { in: appRoles.map((r) => r.appId).filter((id): id is string => id !== null) },
            },
            select: { appId: true },
          });
          const activeAppIds = new Set(instances.map((i) => i.appId));
          return appRoles.filter((r) => r.appId && activeAppIds.has(r.appId));
        })()
      : [];

    for (const appRole of assignableAppRoles) {
      await tx.roleBinding.upsert({
        where: {
          tenantId_userId_roleId: {
            tenantId: tenantCtx.tenantId,
            userId: foundUser.id,
            roleId: appRole.id,
          },
        },
        create: { tenantId: tenantCtx.tenantId, userId: foundUser.id, roleId: appRole.id },
        update: {},
      });
    }

    await appendSyncOutbox(tx, tenantCtx.tenantId, [
      { resourceType: 'USER', resourceId: foundUser.id },
      ...(role ? [{ resourceType: 'GROUP' as const, resourceId: role.id }] : []),
      ...assignableAppRoles.map((r) => ({ resourceType: 'GROUP' as const, resourceId: r.id })),
    ]);

    return foundUser;
  }).catch((err: unknown) => {
    if (err instanceof SeatLimitError || err instanceof AlreadyMemberError) return err;
    throw err;
  });

  if (user instanceof SeatLimitError) {
    return NextResponse.json(
      {
        error: `Your plan allows up to ${String(user.seatLimit)} team members. Upgrade your plan to invite more.`,
      },
      { status: 402 },
    );
  }

  if (user instanceof AlreadyMemberError) {
    const messages: Record<typeof user.status, string> = {
      ACTIVE: 'This person is already a member of this team.',
      INVITED: 'An invite is already pending for this person.',
      SUSPENDED:
        'This person was removed from the team. Use "Reinstate" to restore their access instead of sending a new invite.',
    };
    return NextResponse.json({ error: messages[user.status] }, { status: 409 });
  }

  const { inviteUrl } = buildInviteUrl(req, user.id, tenantCtx.tenantId);

  // Audit log (platform admin bypass)
  await withPlatformAdmin(async (tx) => {
    await tx.auditLog.create({
      data: {
        tenantId: tenantCtx.tenantId,
        actorUserId: authz.user.id,
        action: 'member.invited',
        resourceType: 'user',
        resourceId: user.id,
        after: { email: normalizedEmail, inviteUrl },
      },
    });
  });

  // Propagate the new member's role binding to the tenant's Riogentix instance.
  await enqueueRoleSync(tenantCtx.tenantId);

  await sendInviteEmail(normalizedEmail, tenant.name, inviteUrl, tenantCtx.tenantId);

  return NextResponse.json({ success: true, inviteUrl }, { status: 201 });
});

/**
 * GET /api/team/invite?token=<token>
 * Returns invite metadata so the acceptance page can render tenant/inviter info.
 */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');
  if (!token) {
    return NextResponse.json({ error: 'token is required' }, { status: 400 });
  }

  const { tenantId, userId } = decodeInviteToken(token);
  if (!tenantId || !userId) {
    return NextResponse.json({ error: 'Invalid or expired invite link' }, { status: 400 });
  }

  const [tenant, user] = await Promise.all([
    adminDb.tenant.findUnique({ where: { id: tenantId }, select: { name: true, slug: true } }),
    adminDb.user.findUnique({ where: { id: userId }, select: { email: true } }),
  ]);

  if (!tenant || !user) {
    return NextResponse.json({ error: 'Invite not found' }, { status: 404 });
  }

  return NextResponse.json({ tenantName: tenant.name, tenantSlug: tenant.slug, email: user.email });
}
