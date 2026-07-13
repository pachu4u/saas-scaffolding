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

// Both possible session cookie names (secure and non-secure variants). Stale
// chunked leftovers (e.g. "__Secure-authjs.session-token.0" from the era when
// the JWT was oversized and got chunked) poison Auth.js's cookie reassembly:
// it concatenates every cookie starting with the base name, producing an
// invalid JWE that fails to decrypt on every request — a permanent signin loop.
const SESSION_COOKIE_BASES = ['__Secure-authjs.session-token', 'authjs.session-token'];

function isSessionCookie(name: string): boolean {
  return SESSION_COOKIE_BASES.some((base) => name === base || name.startsWith(base + '.'));
}

// Expire a session cookie in both scopes it may have been set with over time:
// host-only (pre cookie-domain change) and Domain=.rootdomain (current). The
// browser treats these as distinct cookies, so both variants must be cleared.
function clearSessionCookies(req: NextRequest, res: NextResponse) {
  const bareRoot = ROOT_HOST.split(':')[0] ?? '';
  const rootDomain = bareRoot.includes('.') ? '.' + bareRoot.split('.').slice(-2).join('.') : '';
  for (const cookie of req.cookies.getAll()) {
    if (!isSessionCookie(cookie.name)) continue;
    const secure = cookie.name.startsWith('__Secure-') ? '; Secure' : '';
    res.headers.append(
      'set-cookie',
      `${cookie.name}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax${secure}`,
    );
    if (rootDomain) {
      res.headers.append(
        'set-cookie',
        `${cookie.name}=; Path=/; Domain=${rootDomain}; Max-Age=0; HttpOnly; SameSite=Lax${secure}`,
      );
    }
  }
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

  // No decodable session but session cookies present → the cookies are stale or
  // corrupt (expired token, rotated secret, or poisoned chunk leftovers). Expire
  // them on this response so the next login starts from a clean cookie jar,
  // instead of looping on an undecryptable session forever. Never do this on
  // /api/auth/* — the OAuth callback sets the fresh session cookie there and a
  // deletion header on the same response would kill it.
  const staleSessionCookies =
    !session?.user &&
    !pathname.startsWith('/api/auth/') &&
    req.cookies.getAll().some((c) => isSessionCookie(c.name));

  if (!isPublic && !session?.user) {
    // Redirect to the sign-in page on whatever origin the user is already on.
    // OAuth flow cookies (state, PKCE, callbackUrl) are now configured with
    // domain: .techhanker.com, so they're readable when the Keycloak callback
    // lands on saas.techhanker.com even though auth was initiated on a subdomain.
    // The tenant is implicit in the subdomain host; the signin page reads it from
    // the x-tenant-slug header set above. No ?tenant= param needed.
    const signInUrl = new URL('/auth/signin', req.url);
    const res = NextResponse.redirect(signInUrl);
    if (staleSessionCookies) clearSessionCookies(req, res);
    return res;
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

  const res = NextResponse.next({ request: { headers } });
  // Also purge stale session cookies on public pages (e.g. /auth/signin itself)
  // so a browser stuck with poisoned cookies is healed before the next login.
  if (staleSessionCookies) clearSessionCookies(req, res);
  return res;
});

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
