import { edgeAuthConfig } from '@platform/auth/edge';
import { NextResponse, type NextRequest } from 'next/server';
import NextAuth from 'next-auth';

const { auth } = NextAuth(edgeAuthConfig);

const RESERVED = new Set([
  'auth',
  'api',
  'admin',
  'app',
  'www',
  'traefik',
  'grafana',
  'mail',
  'pgadmin',
  '_health',
]);

const PUBLIC_PREFIXES = [
  '/_health',
  '/_ready',
  '/auth/',
  '/api/auth/',
  '/api/billing/webhook',
  '/scim/',
];

// Exact public paths (not prefix-matched)
const PUBLIC_EXACT = new Set(['/']);

function extractSlug(host: string): string | null {
  // Strip port, take leftmost label
  const label = host.split(':')[0]?.split('.')[0]?.toLowerCase() ?? '';
  if (!label || label === 'localhost' || RESERVED.has(label)) return null;
  if (!/^[a-z0-9-]+$/.test(label)) return null;
  return label;
}

// NOTE: on `localhost` (no subdomain) this returns null, so `x-tenant-slug`
// is never set below and every page falls back to a hardcoded default
// tenant slug (NEXT_PUBLIC_DEFAULT_TENANT_SLUG, or 'acme') regardless of who
// is actually logged in. That's fine for single-tenant local dev, but it
// means local testing cannot exercise real cross-tenant isolation without
// either running through subdomains (e.g. *.lvh.me, as the e2e suite does)
// or an explicit x-tenant-slug override.

export default auth(function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const host = req.headers.get('host') ?? '';
  const slug = extractSlug(host);

  const headers = new Headers(req.headers);
  headers.set('x-request-id', crypto.randomUUID());
  if (slug) headers.set('x-tenant-slug', slug);

  const isPublic =
    PUBLIC_EXACT.has(pathname) || PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));
  const session = (req as unknown as { auth: { user?: unknown } | null }).auth;

  if (!isPublic && !session?.user) {
    const signInUrl = new URL('/auth/signin', req.url);
    return NextResponse.redirect(signInUrl);
  }

  // Redirect authenticated users from the landing page to the dashboard
  if (pathname === '/' && session?.user) {
    return NextResponse.redirect(new URL('/dashboard', req.url));
  }

  return NextResponse.next({ request: { headers } });
});

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
