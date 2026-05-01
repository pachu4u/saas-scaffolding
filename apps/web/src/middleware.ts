import { NextResponse, type NextRequest } from 'next/server';
import NextAuth from 'next-auth';

import { edgeAuthConfig } from '@platform/auth/edge';

const { auth } = NextAuth(edgeAuthConfig);

const RESERVED = new Set([
  'auth', 'api', 'admin', 'app', 'www', 'traefik',
  'grafana', 'mail', 'pgadmin', '_health',
]);

const PUBLIC_PREFIXES = [
  '/_health',
  '/_ready',
  '/auth/',
  '/api/auth/',
  '/api/billing/webhook',
  '/scim/',
];

function extractSlug(host: string): string | null {
  // Strip port, take leftmost label
  const label = host.split(':')[0]?.split('.')[0]?.toLowerCase() ?? '';
  if (!label || label === 'localhost' || RESERVED.has(label)) return null;
  if (!/^[a-z0-9-]+$/.test(label)) return null;
  return label;
}

export default auth(function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const host = req.headers.get('host') ?? '';
  const slug = extractSlug(host);

  const headers = new Headers(req.headers);
  headers.set('x-request-id', crypto.randomUUID());
  if (slug) headers.set('x-tenant-slug', slug);

  const isPublic = PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));
  const session = (req as unknown as { auth: { user?: unknown } | null }).auth;

  if (!isPublic && !session?.user) {
    const signInUrl = new URL('/auth/signin', req.url);
    return NextResponse.redirect(signInUrl);
  }

  return NextResponse.next({ request: { headers } });
});

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
