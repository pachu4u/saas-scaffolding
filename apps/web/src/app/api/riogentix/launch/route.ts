import crypto from 'crypto';
import { auth } from '@platform/auth';
import { adminDb } from '@platform/db';
import { NextResponse } from 'next/server';

const RIOGENTIX_PUBLIC_URL = process.env.RIOGENTIX_PUBLIC_URL ?? 'https://riogentix.techhanker.com';
const SSO_SECRET = process.env.RIOGENTIX_SAAS_INTERNAL_SECRET;
const TOKEN_TTL = 120; // seconds

function buildSSOToken(payload: object): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto
    .createHmac('sha256', SSO_SECRET!)
    .update(`${header}.${body}`)
    .digest('base64url');
  return `${header}.${body}.${sig}`;
}

/**
 * GET /api/riogentix/launch
 *
 * Signs a short-lived SSO token for the current user and redirects
 * the browser to the Riogentix SSO endpoint, which exchanges the token
 * for a Riogentix session cookie.
 */
export async function GET() {
  if (!SSO_SECRET) {
    return NextResponse.json(
      { error: 'Riogentix SSO is not configured (RIOGENTIX_SAAS_INTERNAL_SECRET missing).' },
      { status: 503 },
    );
  }

  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.redirect('/auth/signin');
  }

  const email = session.user.email;

  let tenantId: string | null = null;
  let plan = 'free';

  const dbUser = await adminDb.user.findUnique({
    where: { externalId: session.user.id },
    include: {
      tenantUsers: {
        include: { tenant: true },
        where: { status: 'ACTIVE' },
        take: 1,
      },
    },
  });

  if (dbUser?.tenantUsers?.[0]) {
    const tu = dbUser.tenantUsers[0];
    tenantId = tu.tenantId;
    plan = tu.tenant?.plan ?? 'free';
  } else {
    // Fall back to first Keycloak group as tenant slug
    const groups: string[] = Array.isArray((session as unknown as Record<string, unknown>).groups)
      ? ((session as unknown as Record<string, unknown>).groups as string[])
      : [];
    const firstGroup = groups[0];
    if (firstGroup) {
      const tenant = await adminDb.tenant.findUnique({ where: { slug: firstGroup } });
      if (tenant) {
        tenantId = tenant.id;
        plan = tenant.plan;
      }
    }
  }

  const username = email.split('@')[0];
  const token = buildSSOToken({
    email,
    username,
    tenant_id: tenantId,
    plan,
    exp: Math.floor(Date.now() / 1000) + TOKEN_TTL,
  });

  const target = new URL('/api/v1/internal/saas/sso', RIOGENTIX_PUBLIC_URL);
  target.searchParams.set('token', token);

  return NextResponse.redirect(target.toString());
}
