import { auth } from '@platform/auth';
import { redirect } from 'next/navigation';

import { Topbar } from '@/components/layout/topbar';
import { Badge } from '@/components/ui/badge';
import { StatCard } from '@/components/ui/stat-card';

export const metadata = { title: 'Platform Admin' };

const recentTenants = [
  {
    name: 'Acme Corp',
    slug: 'acme',
    plan: 'Pro',
    users: 43,
    status: 'Active',
    mrr: '$49',
    created: 'Jan 10, 2025',
  },
  {
    name: 'Globex Inc',
    slug: 'globex',
    plan: 'Enterprise',
    users: 312,
    status: 'Active',
    mrr: '$499',
    created: 'Jan 12, 2025',
  },
  {
    name: 'Initech LLC',
    slug: 'initech',
    plan: 'Free',
    users: 3,
    status: 'Active',
    mrr: '$0',
    created: 'Mar 5, 2025',
  },
  {
    name: 'Umbrella Corp',
    slug: 'umbrella',
    plan: 'Pro',
    users: 28,
    status: 'Suspended',
    mrr: '$0',
    created: 'Feb 20, 2025',
  },
];

const planColors: Record<string, 'purple' | 'blue' | 'gray'> = {
  Enterprise: 'purple',
  Pro: 'blue',
  Free: 'gray',
};

