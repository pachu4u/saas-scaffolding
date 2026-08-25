import crypto from 'crypto';

// Distinct purpose tag (not just a separate function) so this can never be
// decoded as a valid invite-token.ts payload even though both currently
// share INVITE_TOKEN_SECRET -- the shapes only coincide by field count, and
// this guards against that.
const PURPOSE = 'verify-email';
const EXPIRY_MS = 48 * 60 * 60 * 1000; // 48h -- long enough that a busy signer-upper doesn't get locked out

export function encodeEmailVerificationToken(userId: string, tenantId: string): string {
  const secret = process.env.INVITE_TOKEN_SECRET ?? 'dev-invite-secret';
  const payload = `${PURPOSE}:${userId}:${tenantId}:${String(Date.now())}`;
  const signature = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  return `${Buffer.from(payload).toString('base64url')}.${signature}`;
}

export function decodeEmailVerificationToken(token: string): {
  userId: string | null;
  tenantId: string | null;
} {
  try {
    const [encodedPayload, signature] = token.split('.');
    if (!encodedPayload || !signature) return { userId: null, tenantId: null };

    const payload = Buffer.from(encodedPayload, 'base64url').toString();
    const [purpose, userId, tenantId, tsStr] = payload.split(':');
    if (purpose !== PURPOSE || !userId || !tenantId || !tsStr) {
      return { userId: null, tenantId: null };
    }

    const ts = parseInt(tsStr, 10);
    if (Date.now() - ts > EXPIRY_MS) return { userId: null, tenantId: null };

    const secret = process.env.INVITE_TOKEN_SECRET ?? 'dev-invite-secret';
    const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
    if (!crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expected, 'hex'))) {
      return { userId: null, tenantId: null };
    }

    return { userId, tenantId };
  } catch {
    return { userId: null, tenantId: null };
  }
}
