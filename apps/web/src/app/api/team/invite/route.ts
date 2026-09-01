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
import { sendEmail } from '@platform/notifications';
import { NextResponse, type NextRequest } from 'next/server';

import { decodeInviteToken } from '@/lib/invite-token';
import { enqueueRoleSync } from '@/lib/role-sync';

class SeatLimitError extends Error {
  constructor(public readonly seatLimit: number) {
    super(`Plan seat limit (${String(seatLimit)}) reached`);
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

    // Only a brand-new tenant member consumes a seat — re-inviting an existing
    // member/invitee is a no-op on seat count.
    if (seatLimit !== null) {
      const existingMembership = await tx.tenantUser.findUnique({
        where: { tenantId_userId: { tenantId: tenantCtx.tenantId, userId: foundUser.id } },
      });
      if (!existingMembership) {
        const currentSeats = await tx.tenantUser.count({ where: { tenantId: tenantCtx.tenantId } });
        if (currentSeats >= seatLimit) {
          throw new SeatLimitError(seatLimit);
        }
      }
    }

    // Upsert TenantUser as INVITED
    await tx.tenantUser.upsert({
      where: { tenantId_userId: { tenantId: tenantCtx.tenantId, userId: foundUser.id } },
      create: {
        tenantId: tenantCtx.tenantId,
        userId: foundUser.id,
        status: 'INVITED',
      },
      update: { status: 'INVITED' },
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
    if (err instanceof SeatLimitError) return err;
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

  // Generate signed invite token (HMAC-SHA256 over userId:tenantId)
  const secret = process.env.INVITE_TOKEN_SECRET ?? 'dev-invite-secret';
  const payload = `${user.id}:${tenantCtx.tenantId}:${String(Date.now())}`;
  const token = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  // Store token in a lightweight way — encode the full payload in the token URL
  // In production, store in a dedicated invitations table with expiry.
  const encodedPayload = Buffer.from(payload).toString('base64url');
  const inviteToken = `${encodedPayload}.${token}`;

  // req.nextUrl.origin reflects the internal Node bind address
  // (0.0.0.0:3000) behind Traefik, not the public hostname -- same gotcha
  // documented in riogentix-launch/route.ts's publicOrigin(). The Host
  // header (forwarded as-is by Traefik/Caddy) is the reliable source.
  // NEXT_PUBLIC_APP_URL is unusable here too: it's inlined by webpack at
  // Docker build time (see PLACEHOLDER_BUILD_ARGS in
  // .github/workflows/stackit-images.yml), so it always reads back as the
  // CI placeholder regardless of the container's real runtime env.
  const proto = req.headers.get('x-forwarded-proto') ?? 'https';
  const host = req.headers.get('host') ?? process.env.AUTH_URL ?? 'localhost:3000';
  const baseUrl = host.startsWith('http') ? host : `${proto}://${host}`;
  const inviteUrl = `${baseUrl}/invite/${inviteToken}`;

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

  // Send invite email — the invite itself is already persisted above, so a
  // delivery failure (e.g. Resend sandbox restrictions) must not fail the request.
  try {
    await sendEmail({
      to: normalizedEmail,
      subject: `You've been invited to join ${tenant.name} on riogentix`,
      templateId: 'invite-user',
      data: { tenantName: tenant.name, inviteUrl },
      tenantId: tenantCtx.tenantId,
    });
  } catch (err) {
    console.error('[team/invite] Failed to send invite email:', err);
  }

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