export default async function AdminPage() {
  const session = await auth();
  if (!session) redirect('/auth/signin');

  return (
    <div>
      <Topbar
        title="Platform Admin"
        subtitle="Global overview across all tenants"
        userEmail={session.user.email}
        userName={session.user.name ?? undefined}
        actions={
          <Badge variant="purple" dot>
            Super Admin
          </Badge>
        }
      />

      <main className="space-y-6 p-6">
        {/* Warning banner */}
        <div
          className="flex items-center gap-3 rounded-xl p-4"
          style={{
            background: 'rgba(176, 108, 255, 0.08)',
            border: '1px solid rgba(176, 108, 255, 0.2)',
          }}
        >
          <svg viewBox="0 0 20 20" fill="var(--brand-accent)" className="h-5 w-5 flex-shrink-0">
            <path
              fillRule="evenodd"
              d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm-1-8a1 1 0 0 0-1 1v3a1 1 0 0 0 2 0V6a1 1 0 0 0-1-1z"
              clipRule="evenodd"
            />
          </svg>
          <p className="text-sm" style={{ color: 'var(--brand-accent)' }}>
            <strong>Platform admin mode</strong> — You have elevated access. Actions here affect all
            tenants and bypass RLS. Audit everything.
          </p>
        </div>

        {/* Global stats */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Total Tenants"
            value="124"
            change="8 this month"
            positive={true}
            iconColor="rgba(106, 109, 255, 0.1)"
            icon={
              <svg viewBox="0 0 20 20" fill="var(--brand-secondary)" className="h-5 w-5">
                <path d="M10.707 2.293a1 1 0 0 0-1.414 0l-7 7a1 1 0 0 0 1.414 1.414L4 10.414V17a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1v-2a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v2a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1v-6.586l.293.293a1 1 0 0 0 1.414-1.414l-7-7z" />
              </svg>
            }
          />
          <StatCard
            label="Total Users"
            value="12,847"
            change="934 this month"
            positive={true}
            iconColor="rgba(79, 123, 255, 0.1)"
            icon={
              <svg viewBox="0 0 20 20" fill="var(--brand-primary)" className="h-5 w-5">
                <path d="M9 6a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM17 6a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 0 0-1.5-4.33A5 5 0 0 1 19 16v1h-6.07zM6 11a5 5 0 0 1 5 5v1H1v-1a5 5 0 0 1 5-5z" />
              </svg>
            }
          />
          <StatCard
            label="Platform MRR"
            value="$28,450"
            change="18% this quarter"
            positive={true}
            iconColor="rgba(22, 163, 74, 0.1)"
            icon={
              <svg viewBox="0 0 20 20" fill="#16A34A" className="h-5 w-5">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16zm1-13a1 1 0 1 0-2 0v.092a4.535 4.535 0 0 0-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 1 0-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 1 0 2 0v-.092a4.535 4.535 0 0 0 1.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0 0 11 9.092V7.151c.391.127.68.317.843.504a1 1 0 1 0 1.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z"
                  clipRule="evenodd"
                />
              </svg>
            }
          />
          <StatCard
            label="Active Jobs (queue)"
            value="847"
            change="DLQ: 3"
            positive={false}
            iconColor="rgba(176, 108, 255, 0.1)"
            icon={
              <svg viewBox="0 0 20 20" fill="var(--brand-accent)" className="h-5 w-5">
                <path
                  fillRule="evenodd"
                  d="M11.3 1.046A1 1 0 0 1 12 2v5h4a1 1 0 0 1 .82 1.573l-7 10A1 1 0 0 1 8 18v-5H4a1 1 0 0 1-.82-1.573l7-10a1 1 0 0 1 1.12-.38z"
                  clipRule="evenodd"
                />
              </svg>
            }
          />
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          {/* Tenant table */}
          <div
            className="overflow-hidden rounded-2xl border xl:col-span-2"
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
              <h2 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                Recent Tenants
              </h2>
              <a
                href="/admin/tenants"
                className="text-xs font-semibold hover:underline"
                style={{ color: 'var(--brand-primary)' }}
              >
                View all →
              </a>
            </div>
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-light)' }}>
                  {['Tenant', 'Plan', 'Users', 'MRR', 'Status', ''].map((col) => (
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
                {recentTenants.map((t, i) => (
                  <tr
                    key={t.slug}
                    className="hover:bg-bg-main transition-colors"
                    style={{
                      borderBottom:
                        i < recentTenants.length - 1 ? '1px solid var(--border-light)' : 'none',
                    }}
                  >
                    <td className="px-6 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className="brand-gradient flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white">
                          {t.name[0]}
                        </div>
                        <div>
                          <div
                            className="text-sm font-semibold"
                            style={{ color: 'var(--text-primary)' }}
                          >
                            {t.name}
                          </div>
                          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                            {t.slug}.app
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-3.5">
                      <Badge variant={planColors[t.plan] ?? 'gray'}>{t.plan}</Badge>
                    </td>
                    <td className="px-6 py-3.5">
                      <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                        {t.users}
                      </span>
                    </td>
                    <td className="px-6 py-3.5">
                      <span
                        className="text-sm font-semibold"
                        style={{ color: 'var(--text-primary)' }}
                      >
                        {t.mrr}
                      </span>
                    </td>
                    <td className="px-6 py-3.5">
                      <Badge variant={t.status === 'Active' ? 'success' : 'error'} dot>
                        {t.status}
                      </Badge>
                    </td>
                    <td className="px-6 py-3.5">
                      <a
                        href={`/admin/tenants`}
                        className="text-xs font-semibold hover:underline"
                        style={{ color: 'var(--brand-primary)' }}
                      >
                        Manage
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* System health */}
          <div
            className="rounded-2xl border p-6"
            style={{
              background: 'var(--bg-white)',
              borderColor: 'var(--border-light)',
              boxShadow: 'var(--shadow-card)',
            }}
          >
            <h2 className="mb-4 text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
              System Health
            </h2>
            <div className="space-y-3">
              {[
                { service: 'Web (Next.js)', status: 'Healthy', latency: '43ms', uptime: '99.99%' },
                {
                  service: 'Database (Postgres)',
                  status: 'Healthy',
                  latency: '2ms',
                  uptime: '100%',
                },
                { service: 'Redis', status: 'Healthy', latency: '0.8ms', uptime: '100%' },
                { service: 'Keycloak (IAM)', status: 'Healthy', latency: '18ms', uptime: '99.97%' },
                { service: 'Workers (BullMQ)', status: 'Degraded', latency: '—', uptime: '—' },
                { service: 'Stripe Webhooks', status: 'Healthy', latency: '—', uptime: '99.9%' },
              ].map((s) => (
                <div
                  key={s.service}
                  className="flex items-center justify-between border-b py-2 last:border-0"
                  style={{ borderColor: 'var(--border-light)' }}
                >
                  <div>
                    <div className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
                      {s.service}
                    </div>
                    {s.latency !== '—' && (
                      <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        p50: {s.latency}
                      </div>
                    )}
                  </div>
                  <Badge
                    variant={
                      s.status === 'Healthy'
                        ? 'success'
                        : s.status === 'Degraded'
                          ? 'warning'
                          : 'error'
                    }
                    dot
                  >
                    {s.status}
                  </Badge>
                </div>
              ))}
            </div>
            <a
              href="/_health"
              className="mt-4 block text-center text-xs font-semibold hover:underline"
              style={{ color: 'var(--brand-primary)' }}
            >
              View full health report →
            </a>
          </div>
        </div>

        {/* Plan distribution */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {[
            { plan: 'Free', count: 89, pct: 72, color: 'var(--text-muted)' },
            { plan: 'Pro', count: 29, pct: 23, color: 'var(--brand-primary)' },
            { plan: 'Enterprise', count: 6, pct: 5, color: 'var(--brand-accent)' },
          ].map((p) => (
            <div
              key={p.plan}
              className="rounded-2xl border p-5"
              style={{
                background: 'var(--bg-white)',
                borderColor: 'var(--border-light)',
                boxShadow: 'var(--shadow-card)',
              }}
            >
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                  {p.plan}
                </span>
                <span className="text-sm font-bold" style={{ color: p.color }}>
                  {p.count} tenants
                </span>
              </div>
              <div
                className="h-2 overflow-hidden rounded-full"
                style={{ background: 'var(--border-light)' }}
              >
                <div
                  className="h-full rounded-full"
                  style={{ width: `${String(p.pct)}%`, background: p.color }}
                />
              </div>
              <div className="mt-1.5 text-right text-xs" style={{ color: 'var(--text-muted)' }}>
                {p.pct}%
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
