import { Badge } from '@/components/ui/badge';

export const metadata = { title: 'Team — Members' };

const members = [
  {
    name: 'Alice Kim',
    email: 'alice@acme.com',
    role: 'Admin',
    status: 'Active',
    joined: 'Jan 10, 2025',
    avatar: 'AK',
    lastSeen: '2 min ago',
  },
  {
    name: 'Bob Lee',
    email: 'bob@acme.com',
    role: 'Billing Admin',
    status: 'Active',
    joined: 'Jan 12, 2025',
    avatar: 'BL',
    lastSeen: '1 hr ago',
  },
  {
    name: 'Charlie Park',
    email: 'charlie@acme.com',
    role: 'Member',
    status: 'Active',
    joined: 'Feb 3, 2025',
    avatar: 'CP',
    lastSeen: '3 hr ago',
  },
  {
    name: 'Diana Wu',
    email: 'diana@acme.com',
    role: 'Viewer',
    status: 'Active',
    joined: 'Feb 14, 2025',
    avatar: 'DW',
    lastSeen: 'Yesterday',
  },
  {
    name: 'Eve Santos',
    email: 'eve@acme.com',
    role: 'Member',
    status: 'Invited',
    joined: '—',
    avatar: 'ES',
    lastSeen: '—',
  },
  {
    name: 'Frank Miller',
    email: 'frank@acme.com',
    role: 'Member',
    status: 'Suspended',
    joined: 'Mar 1, 2025',
    avatar: 'FM',
    lastSeen: '2 weeks ago',
  },
];

const roleColors: Record<string, 'purple' | 'blue' | 'default' | 'gray'> = {
  Admin: 'purple',
  'Billing Admin': 'blue',
  Member: 'default',
  Viewer: 'gray',
};

const statusColors: Record<string, 'success' | 'warning' | 'error'> = {
  Active: 'success',
  Invited: 'warning',
  Suspended: 'error',
};

export default function TeamMembersPage() {
  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        {[
          {
            label: 'Total Members',
            value: '43',
            sub: '7 seats remaining',
            color: 'var(--brand-primary)',
          },
          {
            label: 'Pending Invites',
            value: '1',
            sub: 'Awaiting acceptance',
            color: 'var(--status-warning)',
          },
          { label: 'Suspended', value: '1', sub: 'Access revoked', color: 'var(--status-error)' },
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

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-light)' }}>
                {['Member', 'Role', 'Status', 'Joined', 'Last seen', ''].map((col) => (
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
              {members.map((member, i) => (
                <tr
                  key={i}
                  className="hover:bg-bg-main transition-colors"
                  style={{
                    borderBottom: i < members.length - 1 ? '1px solid var(--border-light)' : 'none',
                  }}
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="brand-gradient flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold text-white">
                        {member.avatar}
                      </div>
                      <div>
                        <div
                          className="text-sm font-semibold"
                          style={{ color: 'var(--text-primary)' }}
                        >
                          {member.name}
                        </div>
                        <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                          {member.email}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <Badge variant={roleColors[member.role] ?? 'default'}>{member.role}</Badge>
                  </td>
                  <td className="px-6 py-4">
                    <Badge variant={statusColors[member.status] ?? 'default'} dot>
                      {member.status}
                    </Badge>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {member.joined}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
                      {member.lastSeen}
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
                      {member.status !== 'Suspended' ? (
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
              ))}
            </tbody>
          </table>
        </div>

        <div
          className="flex items-center justify-between border-t px-6 py-4"
          style={{ borderColor: 'var(--border-light)' }}
        >
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Showing 6 of 43 members
          </span>
          <div className="flex items-center gap-2">
            <button
              className="hover:bg-bg-subtle rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors"
              style={{ borderColor: 'var(--border-light)', color: 'var(--text-secondary)' }}
            >
              Previous
            </button>
            <button
              className="hover:bg-bg-subtle rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors"
              style={{ borderColor: 'var(--border-light)', color: 'var(--text-secondary)' }}
            >
              Next
            </button>
          </div>
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
          <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            Auto-sync from Okta · Last sync <strong>3 hours ago</strong> — 47 users updated
          </div>
        </div>
        <div className="flex flex-shrink-0 items-center gap-2">
          <Badge variant="success" dot>
            Connected
          </Badge>
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
