import { auth, signOut } from '@platform/auth';
import { adminDb } from '@platform/db';
import { redirect } from 'next/navigation';

import { Topbar } from '@/components/layout/topbar';
import { Badge } from '@/components/ui/badge';

export const metadata = { title: 'Profile' };

const PLAN_BADGE: Record<string, 'blue' | 'purple' | 'gray'> = {
  pro: 'blue',
  enterprise: 'purple',
  free: 'gray',
};

export default async function ProfilePage() {
  const session = await auth();
  if (!session) redirect('/auth/signin');

  // Load DB record + workspace memberships
  const user = await adminDb.user.findUnique({
    where: { externalId: session.user.id },
    include: {
      tenantUsers: {
        where: { status: { not: 'SUSPENDED' } },
        include: {
          tenant: { select: { id: true, name: true, slug: true, plan: true } },
        },
        orderBy: { joinedAt: 'asc' },
      },
    },
  });

  const initials = (session.user.name ?? session.user.email)
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');

  const isPlatformAdmin =
    Array.isArray(session.groups) &&
    (session.groups as string[]).some((g) =>
      ['platform_super_admin', 'platform_support'].includes(g),
    );

  return (
    <div>
      <Topbar
        title="Profile"
        subtitle="Your account details and workspace memberships"
        userEmail={session.user.email}
        userName={session.user.name ?? undefined}
      />

      <main className="space-y-6 p-6">
        {/* Identity card */}
        <div
          className="relative overflow-hidden rounded-xl border p-6"
          style={{
            background: 'var(--bg-white)',
            borderColor: 'var(--border-light)',
            boxShadow: 'var(--shadow-card)',
          }}
        >
          <div
            className="pointer-events-none absolute right-0 top-0 h-40 w-40 rounded-full opacity-20 blur-3xl"
            style={{ background: 'var(--glow-blue)', transform: 'translate(30%, -30%)' }}
          />
          <div className="relative flex flex-col gap-6 sm:flex-row sm:items-start">
            {/* Avatar */}
            <div className="brand-gradient flex h-20 w-20 flex-shrink-0 items-center justify-center rounded-xl text-2xl font-extrabold text-white">
              {initials}
            </div>

            {/* Info */}
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-extrabold" style={{ color: 'var(--text-primary)' }}>
                  {session.user.name ?? 'Unknown'}
                </h2>
                {isPlatformAdmin && (
                  <Badge variant="purple" dot>
                    Platform admin
                  </Badge>
                )}
              </div>
              <p className="mb-4 text-sm" style={{ color: 'var(--text-muted)' }}>
                {session.user.email}
              </p>

              <dl className="grid grid-cols-1 gap-x-8 gap-y-2 sm:grid-cols-2">
                <div className="flex items-center gap-2">
                  <dt
                    className="text-xs font-semibold uppercase tracking-wide"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    Account status
                  </dt>
                  <dd>
                    <Badge variant="success" dot>
                      {user?.status ?? 'ACTIVE'}
                    </Badge>
                  </dd>
                </div>
                <div>
                  <dt
                    className="text-xs font-semibold uppercase tracking-wide"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    Member since
                  </dt>
                  <dd className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    {user?.createdAt
                      ? user.createdAt.toLocaleDateString('en-US', {
                          month: 'long',
                          year: 'numeric',
                          day: 'numeric',
                        })
                      : '—'}
                  </dd>
                </div>
                <div>
                  <dt
                    className="text-xs font-semibold uppercase tracking-wide"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    User ID
                  </dt>
                  <dd className="truncate font-mono text-xs" style={{ color: 'var(--text-muted)' }}>
                    {session.user.id}
                  </dd>
                </div>
                <div>
                  <dt
                    className="text-xs font-semibold uppercase tracking-wide"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    Workspaces
                  </dt>
                  <dd className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {user?.tenantUsers.length ?? 0}
                  </dd>
                </div>
              </dl>
            </div>

            {/* Sign-out */}
            <form
              action={async () => {
                'use server';
                await signOut({ redirectTo: '/auth/signin' });
              }}
            >
              <button
                type="submit"
                className="hover:bg-bg-subtle whitespace-nowrap rounded-xl border px-4 py-2 text-sm font-semibold transition-colors"
                style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}
              >
                Sign out
              </button>
            </form>
          </div>
        </div>

        {/* Workspace memberships */}
        <div
          className="rounded-xl border"
          style={{
            background: 'var(--bg-white)',
            borderColor: 'var(--border-light)',
            boxShadow: 'var(--shadow-card)',
          }}
        >
          <div
            className="flex items-center justify-between border-b px-6 py-4"
            style={{ borderColor: 'var(--border-light)' }}
          >
            <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
              Workspace memberships
            </h3>
          </div>
          {!user || user.tenantUsers.length === 0 ? (
            <div className="px-6 py-8 text-center">
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                You are not a member of any workspace.
              </p>
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: 'var(--border-light)' }}>
              {user.tenantUsers.map((tu) => (
                <div key={tu.tenantId} className="flex items-center justify-between px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="brand-gradient flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white">
                      {tu.tenant.name[0]?.toUpperCase()}
                    </div>
                    <div>
                      <div
                        className="text-sm font-semibold"
                        style={{ color: 'var(--text-primary)' }}
                      >
                        {tu.tenant.name}
                      </div>
                      <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        {tu.tenant.slug}.riogentix.app
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={PLAN_BADGE[tu.tenant.plan] ?? 'gray'}>{tu.tenant.plan}</Badge>
                    <Badge variant={tu.status === 'ACTIVE' ? 'success' : 'gray'} dot>
                      {tu.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Current session */}
        <div
          className="rounded-xl border"
          style={{
            background: 'var(--bg-white)',
            borderColor: 'var(--border-light)',
            boxShadow: 'var(--shadow-card)',
          }}
        >
          <div
            className="flex items-center justify-between border-b px-6 py-4"
            style={{ borderColor: 'var(--border-light)' }}
          >
            <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
              Active sessions
            </h3>
          </div>
          <div className="flex items-center gap-4 px-6 py-4">
            <div
              className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl"
              style={{ background: 'var(--bg-subtle)' }}
            >
              <svg
                viewBox="0 0 20 20"
                fill="currentColor"
                className="h-5 w-5"
                style={{ color: 'var(--text-muted)' }}
              >
                <path
                  fillRule="evenodd"
                  d="M2 4.75A.75.75 0 0 1 2.75 4h14.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 4.75zM2 10a.75.75 0 0 1 .75-.75h14.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 10zm0 5.25a.75.75 0 0 1 .75-.75h14.5a.75.75 0 0 1 0 1.5H2.75a.75.75 0 0 1-.75-.75z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                  Current session
                </span>
                <Badge variant="success" dot>
                  Active
                </Badge>
              </div>
              <div className="mt-0.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                Signed in via Keycloak SSO · JWT-based (stateless)
              </div>
            </div>
            <form
              action={async () => {
                'use server';
                await signOut({ redirectTo: '/auth/signin' });
              }}
            >
              <button
                type="submit"
                className="hover:bg-bg-subtle rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors"
                style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}
              >
                Revoke
              </button>
            </form>
          </div>
        </div>

        {/* Raw session (developer panel) */}
        <details>
          <summary
            className="cursor-pointer text-xs font-semibold hover:underline"
            style={{ color: 'var(--text-muted)' }}
          >
            Developer: raw session token
          </summary>
          <pre
            className="mt-3 overflow-x-auto rounded-xl p-5 text-xs"
            style={{
              background: 'var(--bg-white)',
              border: '1px solid var(--border-light)',
              color: 'var(--text-secondary)',
            }}
          >
            {JSON.stringify(session, null, 2)}
          </pre>
        </details>
      </main>
    </div>
  );
}
