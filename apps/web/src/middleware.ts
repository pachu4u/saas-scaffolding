import { edgeAuthConfig } from '@platform/auth/edge';
import { NextResponse, type NextRequest } from 'next/server';
import NextAuth from 'next-auth';

const { auth } = NextAuth(edgeAuthConfig);

// The hostname of the root domain (e.g. "saas.techhanker.com"). Any request
// whose host matches this exactly is the marketing/auth site, not a tenant subdomain.
const ROOT_HOST = process.env.AUTH_URL
  ? (() => {
      try {
        return new URL(process.env.AUTH_URL).host;
      } catch {
        return '';
      }
    })()
  : '';

const RESERVED = new Set([
  'auth',
  'api',
  'admin',
  'app',
  't',
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
  '/api/signup',
  '/signup',
  '/scim/',
];

// Paths that are public only on the root domain (no tenant subdomain)
const PUBLIC_EXACT_ROOT = new Set(['/']);

function extractSlug(host: string): string | null {
  // Strip port, then check if this IS the root domain before treating the first label as a slug.
  const bareHost = host.split(':')[0] ?? '';
  if (ROOT_HOST !== '' && bareHost === ROOT_HOST.split(':')[0]) return null;
  const label = bareHost.split('.')[0]?.toLowerCase() ?? '';
  if (!label || label === 'localhost' || RESERVED.has(label)) return null;
  if (!/^[a-z0-9-]+$/.test(label)) return null;
  return label;
}

// Old tenant paths that redirect to their new /admin/* equivalents
const LEGACY_TENANT_REDIRECTS: Record<string, string> = {
  '/dashboard': '/admin',
  '/notes': '/admin/notes',
  '/profile': '/admin/profile',
  '/billing': '/admin/billing',
  '/audit': '/admin/audit',
  '/webhooks': '/admin/webhooks',
  '/settings': '/admin/settings',
};

export default auth(function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const host = req.headers.get('host') ?? '';
  const slug = extractSlug(host);

  const headers = new Headers(req.headers);
  headers.set('x-request-id', crypto.randomUUID());
  if (slug) headers.set('x-tenant-slug', slug);

  const isPublic =
    PUBLIC_PREFIXES.some((p) => pathname.startsWith(p)) ||
    (!slug && PUBLIC_EXACT_ROOT.has(pathname));

  const session = (req as unknown as { auth: { user?: unknown } | null }).auth;

  if (!isPublic && !session?.user) {
    // Always redirect to the root-domain sign-in page so NextAuth's internal auth
    // cookies (CSRF, state, callback-url) are all set on saas.techhanker.com — the
    // same origin as the OAuth callback. If they were set on a tenant subdomain
    // (different host) the callback would never find them.
    const rootOrigin = process.env.AUTH_URL ?? `https://${ROOT_HOST}`;
    const signInUrl = new URL(
      slug ? `/auth/signin?tenant=${encodeURIComponent(slug)}` : '/auth/signin',
      rootOrigin,
    );
    return NextResponse.redirect(signInUrl);
  }

  // Root domain: redirect authenticated users from / to marketing landing (already there)
  // or let them through to sign in / sign up.
  if (!slug && pathname === '/' && session?.user) {
    // On root domain, authenticated users stay on the marketing page.
    // They can navigate to their tenant subdomain from there.
    return NextResponse.next({ request: { headers } });
  }

  if (slug) {
    // Legacy path redirects on tenant subdomains
    const legacyTarget = LEGACY_TENANT_REDIRECTS[pathname];
    if (legacyTarget) {
      return NextResponse.redirect(new URL(legacyTarget, req.url));
    }

    // Handle /team/* legacy paths
    if (pathname === '/team' || pathname.startsWith('/team/')) {
      const newPath = '/admin' + pathname;
      return NextResponse.redirect(new URL(newPath, req.url));
    }

    // Rewrite tenant subdomain requests into the /t/* internal tree
    if (pathname === '/') {
      return NextResponse.rewrite(new URL('/t', req.url), { request: { headers } });
    }
    if (pathname === '/admin' || pathname.startsWith('/admin/')) {
      return NextResponse.rewrite(new URL('/t' + pathname, req.url), { request: { headers } });
    }
    if (pathname === '/app' || pathname.startsWith('/app/')) {
      return NextResponse.rewrite(new URL('/t' + pathname, req.url), { request: { headers } });
    }
  }

  return NextResponse.next({ request: { headers } });
});

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
