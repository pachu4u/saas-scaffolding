import { adminDb } from '@platform/db';
import { resolveTenant } from '@platform/tenant';
import { redirect } from 'next/navigation';

import { timeAgo, formatDate } from '@/lib/time';
import { Badge } from '@/components/ui/badge';

export const metadata = { title: 'Team — Members' };

const roleColors: Record<string, 'purple' | 'blue' | 'default' | 'gray'> = {
  Admin: 'purple',
  'Billing Admin': 'blue',
  Member: 'default',
  Viewer: 'gray',
};

const statusColors: Record<string, 'success' | 'warning' | 'error'> = {
  ACTIVE: 'success',
  INVITED: 'warning',
  SUSPENDED: 'error',
};

const statusLabels: Record<string, string> = {
  ACTIVE: 'Active',
  INVITED: 'Invited',
  SUSPENDED: 'Suspended',
};

export default async function TeamMembersPage() {
  const slug = process.env.NEXT_PUBLIC_DEFAULT_TENANT_SLUG ?? 'acme';
  const tenantCtx = await resolveTenant(slug);
  if (!tenantCtx) redirect('/');

  const { tenantId } = tenantCtx;

  // Fetch tenant users with their user data
  const [tenantUsers, roleBindings, scimToken, seatLimit] = await Promise.all([
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
    Promise.resolve(null as number | null), // seat limit from plan features if needed
  ]);

  // Build userId → role names map
  const userRoles = new Map<string, string[]>();
  for (const rb of roleBindings) {
    const existing = userRoles.get(rb.userId) ?? [];
    existing.push(rb.role.name);
    userRoles.set(rb.userId, existing);
  }

  // Summary counts
  const activeCount = tenantUsers.filter((u) => u.status === 'ACTIVE').length;
  const invitedCount = tenantUsers.filter((u) => u.status === 'INVITED').length;
  const suspendedCount = tenantUsers.filter((u) => u.status === 'SUSPENDED').length;

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        {[
          {
            label: 'Total Members',
            value: String(tenantUsers.length),
            sub: seatLimit
              ? `${String(seatLimit - tenantUsers.length)} seats remaining`
              : `${String(activeCount)} active`,
            color: 'var(--brand-primary)',
          },
          {
            label: 'Pending Invites',
            value: String(invitedCount),
            sub: invitedCount === 1 ? 'Awaiting acceptance' : 'Awaiting acceptance',
            color: 'var(--status-warning)',
          },
          {
            label: 'Suspended',
            value: String(suspendedCount),
            sub: 'Access revoked',
            color: 'var(--status-error)',
          },
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-2xl border p-5"
            style={{
              background: 'var(--bg-white)',
              borderColor: 'var(--border-light)',
              boxShadow: 'var(--shadow-card)',
            }}
          >
            <div
              className="mb-2 text-xs font-semibold uppercase tracking-wide"
              style={{ color: 'var(--text-muted)' }}
            >
              {s.label}
            </div>
            <div className="text-3xl font-extrabold" style={{ color: s.color }}>
              {s.value}
            </div>
            <div className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
              {s.sub}
            </div>
          </div>
        ))}
      </div>

      {/* Filters + table */}
      <div
        className="rounded-2xl border"
        style={{
          background: 'var(--bg-white)',
          borderColor: 'var(--border-light)',
          boxShadow: 'var(--shadow-card)',
        }}
      >
        <div
          className="flex items-center gap-3 border-b px-6 py-4"
          style={{ borderColor: 'var(--border-light)' }}
        >
          <div className="relative flex-1">
            <svg
              viewBox="0 0 20 20"
              fill="currentColor"
              className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
              style={{ color: 'var(--text-muted)' }}
            >
              <path
                fillRule="evenodd"
                d="M8 4a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM2 8a6 6 0 1 1 10.89 3.476l4.817 4.817a1 1 0 0 1-1.414 1.414l-4.816-4.816A6 6 0 0 1 2 8z"
                clipRule="evenodd"
              />
            </svg>
            <input
              type="text"
              placeholder="Search members..."
              className="w-full rounded-xl border py-2 pl-9 pr-4 text-sm outline-none"
              style={{
                borderColor: 'var(--border-light)',
                background: 'var(--bg-main)',
                color: 'var(--text-primary)',
              }}
            />
          </div>
          <select
            className="rounded-xl border px-3 py-2 text-sm outline-none"
            style={{
              borderColor: 'var(--border-light)',
              background: 'var(--bg-main)',
              color: 'var(--text-secondary)',
            }}
          >
            <option>All roles</option>
            <option>Admin</option>
            <option>Billing Admin</option>
            <option>Member</option>
            <option>Viewer</option>
          </select>
          <select
            className="rounded-xl border px-3 py-2 text-sm outline-none"
            style={{
              borderColor: 'var(--border-light)',
              background: 'var(--bg-main)',
              color: 'var(--text-secondary)',
            }}
          >
            <option>All statuses</option>
            <option>Active</option>
            <option>Invited</option>
            <option>Suspended</option>
          </select>
        </div>

        {tenantUsers.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
            No members yet. Invite your first team member!
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-light)' }}>
                  {['Member', 'Role', 'Status', 'Joined', ''].map((col) => (
                    <th
                      key={col}
                      className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tenantUsers.map((tu, i) => {
                  const roles = userRoles.get(tu.userId) ?? ['Member'];
                  const primaryRole = roles[0] ?? 'Member';
                  const initials = tu.user.email.slice(0, 2).toUpperCase();
                  const statusLabel = statusLabels[tu.status] ?? tu.status;
                  const statusVariant = statusColors[tu.status] ?? 'default';
                  return (
                    <tr
                      key={tu.userId}
                      className="hover:bg-bg-main transition-colors"
                      style={{
                        borderBottom:
                          i < tenantUsers.length - 1 ? '1px solid var(--border-light)' : 'none',
                      }}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="brand-gradient flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold text-white">
                            {initials}
                          </div>
                          <div>
                            <div
                              className="text-sm font-semibold"
                              style={{ color: 'var(--text-primary)' }}
                            >
                              {tu.user.email.split('@')[0]}
                            </div>
                            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                              {tu.user.email}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <Badge variant={roleColors[primaryRole] ?? 'default'}>{primaryRole}</Badge>
                      </td>
                      <td className="px-6 py-4">
                        <Badge variant={statusVariant} dot>
                          {statusLabel}
                        </Badge>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                          {tu.status === 'INVITED' ? '—' : formatDate(tu.joinedAt)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            className="hover:bg-bg-subtle rounded-lg border px-2.5 py-1.5 text-xs transition-colors"
                            style={{
                              borderColor: 'var(--border-light)',
                              color: 'var(--text-secondary)',
                            }}
                          >
                            Edit role
                          </button>
                          {tu.status !== 'SUSPENDED' ? (
                            <button className="rounded-lg border border-red-100 bg-red-50 px-2.5 py-1.5 text-xs text-red-600 transition-colors hover:bg-red-100">
                              Remove
                            </button>
                          ) : (
                            <button
                              className="hover:bg-bg-subtle rounded-lg border px-2.5 py-1.5 text-xs transition-colors"
                              style={{
                                borderColor: 'var(--border-light)',
                                color: 'var(--text-secondary)',
                              }}
                            >
                              Reinstate
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div
          className="flex items-center justify-between border-t px-6 py-4"
          style={{ borderColor: 'var(--border-light)' }}
        >
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Showing {tenantUsers.length} member{tenantUsers.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* SCIM status */}
      <div
        className="flex items-center gap-4 rounded-2xl border p-5"
        style={{
          background: 'var(--bg-white)',
          borderColor: 'var(--border-light)',
          boxShadow: 'var(--shadow-card)',
        }}
      >
        <div
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl text-xl"
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
            className="hover:bg-bg-subtle rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors"
            style={{ borderColor: 'var(--border-light)', color: 'var(--text-secondary)' }}
          >
            Configure
          </a>
        </div>
      </div>
    </div>
  );
}
