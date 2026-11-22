import { auth } from '@platform/auth';
import { adminDb } from '@platform/db';
import { redirect } from 'next/navigation';

import { formatMoney, getPlanPrices } from '@/lib/plan-prices';

export const metadata = { title: 'Revenue Analytics — Admin' };

function isPlatformAdmin(session: { groups?: unknown }): boolean {
  return (
    Array.isArray(session.groups) &&
    (session.groups as string[]).some((g) =>
      ['platform_super_admin', 'platform_support'].includes(g),
    )
  );
}

export default async function AdminRevenuePage() {
  const session = await auth();
  if (!session) redirect('/auth/signin');
  if (!isPlatformAdmin(session)) redirect('/dashboard');

  // Pull all subscriptions + tenants
  const [subscriptions, tenants, planPrices] = await Promise.all([
    adminDb.subscription.findMany({
      where: { status: { in: ['ACTIVE', 'TRIALING', 'PAST_DUE'] } },
      include: {
        tenant: { select: { name: true, slug: true } },
        plan: { select: { code: true, name: true } },
      },
      orderBy: { updatedAt: 'desc' },
    }),
    adminDb.tenant.findMany({
      where: { status: { not: 'DELETED' } },
      select: { id: true, plan: true, status: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    }),
    getPlanPrices(),
  ]);

  // Plan distribution
  const planCounts: Record<string, number> = {};
  for (const t of tenants) {
    planCounts[t.plan] = (planCounts[t.plan] ?? 0) + 1;
  }

  // MRR: only subscriptions Stripe actually bills (has a Stripe subscription,
  // is ACTIVE, on a plan whose Stripe price we could read). Trialing and
  // past-due subscriptions are listed below but don't count as revenue.
  const { stripeConfigured, prices } = planPrices;
  const paidSubs = subscriptions.filter(
    (s) => s.status === 'ACTIVE' && s.stripeSubscriptionId && s.plan.code !== 'free',
  );
  const mrr = paidSubs.reduce((sum, s) => sum + (prices[s.plan.code]?.monthly ?? 0), 0);
  const unpricedPaid = paidSubs.filter((s) => !prices[s.plan.code]).length;
  const currency = Object.values(prices)[0]?.currency ?? 'USD';
  const money = (n: number) => formatMoney(n, currency);

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
    if (month in monthlyNew) monthlyNew[month] = (monthlyNew[month] ?? 0) + 1;
  }

  const maxNew = Math.max(...Object.values(monthlyNew), 1);

  // Totals
  const totalTenants = tenants.length;
  const activePaid = paidSubs.length;
  const mrrSub = !stripeConfigured
    ? 'Stripe not connected'
    : unpricedPaid > 0
      ? `${String(unpricedPaid)} paid subscription(s) on a plan with no Stripe price`
      : 'From Stripe prices × active paid subscriptions';
  const statCards = [
    { label: 'MRR', value: stripeConfigured ? money(mrr) : '—', sub: mrrSub },
    {
      label: 'ARR (est.)',
      value: stripeConfigured ? money(mrr * 12) : '—',
      sub: 'Annualised run rate',
    },
    { label: 'Paid tenants', value: String(activePaid), sub: 'Active Stripe subscriptions' },
    { label: 'Total workspaces', value: String(totalTenants), sub: 'Excluding deleted' },
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
        {!stripeConfigured && (
          <div
            className="rounded-lg border px-4 py-3 text-xs"
            style={{ borderColor: 'var(--border-light)', color: 'var(--text-secondary)' }}
          >
            Stripe isn&apos;t connected, so there&apos;s no revenue to report yet.{' '}
            <a
              href="/admin/billing"
              className="font-semibold hover:underline"
              style={{ color: 'var(--brand-primary)' }}
            >
              Connect Stripe →
            </a>
          </div>
        )}

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
              Subscriptions
            </h2>
          </div>
          {subscriptions.length === 0 ? (
            <div className="px-6 py-8 text-center">
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                No subscriptions yet.
              </p>
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: 'var(--border-light)' }}>
              {subscriptions.slice(0, 20).map((sub) => (
                <div key={sub.tenantId} className="flex items-center justify-between px-6 py-3">
                  <div>
                    <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                      {sub.tenant.name}
                    </div>
                    <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {sub.plan.name} · /{sub.tenant.slug} · Renews:{' '}
                      {sub.currentPeriodEnd ? sub.currentPeriodEnd.toLocaleDateString() : 'N/A'}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                      {prices[sub.plan.code]
                        ? `${money(prices[sub.plan.code]?.monthly ?? 0)}/mo`
                        : sub.plan.code === 'free'
                          ? 'Free'
                          : 'No price'}
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
