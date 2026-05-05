import { auth } from '@platform/auth';
import { adminDb } from '@platform/db';
import { resolveTenant } from '@platform/tenant';
import { redirect } from 'next/navigation';

import { formatDate } from '@/lib/time';
import { ManageSubscriptionButton, UpgradePlanButton } from '@/components/billing/billing-buttons';
import { Topbar } from '@/components/layout/topbar';
import { Badge } from '@/components/ui/badge';

export const metadata = { title: 'Billing' };

interface BillingPageProps {
  searchParams: Promise<{ checkout?: string }>;
}

export default async function BillingPage({ searchParams }: BillingPageProps) {
  const session = await auth();
  if (!session) redirect('/auth/signin');

  const { checkout } = await searchParams;

  const slug = process.env.NEXT_PUBLIC_DEFAULT_TENANT_SLUG ?? 'acme';
  const tenantCtx = await resolveTenant(slug);
  if (!tenantCtx) redirect('/');

  const { tenantId } = tenantCtx;

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const [subscription, plans, activeMembers, totalMembers, apiRequestsAgg, webhookDeliveries] =
    await Promise.all([
      adminDb.subscription.findUnique({
        where: { tenantId },
        include: { plan: true },
      }),
      adminDb.plan.findMany({ orderBy: { code: 'asc' } }),
      adminDb.tenantUser.count({ where: { tenantId, status: 'ACTIVE' } }),
      adminDb.tenantUser.count({ where: { tenantId } }),
      adminDb.usageEvent.aggregate({
        where: { tenantId, kind: 'api_request', occurredAt: { gte: startOfMonth } },
        _sum: { quantity: true },
      }),
      adminDb.webhookDelivery.count({
        where: {
          endpoint: { tenantId },
          status: 'SUCCESS',
          createdAt: { gte: startOfMonth },
        },
      }),
    ]);

  // Plan data
  const currentPlanId = subscription?.planId;
  const planFeatures = (subscription?.plan.features ?? {}) as Record<string, unknown>;
  const seatLimit =
    typeof planFeatures.maxSeats === 'number' ? (planFeatures.maxSeats as number) : null;
  const seatPct = seatLimit ? Math.round((totalMembers / seatLimit) * 100) : 0;

  const periodEnd = subscription?.currentPeriodEnd;
  const subStatus = subscription?.status ?? 'NONE';

  const apiRequestsThisMonth = apiRequestsAgg._sum.quantity ?? 0;
  const apiLimit =
    typeof planFeatures.maxApiRequests === 'number'
      ? (planFeatures.maxApiRequests as number)
      : 500000;

  const usageItems = [
    {
      label: 'API Requests',
      used: apiRequestsThisMonth,
      limit: apiLimit,
      format: (v: number) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)),
    },
    {
      label: 'Team Members',
      used: totalMembers,
      limit: seatLimit ?? totalMembers,
      format: (v: number) => String(v),
    },
    {
      label: 'Webhooks Delivered',
      used: webhookDeliveries,
      limit:
        typeof planFeatures.maxWebhooks === 'number' ? (planFeatures.maxWebhooks as number) : 5000,
      format: (v: number) => v.toLocaleString(),
    },
  ];

  const statusVariant =
    subStatus === 'ACTIVE'
      ? 'success'
      : subStatus === 'TRIALING'
        ? 'blue'
        : subStatus === 'PAST_DUE'
          ? 'error'
          : 'gray';

  return (
    <div>
      <Topbar
        title="Billing"
        subtitle="Manage your subscription, plan, and invoices"
        userEmail={session.user.email}
        userName={session.user.name ?? undefined}
      />

      <main className="space-y-6 p-6">
        {/* Checkout result banner */}
        {checkout === 'success' && (
          <div
            className="flex items-center gap-3 rounded-xl border px-5 py-4"
            style={{ background: 'rgba(22,163,74,0.06)', borderColor: 'rgba(22,163,74,0.25)' }}
          >
            <svg
              viewBox="0 0 20 20"
              fill="currentColor"
              className="h-5 w-5 flex-shrink-0"
              style={{ color: 'var(--status-success)' }}
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16zm3.707-9.293a1 1 0 0 0-1.414-1.414L9 10.586 7.707 9.293a1 1 0 0 0-1.414 1.414l2 2a1 1 0 0 0 1.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--status-success)' }}>
                Subscription activated!
              </p>
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                Your plan has been updated. Changes are reflected immediately.
              </p>
            </div>
          </div>
        )}
        {checkout === 'cancelled' && (
          <div
            className="flex items-center gap-3 rounded-xl border px-5 py-4"
            style={{ background: 'rgba(245,158,11,0.06)', borderColor: 'rgba(245,158,11,0.25)' }}
          >
            <svg
              viewBox="0 0 20 20"
              fill="currentColor"
              className="h-5 w-5 flex-shrink-0"
              style={{ color: 'var(--status-warning)' }}
            >
              <path
                fillRule="evenodd"
                d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 6a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 10 6zm0 9a1 1 0 1 0 0-2 1 1 0 0 0 0 2z"
                clipRule="evenodd"
              />
            </svg>
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--status-warning)' }}>
                Checkout cancelled
              </p>
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                No changes were made to your subscription.
              </p>
            </div>
          </div>
        )}

        {/* Current plan summary */}
        <div
          className="relative overflow-hidden rounded-xl border p-6"
          style={{
            background: 'var(--bg-white)',
            borderColor: 'var(--border-light)',
            boxShadow: 'var(--shadow-card)',
          }}
        >
          <div
            className="pointer-events-none absolute right-0 top-0 h-48 w-48 rounded-full opacity-20 blur-3xl"
            style={{ background: 'var(--glow-purple)', transform: 'translate(30%, -30%)' }}
          />
          <div className="relative flex flex-col gap-6 md:flex-row md:items-center">
            <div className="flex-1">
              <div className="mb-2 flex items-center gap-2">
                <h2 className="text-lg font-extrabold" style={{ color: 'var(--text-primary)' }}>
                  {subscription?.plan.name ?? tenantCtx.plan ?? 'Free'} Plan
                </h2>
                {subscription ? (
                  <Badge variant={statusVariant} dot>
                    {subStatus.charAt(0) + subStatus.slice(1).toLowerCase().replace('_', ' ')}
                  </Badge>
                ) : (
                  <Badge variant="gray">No subscription</Badge>
                )}
              </div>
              {periodEnd && (
                <p className="mb-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
                  Your subscription renews on <strong>{formatDate(periodEnd)}</strong>.
                </p>
              )}
              {!subscription && (
                <p className="mb-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
                  You are currently on the free plan. Upgrade to unlock more features.
                </p>
              )}
              <div className="flex flex-wrap gap-4">
                {seatLimit !== null && (
                  <div>
                    <div
                      className="mb-1 text-xs font-semibold uppercase tracking-wide"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      Seats used
                    </div>
                    <div
                      className="text-2xl font-extrabold"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      {totalMembers}{' '}
                      <span
                        className="text-base font-normal"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        / {seatLimit}
                      </span>
                    </div>
                    <div
                      className="mt-1.5 h-1.5 w-36 overflow-hidden rounded-full"
                      style={{ background: 'var(--border-light)' }}
                    >
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${String(Math.min(seatPct, 100))}%`,
                          background:
                            seatPct > 85 ? 'var(--status-warning)' : 'var(--brand-primary)',
                        }}
                      />
                    </div>
                  </div>
                )}
                {seatLimit === null && (
                  <div>
                    <div
                      className="mb-1 text-xs font-semibold uppercase tracking-wide"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      Members
                    </div>
                    <div
                      className="text-2xl font-extrabold"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      {totalMembers}
                      <span
                        className="ml-1 text-sm font-normal"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        ({activeMembers} active)
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
            {subscription && (
              <div className="flex flex-col gap-2">
                <ManageSubscriptionButton className="brand-gradient w-full rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50" />
                <ManageSubscriptionButton
                  label="Update payment method"
                  className="hover:bg-bg-subtle w-full rounded-xl border px-5 py-2.5 text-sm font-semibold transition-colors disabled:opacity-50"
                  style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}
                />
              </div>
            )}
          </div>
        </div>

        {/* Plan comparison */}
        {plans.length > 0 && (
          <div>
            <h2 className="mb-4 text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
              Available Plans
            </h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {plans.map((plan) => {
                const isCurrent = plan.id === currentPlanId;
                const pf = (plan.features ?? {}) as Record<string, unknown>;
                const featureList = Array.isArray(pf.features) ? (pf.features as string[]) : [];
                const priceDisplay = typeof pf.price === 'string' ? (pf.price as string) : '—';
                const periodDisplay = typeof pf.period === 'string' ? (pf.period as string) : '';
                return (
                  <div
                    key={plan.id}
                    className={`flex flex-col rounded-xl border p-5 ${isCurrent ? 'ring-2' : ''}`}
                    style={{
                      background: isCurrent ? 'var(--bg-subtle)' : 'var(--bg-white)',
                      borderColor: isCurrent ? 'var(--brand-primary)' : 'var(--border-light)',
                      boxShadow: isCurrent ? 'var(--shadow-brand)' : 'var(--shadow-card)',
                    }}
                  >
                    <div className="mb-3 flex items-center justify-between">
                      <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                        {plan.name}
                      </span>
                      {isCurrent && <Badge variant="blue">Current</Badge>}
                    </div>
                    <div className="mb-4 flex items-end gap-1">
                      <span
                        className="text-2xl font-extrabold"
                        style={{ color: 'var(--text-primary)' }}
                      >
                        {priceDisplay}
                      </span>
                      {periodDisplay && (
                        <span className="mb-0.5 text-sm" style={{ color: 'var(--text-muted)' }}>
                          {periodDisplay}
                        </span>
                      )}
                    </div>
                    {featureList.length > 0 && (
                      <ul className="mb-4 flex-1 space-y-2">
                        {featureList.map((f) => (
                          <li
                            key={f}
                            className="flex items-center gap-2 text-xs"
                            style={{ color: 'var(--text-secondary)' }}
                          >
                            <svg
                              className="h-3.5 w-3.5 flex-shrink-0"
                              viewBox="0 0 16 16"
                              fill="none"
                            >
                              <circle
                                cx="8"
                                cy="8"
                                r="8"
                                fill="var(--brand-primary)"
                                opacity="0.1"
                              />
                              <path
                                d="M5 8l2 2 4-4"
                                stroke="var(--brand-primary)"
                                strokeWidth="1.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                            {f}
                          </li>
                        ))}
                      </ul>
                    )}
                    <div className="mt-auto">
                      {isCurrent ? (
                        <button
                          disabled
                          className="w-full cursor-default rounded-xl py-2 text-xs font-semibold opacity-50"
                          style={{
                            background: 'var(--border-default)',
                            color: 'var(--text-muted)',
                          }}
                        >
                          Current plan
                        </button>
                      ) : plan.code === 'enterprise' ? (
                        <a
                          href="mailto:sales@riogentix.io"
                          className="block w-full rounded-xl py-2 text-center text-xs font-semibold hover:opacity-90"
                          style={{ background: 'var(--brand-primary)', color: '#fff' }}
                        >
                          Contact sales
                        </a>
                      ) : (
                        <UpgradePlanButton
                          planCode={plan.code}
                          label={`Upgrade to ${plan.name}`}
                          className="w-full rounded-xl py-2 text-xs font-semibold hover:opacity-90 disabled:opacity-50"
                          style={{ background: 'var(--brand-primary)', color: '#fff' }}
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Usage this month */}
        <div
          className="rounded-xl border p-6"
          style={{
            background: 'var(--bg-white)',
            borderColor: 'var(--border-light)',
            boxShadow: 'var(--shadow-card)',
          }}
        >
          <h2 className="mb-4 text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
            Usage This Month
          </h2>
          <div className="space-y-4">
            {usageItems.map((item) => {
              const pct =
                item.limit > 0 ? Math.min(Math.round((item.used / item.limit) * 100), 100) : 0;
              return (
                <div key={item.label}>
                  <div className="mb-1.5 flex items-center justify-between">
                    <span
                      className="text-xs font-semibold"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      {item.label}
                    </span>
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {item.format(item.used)} / {item.format(item.limit)}
                    </span>
                  </div>
                  <div
                    className="h-2 overflow-hidden rounded-full"
                    style={{ background: 'var(--border-light)' }}
                  >
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${String(pct)}%`,
                        background: pct > 85 ? 'var(--status-warning)' : 'var(--brand-primary)',
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Invoice history placeholder */}
        <div
          className="rounded-xl border p-6"
          style={{
            background: 'var(--bg-white)',
            borderColor: 'var(--border-light)',
            boxShadow: 'var(--shadow-card)',
          }}
        >
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
              Invoice History
            </h2>
          </div>
          <div
            className="mt-4 flex items-center gap-3 rounded-xl p-4"
            style={{ background: 'var(--bg-subtle)' }}
          >
            <svg
              viewBox="0 0 20 20"
              fill="currentColor"
              className="h-5 w-5 flex-shrink-0"
              style={{ color: 'var(--brand-secondary)' }}
            >
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0zm-7-4a1 1 0 1 1-2 0 1 1 0 0 1 2 0zM9 9a1 1 0 0 0 0 2v3a1 1 0 0 0 1 1h1a1 1 0 1 0 0-2v-3a1 1 0 0 0-1-1H9z"
                clipRule="evenodd"
              />
            </svg>
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              Invoice history is managed through Stripe. Click <strong>Manage subscription</strong>{' '}
              above to view and download your invoices.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
