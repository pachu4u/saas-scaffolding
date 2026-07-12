import { auth } from '@platform/auth';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { getCurrentTenant } from '@/lib/server-tenant';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Home' };

export default async function TenantHomePage() {
  const session = await auth();
  if (!session) redirect('/auth/signin');

  const { tenant } = await getCurrentTenant(session.user.id);
  const tenantName = tenant?.name ?? 'Workspace';

  const isPlatformAdmin =
    Array.isArray(session.groups) &&
    session.groups.some((g: string) => ['platform_super_admin', 'platform_support'].includes(g));

  const isTenantAdmin =
    !isPlatformAdmin &&
    Array.isArray(session.groups) &&
    session.groups.some((g: string) => g.includes('admin') || g.includes('owner'));

  const tiles = [
    ...(isTenantAdmin || isPlatformAdmin
      ? [
          {
            href: '/admin',
            icon: (
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.7}
                className="h-8 w-8"
              >
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            ),
            label: 'Admin Panel',
            description: 'Manage team, billing, settings, and audit logs',
            accent: 'var(--brand-primary)',
          },
        ]
      : []),
    {
      href: '/app',
      icon: (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.7}
          className="h-8 w-8"
        >
          <polygon points="12 2 2 7 12 12 22 7 12 2" />
          <polyline points="2 17 12 22 22 17" />
          <polyline points="2 12 12 17 22 12" />
        </svg>
      ),
      label: 'Riogentix App',
      description: 'Open the full Riogentix application',
      accent: 'var(--brand-accent)',
    },
  ];

  return (
    <div className="flex min-h-screen flex-col" style={{ background: 'var(--bg-main)' }}>
      {/* Header */}
      <header
        className="flex items-center justify-between border-b px-6 py-4"
        style={{ background: 'var(--bg-white)', borderColor: 'var(--border-light)' }}
      >
        <div className="flex items-center gap-2.5">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold text-white"
            style={{ background: 'var(--brand-gradient)' }}
          >
            R
          </div>
          <div>
            <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
              {tenantName}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
            {session.user.email}
          </span>
          <a
            href="/api/auth/keycloak-logout"
            className="rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-gray-50"
            style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}
          >
            Sign out
          </a>
        </div>
      </header>

      {/* Main */}
      <main className="flex flex-1 flex-col items-center justify-center p-8">
        <div className="mb-10 text-center">
          <h1 className="mb-2 text-3xl font-extrabold" style={{ color: 'var(--text-primary)' }}>
            Welcome to {tenantName}
          </h1>
          <p className="text-base" style={{ color: 'var(--text-secondary)' }}>
            Where would you like to go?
          </p>
        </div>

        <div
          className={`grid gap-6 ${tiles.length === 1 ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2'} w-full max-w-2xl`}
        >
          {tiles.map((tile) => (
            <Link
              key={tile.href}
              href={tile.href}
              className="group flex flex-col items-center gap-4 rounded-2xl border p-8 text-center transition-all hover:-translate-y-1 hover:shadow-lg"
              style={{
                background: 'var(--bg-white)',
                borderColor: 'var(--border-light)',
                boxShadow: 'var(--shadow-card)',
              }}
            >
              <div
                className="flex h-16 w-16 items-center justify-center rounded-2xl transition-colors"
                style={{ background: `${tile.accent}18`, color: tile.accent }}
              >
                {tile.icon}
              </div>
              <div>
                <div className="mb-1 text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                  {tile.label}
                </div>
                <div className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  {tile.description}
                </div>
              </div>
              <div
                className="mt-1 flex items-center gap-1 text-xs font-semibold transition-colors"
                style={{ color: tile.accent }}
              >
                Open
                <svg
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  className="h-3.5 w-3.5"
                >
                  <path d="M3 8h10M9 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
