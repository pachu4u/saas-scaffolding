import { createHash, timingSafeEqual } from 'crypto';
import type { NextRequest } from 'next/server';

import { adminDb } from '@platform/db';

export interface ScimTokenContext {
  tokenId: string;
  tenantId: string;
  scopes: string[];
}

/**
 * Authenticate a SCIM request via Bearer token.
 * Returns the token context or null if authentication fails.
 */
export async function authenticateScim(req: NextRequest): Promise<ScimTokenContext | null> {
  const authorization = req.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ')) return null;

  const rawToken = authorization.slice(7);
  const hashed = hashToken(rawToken);

  const token = await adminDb.scimToken.findFirst({
    where: { hashedToken: hashed },
    select: { id: true, tenantId: true, scopes: true },
  });

  if (!token) return null;

  // Verify the host matches the token's tenant
  const slug = req.headers.get('x-tenant-slug');
  const tenant = await adminDb.tenant.findUnique({
    where: { id: token.tenantId },
    select: { slug: true },
  });

  if (tenant?.slug !== slug) return null;

  // Update last_used_at async (fire and forget)
  void adminDb.scimToken.update({
    where: { id: token.id },
    data: { lastUsedAt: new Date() },
  });

  return { tokenId: token.id, tenantId: token.tenantId, scopes: token.scopes };
}

export function hashToken(rawToken: string): string {
  return createHash('sha256').update(rawToken).digest('hex');
}

export function generateToken(): string {
  return `scim_${Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('hex')}`;
}
