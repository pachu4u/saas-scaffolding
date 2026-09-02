import crypto from 'crypto';

import { sendEmail } from '@platform/notifications';
import type { NextRequest } from 'next/server';

/**
 * Signs a fresh invite token (HMAC-SHA256 over userId:tenantId:timestamp) and
 * builds the absolute /invite/{token} URL. Shared by POST /api/team/invite
 * (new invite) and POST /api/team/members/[userId]/resend-invite (same
 * pending invite, fresh token/expiry) so both produce identical links.
 */
export function buildInviteUrl(
  req: NextRequest,
  userId: string,
  tenantId: string,
): { inviteUrl: string; inviteToken: string } {
  const secret = process.env.INVITE_TOKEN_SECRET ?? 'dev-invite-secret';
  const payload = `${userId}:${tenantId}:${String(Date.now())}`;
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

  return { inviteUrl, inviteToken };
}

/**
 * Sends the invite email. The invite/membership row is already persisted by
 * the caller before this runs, so a delivery failure (e.g. Resend sandbox
 * restrictions) must not fail the request — logged and swallowed.
 */
export async function sendInviteEmail(
  email: string,
  tenantName: string,
  inviteUrl: string,
  tenantId: string,
): Promise<void> {
  try {
    await sendEmail({
      to: email,
      subject: `You've been invited to join ${tenantName} on riogentix`,
      templateId: 'invite-user',
      data: { tenantName, inviteUrl },
      tenantId,
    });
  } catch (err) {
    console.error('[invite] Failed to send invite email:', err);
  }
}
