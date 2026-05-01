import { auth } from '@platform/auth';
import { redirect } from 'next/navigation';

import { ManageSubscriptionButton, UpgradePlanButton } from '@/components/billing/billing-buttons';
import { Topbar } from '@/components/layout/topbar';
import { Badge } from '@/components/ui/badge';

export const metadata = { title: 'Billing' };

const plans = [
  {
    code: 'free',
    name: 'Free',
    price: '$0',
    period: '/mo',
    features: ['5 users', '1 workspace', 'Core RBAC', '7-day audit log'],
    current: false,
  },
  {
    code: 'pro',
    name: 'Pro',
    price: '$49',
    period: '/mo',
    features: [
      '50 users',
      '5 workspaces',
      'SSO + SCIM',
      '90-day audit log',
      'Custom domains',
      'Webhooks',
    ],
    current: true,
  },
  {
    code: 'enterprise',
    name: 'Enterprise',
    price: 'Custom',
    period: '',
    features: [
      'Unlimited users',
      'Dedicated infra',
      'SLA support',
      'Unlimited audit log',
      'SAML + SCIM',
    ],
    current: false,
  },
];

const invoices = [
  { date: 'Apr 1, 2026', amount: '$49.00', status: 'Paid', id: 'INV-2026-004' },
  { date: 'Mar 1, 2026', amount: '$49.00', status: 'Paid', id: 'INV-2026-003' },
  { date: 'Feb 1, 2026', amount: '$49.00', status: 'Paid', id: 'INV-2026-002' },
  { date: 'Jan 1, 2026', amount: '$49.00', status: 'Paid', id: 'INV-2026-001' },
];

interface BillingPageProps {
  searchParams: Promise<{ checkout?: string }>;
}

export default async function BillingPage({ searchParams }: BillingPageProps) {
  const session = await auth();
  if (!session) redirect('/auth/signin');

  const { checkout } = await searchParams;

  return (
    <div>
      <Topbar
        title="Billing"
        subtitle="Manage your subscription, plan, and invoices"
        userEmail={session.user.email}
        userName={session.user.name}
      />

      <main className="space-y-6 p-6">
        {/* Checkout result banner */}
        {checkout === 'success' && (
          <div
            className="flex items-center gap-3 rounded-2xl border px-5 py-4"
            style={{
              background: 'rgba(22,163,74,0.06)',
              borderColor: 'rgba(22,163,74,0.25)',
            }}
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
            className="flex items-center gap-3 rounded-2xl border px-5 py-4"
            style={{
              background: 'rgba(245,158,11,0.06)',
              borderColor: 'rgba(245,158,11,0.25)',
            }}
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
          className="relative overflow-hidden rounded-2xl border p-6"
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
                  Pro Plan
                </h2>
                <Badge variant="blue" dot>
                  Active
                </Badge>
              </div>
              <p className="mb-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
                Your subscription renews on <strong>June 1, 2026</strong>. You are billed{' '}
                <strong>$49/month</strong>.
              </p>
              <div className="flex flex-wrap gap-4">
                <div>
                  <div
                    className="mb-1 text-xs font-semibold uppercase tracking-wide"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    Seats used
                  </div>
                  <div className="text-2xl font-extrabold" style={{ color: 'var(--text-primary)' }}>
                    43{' '}
                    <span className="text-base font-normal" style={{ color: 'var(--text-muted)' }}>
                      / 50
                    </span>
                  </div>
                  <div
                    className="mt-1.5 h-1.5 w-36 overflow-hidden rounded-full"
                    style={{ background: 'var(--border-light)' }}
                  >
                    <div
                      className="h-full rounded-full"
                      style={{ width: '86%', background: 'var(--brand-primary)' }}
                    />
                  </div>
                </div>
                <div>
                  <div
                    className="mb-1 text-xs font-semibold uppercase tracking-wide"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    Next invoice
                  </div>
                  <div className="text-2xl font-extrabold" style={{ color: 'var(--text-primary)' }}>
                    $49.00
                  </div>
                  <div className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                    Jun 1, 2026
                  </div>
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <ManageSubscriptionButton className="brand-gradient w-full rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50" />
              <ManageSubscriptionButton
                label="Update payment method"
                className="hover:bg-bg-subtle w-full rounded-xl border px-5 py-2.5 text-sm font-semibold transition-colors disabled:opacity-50"
                style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}
              />
            </div>
          </div>
        </div>

        {/* Plan comparison */}
        <div>
          <h2 className="mb-4 text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
            Available Plans
          </h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`flex flex-col rounded-2xl border p-5 ${plan.current ? 'ring-2' : ''}`}
                style={{
                  background: plan.current ? 'var(--bg-subtle)' : 'var(--bg-white)',
                  borderColor: plan.current ? 'var(--brand-primary)' : 'var(--border-light)',
                  boxShadow: plan.current ? 'var(--shadow-brand)' : 'var(--shadow-card)',
                }}
              >
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                    {plan.name}
                  </span>
                  {plan.current && <Badge variant="blue">Current</Badge>}
                </div>
                <div className="mb-4 flex items-end gap-1">
                  <span
                    className="text-2xl font-extrabold"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {plan.price}
                  </span>
                  <span className="mb-0.5 text-sm" style={{ color: 'var(--text-muted)' }}>
                    {plan.period}
                  </span>
                </div>
                <ul className="mb-4 flex-1 space-y-2">
                  {plan.features.map((f) => (
                    <li
                      key={f}
                      className="flex items-center gap-2 text-xs"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      <svg className="h-3.5 w-3.5 flex-shrink-0" viewBox="0 0 16 16" fill="none">
                        <circle cx="8" cy="8" r="8" fill="var(--brand-primary)" opacity="0.1" />
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
                {plan.current ? (
                  <button
                    disabled
                    className="w-full cursor-default rounded-xl py-2 text-xs font-semibold opacity-50"
                    style={{ background: 'var(--border-default)', color: 'var(--text-muted)' }}
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
            ))}
          </div>
        </div>

        {/* Usage */}
        <div
          className="rounded-2xl border p-6"
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
            {[
              {
                label: 'API Requests',
                used: 284700,
                limit: 500000,
                unit: '',
                format: (v: number) => (v / 1000).toFixed(0) + 'k',
              },
              {
                label: 'Team Members',
                used: 43,
                limit: 50,
                unit: '',
                format: (v: number) => String(v),
              },
              {
                label: 'Webhooks Delivered',
                used: 1247,
                limit: 5000,
                unit: '',
                format: (v: number) => v.toLocaleString(),
              },
            ].map((item) => (
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
                      width: `${String(Math.round((item.used / item.limit) * 100))}%`,
                      background:
                        item.used / item.limit > 0.85
                          ? 'var(--status-warning)'
                          : 'var(--brand-primary)',
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Invoice history */}
        <div
          className="rounded-2xl border"
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
              Invoice History
            </h2>
            <button
              className="text-xs font-semibold hover:underline"
              style={{ color: 'var(--brand-primary)' }}
            >
              Download all
            </button>
          </div>
          <div className="divide-y" style={{ borderColor: 'var(--border-light)' }}>
            {invoices.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between px-6 py-4">
                <div>
                  <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {inv.date}
                  </div>
                  <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {inv.id}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant="success" dot>
                    {inv.status}
                  </Badge>
                  <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {inv.amount}
                  </span>
                  <button
                    className="hover:bg-bg-subtle rounded-lg border px-2.5 py-1.5 text-xs transition-colors"
                    style={{ borderColor: 'var(--border-light)', color: 'var(--text-secondary)' }}
                  >
                    PDF
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
