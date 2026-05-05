import { auth } from '@platform/auth';
import { adminDb } from '@platform/db';
import { getVaultClient } from '@platform/vault';
import { redirect } from 'next/navigation';

import { Topbar } from '@/components/layout/topbar';
import { Badge } from '@/components/ui/badge';
import { StatCard } from '@/components/ui/stat-card';
import { AdminTenantsTable } from '@/components/admin/admin-tenants-table';

export const metadata = { title: 'Platform Admin' };

export default async function AdminPage() {
  const session = await auth();
  if (!session) redirect('/auth/signin');

  const vaultClient = getVaultClient();
  const vaultHealthy = await vaultClient.isHealthy();

  const [totalTenants, totalUsers, activeJobs, deadJobs, recentTenants, planDistribution] =
    await Promise.all([
      adminDb.tenant.count({ where: { status: { not: 'DELETED' } } }),
      adminDb.user.count({ where: { status: 'ACTIVE' } }),
      adminDb.job.count({ where: { status: { in: ['PENDING', 'RUNNING'] } } }),
      adminDb.job.count({ where: { status: 'DEAD' } }),
      adminDb.tenant.findMany({
        where: { status: { not: 'DELETED' } },
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: {
          _count: { select: { tenantUsers: true } },
          subscription: { include: { plan: { select: { name: true, code: true } } } },
          auditLogs: { orderBy: { occurredAt: 'desc' }, take: 1, select: { occurredAt: true } },
        },
      }),
      adminDb.tenant.groupBy({
        by: ['plan'],
        where: { status: { not: 'DELETED' } },
        _count: { id: true },
      }),
    ]);

  const [activeTenants, suspendedTenants] = await Promise.all([
    adminDb.tenant.count({ where: { status: 'ACTIVE' } }),
    adminDb.tenant.count({ where: { status: 'SUSPENDED' } }),
  ]);

  const paidTenants = planDistribution
    .filter((p) => p.plan !== 'free')
    .reduce((s, p) => s + p._count.id, 0);

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

  const tableData = recentTenants.map((t) => ({
    id: t.id,
    name: t.name,
    slug: t.slug,
    plan: t.subscription?.plan.name ?? t.plan.charAt(0).toUpperCase() + t.plan.slice(1),
    users: t._count.tenantUsers,
    status: t.status,
    createdAt: t.createdAt.toISOString(),
    lastActivity: t.auditLogs[0]?.occurredAt?.toISOString() ?? null,
    customDomains: t.customDomains,
  }));

  const systemServices = [
    { service: 'Web (Next.js)', status: 'Healthy' },
    { service: 'Database (Postgres)', status: 'Healthy' },
    { service: 'Redis', status: 'Healthy' },
    { service: 'Keycloak (IAM)', status: 'Healthy' },
    { service: 'Workers (BullMQ)', status: deadJobs > 0 ? 'Degraded' : 'Healthy' },
    { service: 'HashiCorp Vault', status: vaultHealthy ? 'Healthy' : 'Degraded' },
  ];

  const degradedCount = systemServices.filter((s) => s.status !== 'Healthy').length;

  return (
    <div>
      <Topbar
        title="Platform Overview"
        subtitle={`${String(totalTenants)} workspaces · ${String(totalUsers)} users`}
        userEmail={session.user.email}
        userName={session.user.name ?? undefined}
        actions={
          <Badge variant="purple" dot>
            Super Admin
          </Badge>
        }
      />

      <main className="space-y-5 p-6">
        {/* Admin warning banner */}
        <div
          className="flex items-center gap-3 rounded-lg px-4 py-3"
          style={{
            background: 'rgba(176, 108, 255, 0.07)',
            border: '1px solid rgba(176, 108, 255, 0.18)',
          }}
        >
          <svg viewBox="0 0 20 20" fill="var(--brand-accent)" className="h-4 w-4 flex-shrink-0">
            <path
              fillRule="evenodd"
              d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm-1-8a1 1 0 0 0-1 1v3a1 1 0 0 0 2 0V6a1 1 0 0 0-1-1z"
              clipRule="evenodd"
            />
          </svg>
          <p className="text-xs" style={{ color: 'var(--brand-accent)' }}>
            <strong>Platform admin mode</strong> — Elevated access. Actions bypass Row-Level
            Security and affect all tenants.
          </p>
        </div>

        {/* 6-metric stat row */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6">
          <StatCard
            label="Total Tenants"
            value={totalTenants.toLocaleString()}
            change="All workspaces"
            positive={true}
            iconColor="rgba(106, 109, 255, 0.1)"
            icon={
              <svg viewBox="0 0 20 20" fill="var(--brand-secondary)" className="h-5 w-5">
                <path d="M10.707 2.293a1 1 0 0 0-1.414 0l-7 7a1 1 0 0 0 1.414 1.414L4 10.414V17a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1v-2a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v2a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1v-6.586l.293.293a1 1 0 0 0 1.414-1.414l-7-7z" />
              </svg>
            }
          />
          <StatCard
            label="Active"
            value={activeTenants.toLocaleString()}
            change="Running workspaces"
            positive={true}
            iconColor="rgba(22, 163, 74, 0.1)"
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
            label="Suspended"
            value={suspendedTenants.toLocaleString()}
            change={suspendedTenants === 0 ? 'None suspended' : 'Needs attention'}
            positive={suspendedTenants === 0}
            iconColor="rgba(220, 38, 38, 0.08)"
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
            value={paidTenants.toLocaleString()}
            change={`of ${String(totalTenants)} tenants`}
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

        {/* Plan distribution + System health side by side */}
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
          {/* Plan distribution */}
          <div
            className="rounded-xl border p-5"
            style={{
              background: 'var(--bg-white)',
              borderColor: 'var(--border-light)',
              boxShadow: 'var(--shadow-card)',
            }}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                Plan Distribution
              </h2>
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {totalTenants} total
              </span>
            </div>
            {planDist.length === 0 ? (
              <p className="py-4 text-center text-xs" style={{ color: 'var(--text-muted)' }}>
                No data
              </p>
            ) : (
              <div className="space-y-4">
                {planDist.map((p) => (
                  <div key={p.plan}>
                    <div className="mb-1.5 flex items-center justify-between">
                      <span
                        className="text-xs font-semibold"
                        style={{ color: 'var(--text-primary)' }}
                      >
                        {p.plan.charAt(0).toUpperCase() + p.plan.slice(1)}
                      </span>
                      <span className="text-xs font-bold" style={{ color: p.color }}>
                        {p.count} · {p.pct}%
                      </span>
                    </div>
                    <div
                      className="h-2 overflow-hidden rounded-full"
                      style={{ background: 'var(--border-light)' }}
                    >
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${String(p.pct)}%`, background: p.color }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* System health */}
          <div
            className="rounded-xl border p-5 xl:col-span-2"
            style={{
              background: 'var(--bg-white)',
              borderColor: 'var(--border-light)',
              boxShadow: 'var(--shadow-card)',
            }}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                System Health
              </h2>
              {degradedCount === 0 ? (
                <Badge variant="success" dot>
                  All systems operational
                </Badge>
              ) : (
                <Badge variant="warning" dot>
                  {degradedCount} degraded
                </Badge>
              )}
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {systemServices.map((s) => (
                <div
                  key={s.service}
                  className="flex items-center justify-between rounded-lg border px-3 py-2.5"
                  style={{ borderColor: 'var(--border-light)', background: 'var(--bg-main)' }}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2 w-2 flex-shrink-0 rounded-full"
                      style={{
                        background:
                          s.status === 'Healthy'
                            ? 'var(--status-success)'
                  