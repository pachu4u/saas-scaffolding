import { auth } from '@platform/auth';
import { adminDb } from '@platform/db';
import { redirect } from 'next/navigation';

import { ConnectedAppScimPanel } from './connected-app-scim-panel';
import { HubTeamPanel, type HubMember } from './hub-team-panel';

import { Topbar } from '@/components/layout/topbar';
import { StatCard } from '@/components/ui/stat-card';
import { getCurrentTenant } from '@/lib/server-tenant';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'App Settings' };

const ROLE_LABELS: Record<string, string> = {
  tenant_admin: 'Admin',
  tenant_billing_admin: 'Billing Admin',
  tenant_user: 'Member',
  tenant_viewer: 'Viewer',
};

export default async function AppSettingsPage() {
  const session = await auth();
  if (!session) redirect('/auth/signin');

  const { tenant: tenantCtx } = await getCurrentTenant(session.user.id);
  if (!tenantCtx) redirect('/');

  const { tenantId } = tenantCtx;
  const base = `/t/${tenantCtx.slug}`;

  const [tenant, tenantUsers, roleBindings, connectedAppInstance] = await Promise.all([
    adminDb.tenant.findUnique({
      where: { id: tenantId },
      select: { name: true, slug: true, branding: true },
    }),
    adminDb.tenantUser.findMany({
      where: { tenantId },
      include: { user: { select: { id: true, email: true } } },
      orderBy: { joinedAt: 'asc' },
    }),
    adminDb.roleBinding.findMany({
      where: { tenantId },
      include: { role: { select: { id: true, name: true } } },
    }),
    adminDb.connectedAppInstance.findFirst({
      where: { tenantId },
      include: { app: true },
    }),
  ]);

  if (!tenant) redirect('/');

  const app = connectedAppInstance?.app ?? null;
  const roles = app
    ? await adminDb.role.findMany({
        where: { appId: app.id },
        select: {
          id: true,
          name: true,
          isSystem: true,
          _count: { select: { bindings: { where: { tenantId } } } },
        },
        orderBy: { name: 'asc' },
      })
    : [];

  const userRoleName = new Map<string, string>();
  for (const rb of roleBindings) {
    if (!userRoleName.has(rb.userId)) userRoleName.set(rb.userId, rb.role.name);
  }

  const members: HubMember[] = tenantUsers.map((tu) => {
    const roleName = userRoleName.get(tu.user.id) ?? 'tenant_user';
    return {
      userId: tu.user.id,
      email: tu.user.email,
      status: tu.status,
      roleName,
      roleLabel: ROLE_LABELS[roleName] ?? roleName,
    };
  });

  const activeCount = tenantUsers.filter((u) => u.status === 'ACTIVE').length;
  const invitedCount = tenantUsers.filter((u) => u.status === 'INVITED').length;

  const branding = (tenant.branding ?? {}) as Record<string, unknown>;
  const primaryColor = (branding.primaryColor as string | undefined) ?? '#4F7BFF';
  const accentColor = (branding.accentColor as string | undefined) ?? '#B06CFF';
  const bgColor = (branding.bgColor as string | undefined) ?? '#F8F6FF';
  const logoText = (branding.logoText as string | undefined) ?? tenant.name;

  const topRoles = [...roles].sort((a, b) => b._count.bindings - a._count.bindings).slice(0, 4);

  return (
    <div>
      <Topbar
        title={app?.name ?? 'App Settings'}
        subtitle={app?.description ?? 'Connected app configuration, team access, and roles'}
        userEmail={session.user.email}
        userName={session.user.name ?? undefined}
      />

      <main className="space-y-5 p-6">
        {/* Stat tiles */}
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          <StatCard
            label="Total Members"
            value={tenantUsers.length.toLocaleString()}
            change={`${String(activeCount)} active`}
            positive={true}
            iconColor="rgba(79,123,255,0.1)"
            icon={
              <svg viewBox="0 0 20 20" fill="var(--brand-primary)" className="h-5 w-5">
                <path d="M9 6a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM17 6a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 0 0-1.5-4.33A5 5 0 0 1 19 16v1h-6.07zM6 11a5 5 0 0 1 5 5v1H1v-1a5 5 0 0 1 5-5z" />
              </svg>
            }
          />
          <StatCard
            label="Active Members"
            value={activeCount.toLocaleString()}
            change="Signed in & active"
            positive={true}
            iconColor="rgba(22,163,74,0.1)"
            icon={
              <svg viewBox="0 0 20 20" fill="#16A34A" className="h-5 w-5">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16zm3.707-9.293a1 1 0 0 0-1.414-1.414L9 10.586 7.707 9.293a1 1 0 0 0-1.414 1.414l2 2a1 1 0 0 0 1.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
            }
          />
          <StatCard
            label="Pending Invites"
            value={invitedCount.toLocaleString()}
            change={invitedCount === 0 ? 'No pending' : 'Awaiting acceptance'}
            positive={invitedCount === 0}
            iconColor="rgba(217,119,6,0.08)"
            icon={
              <svg viewBox="0 0 20 20" fill="#D97706" className="h-5 w-5">
                <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0 0 16 4H4a2 2 0 0 0-1.997 1.884z" />
                <path d="m18 8.118-8 4-8-4V14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8.118z" />
              </svg>
            }
          />
          <StatCard
            label="App Roles"
            value={roles.length.toLocaleString()}
            change={`${String(roles.filter((r) => !r.isSystem).length)} custom`}
            positive={true}
            iconColor="rgba(176,108,255,0.1)"
            icon={
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--brand-accent)"
                strokeWidth={1.7}
                className="h-5 w-5"
              >
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            }
          />
        </div>

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
          {/* Team & access — left, wider */}
          <div className="xl:col-span-2">
            <HubTeamPanel
              members={members}
              tenantSlug={tenant.slug}
              viewAllHref={`${base}/admin/team`}
            />
          </div>

          {/* Right column: connected app, branding + roles snapshots */}
          <div className="space-y-5">
            {/* Connected app identity */}
            <div
              className="rounded-xl border p-4"
              style={{
                background: 'var(--bg-white)',
                borderColor: 'var(--border-light)',
                boxShadow: 'var(--shadow-card)',
              }}
            >
              {app ? (
                <div className="flex items-start gap-3">
                  {app.iconUrl ? (
                    <img
                      src={app.iconUrl}
                      alt=""
                      className="h-10 w-10 flex-shrink-0 rounded-lg object-contain"
                    />
                  ) : (
                    <div className="brand-gradient flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg text-sm font-bold text-white">
                      {app.name[0]?.toUpperCase() ?? 'A'}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div
                      className="truncate text-sm font-bold"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      {app.name}
                    </div>
                    {app.description && (
                      <p className="mt-0.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                        {app.description}
                      </p>
                    )}
                    {app.docsUrl && (
                      <a
                        href={app.docsUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1.5 inline-block text-xs font-semibold hover:underline"
                        style={{ color: 'var(--brand-primary)' }}
                      >
                        View documentation →
                      </a>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  No connected app yet.
                </p>
              )}
            </div>

            {connectedAppInstance && (
              <ConnectedAppScimPanel
                scimBaseUrl={connectedAppInstance.scimBaseUrl}
                lastSyncedAt={connectedAppInstance.lastSyncedAt?.toISOString() ?? null}
                lastSyncError={connectedAppInstance.lastSyncError}
              />
            )}

            {/* Branding snapshot */}
            <div
              className="overflow-hidden rounded-xl border"
              style={{
                background: 'var(--bg-white)',
                borderColor: 'var(--border-light)',
                boxShadow: 'var(--shadow-card)',
              }}
            >
              <div
                className="flex items-center gap-3 p-4"
                style={{ background: `linear-gradient(135deg, ${accentColor}, ${primaryColor})` }}
              >
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-white/20 text-base font-bold text-white">
                  {logoText[0]?.toUpperCase() ?? 'W'}
                </div>
                <div className="min-w-0">
                  <div className="truncate text-sm font-bold text-white">{logoText}</div>
                  <div className="truncate text-xs text-white/80">App branding</div>
                </div>
              </div>
              <div className="p-4">
                <div className="mb-3 flex gap-2">
                  {[
                    { label: 'Primary', color: primaryColor },
                    { label: 'Accent', color: accentColor },
                    { label: 'Background', color: bgColor },
                  ].map((c) => (
                    <div key={c.label} className="flex-1 text-center">
                      <div
                        className="mx-auto mb-1 h-8 w-8 rounded-lg border"
                        style={{ background: c.color, borderColor: 'var(--border-light)' }}
                      />
                      <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                        {c.label}
                      </div>
                    </div>
                  ))}
                </div>
                <a
                  href={`${base}/admin/settings/branding`}
                  className="block rounded-lg border px-3 py-2 text-center text-xs font-semibold transition-colors hover:bg-gray-50"
                  style={{ borderColor: 'var(--border-light)', color: 'var(--brand-primary)' }}
                >
                  Customize branding →
                </a>
              </div>
            </div>

            {/* Roles snapshot */}
            <div
              className="rounded-xl border p-4"
              style={{
                background: 'var(--bg-white)',
                borderColor: 'var(--border-light)',
                boxShadow: 'var(--shadow-card)',
              }}
            >
              <h2 className="mb-3 text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                App roles at a glance
              </h2>
              {topRoles.length === 0 ? (
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {app
                    ? 'No app-specific roles configured yet.'
                    : 'Connect an app to see its roles here.'}
                </p>
              ) : (
                <div className="space-y-2.5">
                  {topRoles.map((role) => (
                    <div key={role.id} className="flex items-center justify-between gap-2">
                      <span
                        className="truncate text-xs font-medium"
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        {role.name}
                      </span>
                      <span
                        className="flex-shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold"
                        style={{ background: 'var(--bg-subtle)', color: 'var(--text-muted)' }}
                      >
                        {role._count.bindings} {role._count.bindings === 1 ? 'member' : 'members'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
