/**
 * HMAC secret for invite and email-verification links. In production a
 * missing INVITE_TOKEN_SECRET must fail closed: the old hard-coded fallback
 * is public, so anyone could forge invite or verification links with it.
 */
export function tokenSecret(): string {
  const secret = process.env.INVITE_TOKEN_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('INVITE_TOKEN_SECRET must be set in production');
  }
  return 'dev-invite-secret';
}
