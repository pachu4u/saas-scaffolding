import crypto from 'crypto';

import { PLATFORM_ROLE_NAMES, Permission, withAuthz } from '@platform/authz';
import { adminDb, withPlatformAdmin, checkRateLimit, rateLimitHeaders } from '@platform/db';
import { sendEmail } from '@platform/notifications';
import { NextResponse, type NextRequest } from 'next/server';

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

  const body = (await req.json()) as { email?: string; roleId?: string };
  const { email, roleId } = body;

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

    // Assign requested role — roles are system-level (tenantId = null), looked up by name
    const role = await tx.role.findFirst({
      where: { name: roleId },
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

    return foundUser;
  });

  // Generate signed invite token (HMAC-SHA256 over userId:tenantId)
  const secret = process.env.INVITE_TOKEN_SECRET ?? 'dev-invite-secret';
  const payload = `${user.id}:${tenantCtx.tenantId}:${String(Date.now())}`;
  const token = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  // Store token in a lightweight way — encode the full payload in the token URL
  // In production, store in a dedicated invitations table with expiry.
  const encodedPayload = Buffer.from(payload).toString('base64url');
  const inviteToken = `${encodedPayload}.${token}`;

  const baseUrl =
    process.env.NEXTAUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
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

  // Send invite email
  await sendEmail({
    to: normalizedEmail,
    subject: `You've been invited to join ${tenant.name} on riogentix`,
    templateId: 'invite-user',
    data: { tenantName: tenant.name, inviteUrl },
    tenantId: tenantCtx.tenantId,
  });

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

export function decodeInviteToken(token: string): {
  tenantId: string | null;
  userId: string | null;
} {
  try {
    const [encodedPayload, signature] = token.split('.');
    if (!encodedPayload || !signature) return { tenantId: null, userId: null };

    const payload = Buffer.from(encodedPayload, 'base64url').toString();
    const [userId, tenantId, tsStr] = payload.split(':');

    if (!userId || !tenantId || !tsStr) return { tenantId: null, userId: null };

    // Check expiry: 7 days
    const ts = parseInt(tsStr, 10);
    if (Date.now() - ts > 7 * 24 * 60 * 60 * 1000) return { tenantId: null, userId: null };

    // Verify signature
    const secret = process.env.INVITE_TOKEN_SECRET ?? 'dev-invite-secret';
    const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
    if (!crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expected, 'hex'))) {
      return { tenantId: null, userId: null };
    }

    return { tenantId, userId };
  } catch {
    return { tenantId: null, userId: null };
  }
}
