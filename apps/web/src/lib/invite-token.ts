import crypto from 'crypto';

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
