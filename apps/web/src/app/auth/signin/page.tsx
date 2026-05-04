import { signIn } from '@platform/auth';
import Link from 'next/link';

export const metadata = { title: 'Sign in' };

export default function SignInPage() {
  return (
    <div className="flex min-h-screen" style={{ background: 'var(--bg-main)' }}>
      {/* Left panel */}
      <div className="brand-gradient relative hidden w-[480px] flex-col overflow-hidden p-12 lg:flex">
        <div
          className="absolute inset-0 opacity-20"
          style={{
            background:
              'radial-gradient(circle at 20% 80%, rgba(255,255,255,0.3), transparent 50%), radial-gradient(circle at 80% 20%, rgba(255,255,255,0.2), transparent 50%)',
          }}
        />
        <div className="relative flex flex-1 flex-col">
          <div className="mb-auto flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/20 text-sm font-bold text-white">
              R
            </div>
            <span className="text-lg font-bold text-white">riogentix</span>
          </div>
          <div className="mb-auto">
            <blockquote className="mb-4 text-xl font-medium leading-relaxed text-white/90">
              &ldquo;riogentix cut our time-to-market by 3 months. The multi-tenant architecture and
              built-in SSO are exactly what enterprise clients expect.&rdquo;
            </blockquote>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-white/20" />
              <div>
                <div className="text-sm font-semibold text-white">Sarah Chen</div>
                <div className="text-xs text-white/70">CTO, Momentum Labs</div>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            {['SOC 2 Ready', 'GDPR Compliant', 'Enterprise SSO'].map((badge) => (
              <div key={badge} className="rounded-xl bg-white/10 p-3 text-center">
                <div className="text-xs font-semibold text-white">{badge}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="mb-10 flex items-center gap-2 lg:hidden">
            <div className="brand-gradient flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold text-white">
              R
            </div>
            <span className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
              riogentix
            </span>
          </div>

          {/* ── Tenant sign-in ──────────────────────────────────────────── */}
          <h1 className="mb-1 text-2xl font-extrabold" style={{ color: 'var(--text-primary)' }}>
            Welcome back
          </h1>
          <p className="mb-6 text-sm" style={{ color: 'var(--text-secondary)' }}>
            Sign in to your organisation&apos;s workspace
          </p>

          <form
            action={async () => {
              'use server';
              await signIn('keycloak', { redirectTo: '/dashboard' });
            }}
            className="space-y-4"
          >
            <button
              type="submit"
              className="brand-gradient flex w-full items-center justify-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            >
              <svg
                viewBox="0 0 24 24"
                className="h-5 w-5 fill-white"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M12 1.5C6.201 1.5 1.5 6.201 1.5 12S6.201 22.5 12 22.5 22.5 17.799 22.5 12 17.799 1.5 12 1.5zm0 2a8.5 8.5 0 1 1 0 17 8.5 8.5 0 0 1 0-17zM9.5 8.5a3 3 0 0 0 0 6h5a3 3 0 0 0 0-6h-5z" />
              </svg>
              Continue with SSO
            </button>
          </form>

          <p className="mt-4 text-center text-xs" style={{ color: 'var(--text-muted)' }}>
            Tenant users and platform admins both sign in with SSO. Platform admins are
            automatically redirected to the admin area after login.
          </p>

          {/* ── Divider ─────────────────────────────────────────────────── */}
          <div className="relative my-8">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t" style={{ borderColor: 'var(--border-light)' }} />
            </div>
            <div
              className="relative flex justify-center text-xs"
              style={{ color: 'var(--text-muted)' }}
            >
              <span className="px-3" style={{ background: 'var(--bg-main)' }}>
                Keycloak administration
              </span>
            </div>
          </div>

          {/* ── Keycloak Admin Console ──────────────────────────────────── */}
          <div
            className="rounded-xl border p-4"
            style={{ borderColor: 'var(--border-default)', background: 'var(--bg-subtle)' }}
          >
            <div className="mb-3 flex items-center gap-2">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.8}
                className="h-4 w-4 flex-shrink-0"
                style={{ color: 'var(--brand-accent)' }}
              >
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                Keycloak Admin Console
              </span>
            </div>
            <p className="mb-3 text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              Manage realms, users, identity providers, and SSO configuration directly in Keycloak.
            </p>
            <Link
              href="https://auth.lvh.me/admin"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-xs font-semibold transition-colors hover:bg-white"
              style={{
                borderColor: 'var(--border-default)',
                color: 'var(--text-primary)',
                background: 'transparent',
              }}
            >
              Open Keycloak Admin Console
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.8}
                className="h-3.5 w-3.5"
              >
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
            </Link>
          </div>

          <p className="mt-8 text-center text-xs" style={{ color: 'var(--text-muted)' }}>
            By signing in, you agree to our{' '}
            <a href="#" className="hover:text-brand-primary underline">
              Terms
            </a>{' '}
            and{' '}
            <a href="#" className="hover:text-brand-primary underline">
              Privacy Policy
            </a>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
