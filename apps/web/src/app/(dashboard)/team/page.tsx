import { auth } from '@platform/auth';
import { adminDb } from '@platform/db';
import { redirect } from 'next/navigation';

import { TeamMembersTable } from '@/components/team/team-members-table';
import { Badge } from '@/components/ui/badge';
import { StatCard } from '@/components/ui/stat-card';
import { getCurrentTenant } from '@/lib/server-tenant';
import { timeAgo } from '@/lib/time';

export const metadata = { title: 'Team — Members' };

export default async function TeamMembersPage() {
  const session = await auth();
  if (!session) redirect('/auth/signin');

  const { tenant: tenantCtx } = await getCurrentTenant(session.user.id);
  if (!tenantCtx) redirect('/');

  const { tenantId } = tenantCtx;

  const [tenantUsers, roleBindings, scimToken] = await Promise.all([
    adminDb.tenantUser.findMany({
      where: { tenantId },
      include: { user: { select: { id: true, email: true } } },
      orderBy: { joinedAt: 'asc' },
    }),
    adminDb.roleBinding.findMany({
      where: { tenantId },
      include: { role: { select: { id: true, name: true } } },
    }),
    adminDb.scimToken.findFirst({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      select: { name: true, lastUsedAt: true, createdAt: true },
    }),
  ]);

  // Build userId → role names map
  const userRoles = new Map<string, string[]>();
  for (const rb of roleBindings) {
    const existing = userRoles.get(rb.userId) ?? [];
    existing.push(rb.role.name);
    userRoles.set(rb.userId, existing);
  }

  const activeCount = tenantUsers.filter((u) => u.status === 'ACTIVE').length;
  const invitedCount = tenantUsers.filter((u) => u.status === 'INVITED').length;
  const suspendedCount = tenantUsers.filter((u) => u.status === 'SUSPENDED').length;

  const tableData = tenantUsers.map((tu) => {
    const rawRoles = userRoles.get(tu.user.id) ?? [];
    const roles = rawRoles.map((r) => {
      const map: Record<string, string> = {
        tenant_admin: 'Admin',
        tenant_billing_admin: 'Billing Admin',
        tenant_user: 'Member',
        tenant_viewer: 'Viewer',
      };
      return map[r] ?? r;
    });
    return {
      userId: tu.user.id,
      email: tu.user.email,
      status: tu.status,
      roles: roles.length > 0 ? roles : ['Member'],
      joinedAt: tu.joinedAt.toISOString(),
    };
  });

  return (
    <div className="space-y-5">
      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard
          label="Total Members"
          value={String(tenantUsers.length)}
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
          label="Pending Invites"
          value={String(invitedCount)}
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
          label="Suspended"
          value={String(suspendedCount)}
          change={suspendedCount === 0 ? 'None suspended' : 'Needs review'}
          positive={suspendedCount === 0}
          iconColor="rgba(220,38,38,0.08)"
          icon={
            <svg viewBox="0 0 20 20" fill="#DC2626" className="h-5 w-5">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM8.707 7.293a1 1 0 0 0-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 1 0 1.414 1.414L10 11.414l1.293 1.293a1 1 0 0 0 1.414-1.414L11.414 10l1.293-1.293a1 1 0 0 0-1.414-1.414L10 8.586 8.707 7.293z"
                clipRule="evenodd"
              />
            </svg>
          }
        />
      </div>

      {/* Members data table */}
      <TeamMembersTable data={tableData} tenantSlug={tenantCtx.slug} />

      {/* SCIM provisioning status */}
      <div
        className="flex items-center gap-4 rounded-xl border p-4"
        style={{
          background: 'var(--bg-white)',
          borderColor: 'var(--border-light)',
          boxShadow: 'var(--shadow-card)',
        }}
      >
        <div
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg text-lg"
          style={{ background: 'var(--bg-subtle)' }}
        >
          🔄
        </div>
        <div className="flex-1">
          <div className="mb-0.5 text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
            SCIM Provisioning
          </div>
          {scimToken ? (
            <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              Token: <strong>{scimToken.name}</strong>
              {scimToken.lastUsedAt
                ? ` · Last used ${timeAgo(scimToken.lastUsedAt)}`
                : ' · Never used'}
            </div>
          ) : (
            <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              No SCIM token configured. Set one up in Security settings.
            </div>
          )}
        </div>
        <div className="flex flex-shrink-0 items-center gap-2">
          {scimToken ? (
            <Badge variant="success" dot>
              Configured
            </Badge>
          ) : (
            <Badge variant="gray" dot>
              Not configured
            </Badge>
          )}
          <a
            href="/settings/security"
            className="rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-gray-50"
            style={{ borderColor: 'var(--border-light)', color: 'var(--text-secondary)' }}
          >
            Configure
          </a>
        </div>
      </div>
    </div>
  );
}
