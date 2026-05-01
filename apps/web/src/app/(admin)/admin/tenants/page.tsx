import { auth } from '@platform/auth';
import { redirect } from 'next/navigation';

import { Topbar } from '@/components/layout/topbar';
import { Badge } from '@/components/ui/badge';

export const metadata = { title: 'Tenants — Admin' };

const tenants = [
  {
    name: 'Acme Corp',
    slug: 'acme',
    plan: 'Pro',
    users: 43,
    status: 'Active',
    mrr: '$49',
    domain: 'app.acme.com',
    created: 'Jan 10, 2025',
    lastActivity: '2 min ago',
  },
  {
    name: 'Globex Inc',
    slug: 'globex',
    plan: 'Enterprise',
    users: 312,
    status: 'Active',
    mrr: '$499',
    domain: 'app.globex.com',
    created: 'Jan 12, 2025',
    lastActivity: '1 hr ago',
  },
  {
    name: 'Initech LLC',
    slug: 'initech',
    plan: 'Free',
    users: 3,
    status: 'Active',
    mrr: '$0',
    domain: '—',
    created: 'Mar 5, 2025',
    lastActivity: '3 days ago',
  },
  {
    name: 'Umbrella Corp',
    slug: 'umbrella',
    plan: 'Pro',
    users: 28,
    status: 'Suspended',
    mrr: '$0',
    domain: '—',
    created: 'Feb 20, 2025',
    lastActivity: '2 weeks ago',
  },
  {
    name: 'Stark Industries',
    slug: 'stark',
    plan: 'Enterprise',
    users: 891,
    status: 'Active',
    mrr: '$999',
    domain: 'platform.stark.io',
    created: 'Dec 1, 2024',
    lastActivity: '5 min ago',
  },
  {
    name: 'Wayne Enterprises',
    slug: 'wayne',
    plan: 'Pro',
    users: 67,
    status: 'Active',
    mrr: '$49',
    domain: '—',
    created: 'Nov 15, 2024',
    lastActivity: '1 hr ago',
  },
];

const planColors: Record<string, 'purple' | 'blue' | 'gray'> = {
  Enterprise: 'purple',
  Pro: 'blue',
  Free: 'gray',
};

export default async function AdminTenantsPage() {
  const session = await auth();
  if (!session) redirect('/auth/signin');

  return (
    <div>
      <Topbar
        title="Tenants"
        subtitle="All workspaces across the platform"
        userEmail={session.user.email}
        userName={session.user.name}
        actions={
          <button className="brand-gradient rounded-xl px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90">
            + Create tenant
          </button>
        }
      />

      <main className="space-y-6 p-6">
        {/* Filters */}
        <div
          className="flex flex-wrap items-center gap-3 rounded-2xl border p-4"
          style={{
            background: 'var(--bg-white)',
            borderColor: 'var(--border-light)',
            boxShadow: 'var(--shadow-card)',
          }}
        >
          <div className="relative min-w-48 flex-1">
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
              placeholder="Search tenants by name, slug, or domain..."
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
            <option>All plans</option>
            <option>Free</option>
            <option>Pro</option>
            <option>Enterprise</option>
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
            <option>Suspended</option>
            <option>Deleted</option>
          </select>
          <select
            className="rounded-xl border px-3 py-2 text-sm outline-none"
            style={{
              borderColor: 'var(--border-light)',
              background: 'var(--bg-main)',
              color: 'var(--text-secondary)',
            }}
          >
            <option>Sort: Created desc</option>
            <option>Sort: MRR desc</option>
            <option>Sort: Users desc</option>
            <option>Sort: Last activity</option>
          </select>
        </div>

        {/* Table */}
        <div
          className="overflow-hidden rounded-2xl border"
          style={{
            background: 'var(--bg-white)',
            borderColor: 'var(--border-light)',
            boxShadow: 'var(--shadow-card)',
          }}
        >
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-light)' }}>
                {[
                  'Tenant',
                  'Plan',
                  'Users',
                  'MRR',
                  'Custom Domain',
                  'Status',
                  'Created',
                  'Last activity',
                  '',
                ].map((col) => (
                  <th
                    key={col}
                    className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tenants.map((t, i) => (
                <tr
                  key={t.slug}
                  className="hover:bg-bg-main transition-colors"
                  style={{
                    borderBottom: i < tenants.length - 1 ? '1px solid var(--border-light)' : 'none',
                  }}
                >
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2.5">
                      <div className="brand-gradient flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl text-xs font-bold text-white">
                        {t.name[0]}
                      </div>
                      <div>
                        <div
                          className="text-sm font-semibold"
                          style={{ color: 'var(--text-primary)' }}
                        >
                          {t.name}
                        </div>
                        <code className="text-xs" style={{ color: 'var(--text-muted)' }}>
                          {t.slug}
                        </code>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <Badge variant={planColors[t.plan] ?? 'gray'}>{t.plan}</Badge>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {t.users}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <span
                      className="text-sm font-semibold"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      {t.mrr}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <span
                      className="font-mono text-xs"
                      style={{
                        color: t.domain !== '—' ? 'var(--brand-secondary)' : 'var(--text-muted)',
                      }}
                    >
                      {t.domain}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <Badge variant={t.status === 'Active' ? 'success' : 'error'} dot>
                      {t.status}
                    </Badge>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {t.created}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {t.lastActivity}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        className="hover:bg-bg-subtle rounded-lg border px-2 py-1 text-xs transition-colors"
                        style={{
                          borderColor: 'var(--border-light)',
                          color: 'var(--text-secondary)',
                        }}
                      >
                        View
                      </button>
                      {t.status === 'Active' ? (
                        <button className="rounded-lg border border-red-100 bg-red-50 px-2 py-1 text-xs text-red-600 transition-colors hover:bg-red-100">
                          Suspend
                        </button>
                      ) : (
                        <button
                          className="hover:bg-bg-subtle rounded-lg border px-2 py-1 text-xs transition-colors"
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

          <div
            className="flex items-center justify-between border-t px-6 py-4"
            style={{ borderColor: 'var(--border-light)' }}
          >
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Showing 6 of 124 tenants
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
      </main>
    </div>
  );
}
