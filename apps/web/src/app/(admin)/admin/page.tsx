import { auth } from '@platform/auth';
import { adminDb } from '@platform/db';
import { redirect } from 'next/navigation';

import { formatDate, timeAgo } from '@/lib/time';
import { Topbar } from '@/components/layout/topbar';
import { Badge } from '@/components/ui/badge';
import { StatCard } from '@/components/ui/stat-card';

export const metadata = { title: 'Platform Admin' };

const planColors: Record<string, 'purple' | 'blue' | 'gray'> = {
  Enterprise: 'purple',
  Pro: 'blue',
  Free: 'gray',
};

export default async function AdminPage() {
  const session = await auth();
  if (!session) redirect('/auth/signin');

  const [totalTenants, totalUsers, activeJobs, deadJobs, recentTenants, planDistribution] =
    await Promise.all([
      adminDb.tenant.count({ where: { status: { not: 'DELETED' } } }),
      adminDb.user.count({ where: { status: 'ACTIVE' } }),
      adminDb.job.count({ where: { status: { in: ['PENDING', 'RUNNING'] } } }),
      adminDb.job.count({ where: { status: 'DEAD' } }),
      adminDb.tenant.findMany({
        where: { status: { not: 'DELETED' } },
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: {
          _count: { select: { tenantUsers: true } },
          subscription: { include: { plan: { select: { name: true, code: true } } } },
          auditLogs: {
            orderBy: { occurredAt: 'desc' },
            take: 1,
            select: { occurredAt: true },
          },
        },
      }),
      // Get plan distribution: count tenants grouped by their plan field
      adminDb.tenant.groupBy({
        by: ['plan'],
        where: { status: { not: 'DELETED' } },
        _count: { id: true },
      }),
    ]);

  const planDist = planDistribution.map((row) => ({
    plan: row.plan,
    count: row._count.id,
    pct: totalTenants > 0 ? Math.round((row._count.id / totalTenants) * 100) : 0,
    color:
      row.plan === 'enterprise'
        ? 'var(--brand-accent)'
        : row.plan === 'pro'
          ? 'var(--brand-primary)'
          : 'var(--text-muted)',
  }));

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
            value={totalTenants.toLocaleString()}
            change="All active workspaces"
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
            value={totalUsers.toLocaleString()}
            change="Active accounts"
            positive={true}
            iconColor="rgba(79, 123, 255, 0.1)"
            icon={
              <svg viewBox="0 0 20 20" fill="var(--brand-primary)" className="h-5 w-5">
                <path d="M9 6a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM17 6a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 0 0-1.5-4.33A5 5 0 0 1 19 16v1h-6.07zM6 11a5 5 0 0 1 5 5v1H1v-1a5 5 0 0 1 5-5z" />
              </svg>
            }
          />
          <StatCard
            label="Active Jobs"
            value={activeJobs.toLocaleString()}
            change={`DLQ: ${String(deadJobs)}`}
            positive={deadJobs === 0}
            iconColor="rgba(22, 163, 74, 0.1)"
            icon={
              <svg viewBox="0 0 20 20" fill="#16A34A" className="h-5 w-5">
                <path
                  fillRule="evenodd"
                  d="M11.3 1.046A1 1 0 0 1 12 2v5h4a1 1 0 0 1 .82 1.573l-7 10A1 1 0 0 1 8 18v-5H4a1 1 0 0 1-.82-1.573l7-10a1 1 0 0 1 1.12-.38z"
                  clipRule="evenodd"
                />
              </svg>
            }
          />
          <StatCard
            label="Paid Plans"
            value={String(
              planDistribution
                .filter((p) => p.plan !== 'free')
                .reduce((s, p) => s + p._count.id, 0),
            )}
            change={`${String(totalTenants)} total tenants`}
            positive={true}
            iconColor="rgba(176, 108, 255, 0.1)"
            icon={
              <svg viewBox="0 0 20 20" fill="var(--brand-accent)" className="h-5 w-5">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16zm1-13a1 1 0 1 0-2 0v.092a4.535 4.535 0 0 0-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 1 0-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 1 0 2 0v-.092a4.535 4.535 0 0 0 1.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0 0 11 9.092V7.151c.391.127.68.317.843.504a1 1 0 1 0 1.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z"
                  clipRule="evenodd"
                />
              </svg>
            }
          />
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          {/* Recent tenants table */}
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
            {recentTenants.length === 0 ? (
              <div className="px-6 py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
                No tenants yet.
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-light)' }}>
                    {['Tenant', 'Plan', 'Users', 'Status', 'Last Activity', ''].map((col) => (
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
                  {recentTenants.map((t, i) => {
                    const planName =
                      t.subscription?.plan.name ?? t.plan.charAt(0).toUpperCase() + t.plan.slice(1);
                    const lastActivity = t.auditLogs[0]?.occurredAt;
                    return (
                      <tr
                        key={t.id}
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
                                {t.slug}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-3.5">
                          <Badge variant={planColors[planName] ?? 'gray'}>{planName}</Badge>
                        </td>
                        <td className="px-6 py-3.5">
                          <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                            {t._count.tenantUsers}
                          </span>
                        </td>
                        <td className="px-6 py-3.5">
                          <Badge
                            variant={
                              t.status === 'ACTIVE'
                                ? 'success'
                                : t.status === 'SUSPENDED'
                                  ? 'error'
                                  : 'gray'
                            }
                            dot
                          >
                            {t.status.charAt(0) + t.status.slice(1).toLowerCase()}
                          </Badge>
                        </td>
                        <td className="px-6 py-3.5">
                          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                            {lastActivity ? timeAgo(lastActivity) : formatDate(t.createdAt)}
                          </span>
                        </td>
                        <td className="px-6 py-3.5">
                          <a
                            href="/admin/tenants"
                            className="text-xs font-semibold hover:underline"
                            style={{ color: 'var(--brand-primary)' }}
                          >
                            Manage
                          </a>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* System health — infra metrics, not from DB */}
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
                { service: 'Web (Next.js)', status: 'Healthy' },
                { service: 'Database (Postgres)', status: 'Healthy' },
                { service: 'Redis', status: 'Healthy' },
                { service: 'Keycloak (IAM)', status: 'Healthy' },
                { service: `Workers (BullMQ)`, status: deadJobs > 0 ? 'Degraded' : 'Healthy' },
              ].map((s) => (
                <div
                  key={s.service}
                  className="flex items-center justify-between border-b py-2 last:border-0"
                  style={{ borderColor: 'var(--border-light)' }}
                >
                  <div className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {s.service}
                  </div>
                  <Badge variant={s.status === 'Healthy' ? 'success' : 'warning'} dot>
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
        {planDist.length > 0 && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {planDist.map((p) => (
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
                    {p.plan.charAt(0).toUpperCase() + p.plan.slice(1)}
                  </span>
                  <span className="text-sm font-bold" style={{ color: p.color }}>
                    {p.count} tenant{p.count !== 1 ? 's' : ''}
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
        )}
      </main>
    </div>
  );
}
