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
  '/api/tenant-authz',
  '/signup',
  '/scim/',
];

// Paths that are public only on the root domain (no tenant subdomain)
const PUBLIC_EXACT_ROOT = new Set(['/']);

// Cookie remembering the tenant the user is currently working in. Client-side
// fetches to /api/* carry no tenant in host or path, so middleware injects
// x-tenant-slug from this cookie (set when a /t/{slug} page is served).
const TENANT_COOKIE = 'tenant_slug';

function isValidSlug(label: string): boolean {
  return /^[a-z0-9-]+$/.test(label) && !RESERVED.has(label);
}

// Path-based tenant routing: /t/{slug}/... is the public URL for tenant
// dashboards now that {slug}.techhanker.com hosts are routed to the per-tenant
// Riogentix instances at the edge and never reach this app. Reserved labels
// (/t/admin, /t/app) are the internal tree itself, not slugs.
function extractPathSlug(pathname: string): { slug: string; rest: string } | null {
  const m = /^\/t\/([a-z0-9-]+)(\/.*)?$/.exec(pathname);
  if (!m?.[1] || !isValidSlug(m[1])) return null;
  return { slug: m[1], rest: m[2] ?? '' };
}

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
  const pathTenant = slug ? null : extractPathSlug(pathname);

  // Tenant precedence: subdomain host (legacy) > /t/{slug} path > cookie. The
  // cookie keeps API calls and internal navigations bound to the tenant whose
  // dashboard the user last opened.
  const cookieSlug = req.cookies.get(TENANT_COOKIE)?.value;
  const activeSlug =
    slug ?? pathTenant?.slug ?? (cookieSlug && isValidSlug(cookieSlug) ? cookieSlug : null);

  const headers = new Headers(req.headers);
  headers.set('x-request-id', crypto.randomUUID());
  if (activeSlug) headers.set('x-tenant-slug', activeSlug);

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
    // the x-tenant-slug header set above. For /t/{slug} paths, pass ?tenant= so
    // the signin page brands correctly and the post-login redirect returns here.
    const signInUrl = new URL('/auth/signin', req.url);
    if (pathTenant) signInUrl.searchParams.set('tenant', pathTenant.slug);
    const res = NextResponse.redirect(signInUrl);
    if (staleSessionCookies) clearSessionCookies(req, res);
    return res;
  }

  // Root domain: an already-authenticated user hitting / directly (e.g. a
  // bookmark, or revisiting after login) should land in their workspace, not
  // get stuck looking at the marketing page.
  if (!slug && pathname === '/' && session?.user) {
    return NextResponse.redirect(new URL('/auth/redirect', req.url));
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

    // Rewrite tenant subdomain requests into the /t/[slug] tree. (Legacy: these
    // hosts are normally routed to the tenants' Riogentix instances at the edge
    // and never reach this app.)
    if (pathname === '/') {
      return NextResponse.rewrite(new URL(`/t/${slug}`, req.url), { request: { headers } });
    }
    if (pathname === '/admin' || pathname.startsWith('/admin/')) {
      return NextResponse.rewrite(new URL(`/t/${slug}` + pathname, req.url), {
        request: { headers },
      });
    }
    if (pathname === '/app' || pathname.startsWith('/app/')) {
      return NextResponse.rewrite(new URL(`/t/${slug}` + pathname, req.url), {
        request: { headers },
      });
    }
  }

  if (pathTenant) {
    const rest = pathTenant.rest || '/';

    // Legacy tenant paths, e.g. /t/acme/dashboard → /t/acme/admin
    const legacyTarget = LEGACY_TENANT_REDIRECTS[rest === '/' ? '' : rest];
    if (legacyTarget) {
      return NextResponse.redirect(new URL(`/t/${pathTenant.slug}${legacyTarget}`, req.url));
    }
    if (rest === '/team' || rest.startsWith('/team/')) {
      return NextResponse.redirect(new URL(`/t/${pathTenant.slug}/admin${rest}`, req.url));
    }

    // /t/{slug} is a real route segment; no rewrite needed. Remember the active
    // tenant in a cookie so subsequent /api/* calls resolve to it.
    const res = NextResponse.next({ request: { headers } });
    res.cookies.set(TENANT_COOKIE, pathTenant.slug, {
      path: '/',
      sameSite: 'lax',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 30,
    });
    return res;
  }

  // Root-domain /dashboard (used by legacy links and the invite-accept flow)
  // → the post-login redirect page, which routes to the user's tenant.
  if (!slug && (pathname === '/dashboard' || pathname.startsWith('/dashboard/'))) {
    return NextResponse.redirect(new URL('/auth/redirect', req.url));
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
