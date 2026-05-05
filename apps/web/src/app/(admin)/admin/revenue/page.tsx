import { auth } from '@platform/auth';
import { adminDb } from '@platform/db';
import { redirect } from 'next/navigation';

export const metadata = { title: 'Revenue Analytics — Admin' };

function isPlatformAdmin(session: { groups?: unknown }): boolean {
  return (
    Array.isArray(session.groups) &&
    (session.groups as string[]).some((g) =>
      ['platform_super_admin', 'platform_support'].includes(g),
    )
  );
}

const PLAN_MRR: Record<string, number> = {
  free: 0,
  pro: 49,
  enterprise: 999,
};

export default async function AdminRevenuePage() {
  const session = await auth();
  if (!session) redirect('/auth/signin');
  if (!isPlatformAdmin(session)) redirect('/dashboard');

  // Pull all subscriptions + tenants
  const [subscriptions, tenants] = await Promise.all([
    adminDb.subscription.findMany({
      where: { status: 'ACTIVE' },
      include: { tenant: { select: { plan: true, createdAt: true } } },
    }),
    adminDb.tenant.findMany({
      where: { status: { not: 'DELETED' } },
      select: { id: true, plan: true, status: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    }),
  ]);

  // Plan distribution
  const planCounts: Record<string, number> = {};
  for (const t of tenants) {
    planCounts[t.plan] = (planCounts[t.plan] ?? 0) + 1;
  }

  // MRR from active subscriptions
  const mrr = subscriptions.reduce((sum, s) => sum + (PLAN_MRR[s.tenant.plan] ?? 0), 0);

  // New tenants per month (last 6 months)
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  sixMonthsAgo.setDate(1);

  const monthlyNew: Record<string, number> = {};
  const allMonths: string[] = [];
  const cur = new Date(sixMonthsAgo);
  while (cur <= new Date()) {
    allMonths.push(cur.toISOString().slice(0, 7));
    cur.setMonth(cur.getMonth() + 1);
  }
  for (const month of allMonths) monthlyNew[month] = 0;
  for (const t of tenants) {
    const month = t.createdAt.toISOString().slice(0, 7);
    if (month in monthlyNew) monthlyNew[month]! += 1;
  }

  const maxNew = Math.max(...Object.values(monthlyNew), 1);

  // Totals
  const totalTenants = tenants.length;
  const activePaid = subscriptions.length;

  const statCards = [
    { label: 'MRR', value: `$${mrr.toLocaleString()}`, sub: 'Monthly recurring revenue' },
    { label: 'ARR (est.)', value: `$${(mrr * 12).toLocaleString()}`, sub: 'Annualised run rate' },
    { label: 'Paid tenants', value: String(activePaid), sub: 'Active subscriptions' },
    { label: 'Total workspaces', value: String(totalTenants), sub: 'All statuses' },
  ];

  return (
    <div>
      {/* Topbar */}
      <div
        className="border-b px-6 py-4"
        style={{ background: 'var(--bg-white)', borderColor: 'var(--border-light)' }}
      >
        <h1 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>
          Revenue Analytics
        </h1>
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          MRR, plan distribution, and growth · platform admin only
        </p>
      </div>

      <main className="space-y-6 p-6">
        {/* Stat cards */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {statCards.map((card) => (
            <div
              key={card.label}
              className="rounded-xl border p-5"
              style={{
                background: 'var(--bg-white)',
                borderColor: 'var(--border-light)',
                boxShadow: 'var(--shadow-card)',
              }}
            >
              <div
                className="mb-1 text-xs font-semibold uppercase tracking-wide"
                style={{ color: 'var(--text-muted)' }}
              >
                {card.label}
              </div>
              <div className="text-2xl font-extrabold" style={{ color: 'var(--text-primary)' }}>
                {card.value}
              </div>
              <div className="mt-0.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                {card.sub}
              </div>
            </div>
          ))}
        </div>

        {/* New tenants chart */}
        <div
          className="rounded-xl border p-6"
          style={{
            background: 'var(--bg-white)',
            borderColor: 'var(--border-light)',
            boxShadow: 'var(--shadow-card)',
          }}
        >
          <h2 className="mb-5 text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
            New workspaces per month
          </h2>
          <div className="flex items-end gap-3">
            {allMonths.map((month) => {
              const count = monthlyNew[month] ?? 0;
              const pct = maxNew > 0 ? (count / maxNew) * 100 : 0;
              return (
                <div key={month} className="flex flex-1 flex-col items-center gap-1.5">
                  <div
                    className="w-full text-center text-xs font-semibold"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {count > 0 ? count : ''}
                  </div>
                  <div
                    className="relative w-full overflow-hidden rounded-t-md"
                    style={{ height: 120 }}
                  >
                    <div
                      className="absolute bottom-0 w-full rounded-t-md transition-all"
                      style={{
                        height: `${String(Math.max(pct, 2))}%`,
                        background: count > 0 ? 'var(--brand-primary)' : 'var(--border-light)',
                        opacity: count > 0 ? 1 : 0.5,
                      }}
                    />
                  </div>
                  <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {month.slice(5)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Plan distribution */}
        <div
          className="rounded-xl border p-6"
          style={{
            background: 'var(--bg-white)',
            borderColor: 'var(--border-light)',
            boxShadow: 'var(--shadow-card)',
          }}
        >
          <h2 className="mb-4 text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
            Plan distribution
          </h2>
          <div className="space-y-3">
            {['free', 'pro', 'enterprise'].map((plan) => {
              const count = planCounts[plan] ?? 0;
              const pct = totalTenants > 0 ? (count / totalTenants) * 100 : 0;
              const barColor =
                plan === 'enterprise'
                  ? '#B06CFF'
                  : plan === 'pro'
                    ? 'var(--brand-primary)'
                    : 'var(--border-default)';
              return (
                <div key={plan}>
                  <div className="mb-1 flex items-center justify-between">
                    <span
                      className="text-sm font-semibold capitalize"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      {plan}
                    </span>
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {count} ({pct.toFixed(0)}%)
                    </span>
                  </div>
                  <div
                    className="h-2.5 overflow-hidden rounded-full"
                    style={{ background: 'var(--border-light)' }}
                  >
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${String(pct)}%`, background: barColor }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Recent subscriptions */}
        <div
          className="rounded-xl border"
          style={{
            background: 'var(--bg-white)',
            borderColor: 'var(--border-light)',
            boxShadow: 'var(--shadow-card)',
          }}
        >
          <div className="border-b px-6 py-4" style={{ borderColor: 'var(--border-light)' }}>
            <h2 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
              Active subscriptions
            </h2>
          </div>
          {subscriptions.length === 0 ? (
            <div className="px-6 py-8 text-center">
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                No active subscriptions yet.
              </p>
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: 'var(--border-light)' }}>
              {subscriptions.slice(0, 20).map((sub) => (
                <div key={sub.tenantId} className="flex items-center justify-between px-6 py-3">
                  <div>
                    <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                      {sub.tenantId}
                    </div>
                    <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      Plan: {sub.tenant.plan} · Renews:{' '}
                      {sub.currentPeriodEnd ? sub.currentPeriodEnd.toLocaleDateString() : 'N/A'}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                      ${PLAN_MRR[sub.tenant.plan] ?? 0}/mo
                    </div>
                    <div
                      className="text-xs"
                      style={{
                        color:
                          sub.status === 'ACTIVE' ? 'var(--status-success)' : 'var(--text-muted)',
                      }}
                    >
                      {sub.status}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
