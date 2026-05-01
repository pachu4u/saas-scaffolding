import { auth } from '@platform/auth';
import { redirect } from 'next/navigation';

import { Topbar } from '@/components/layout/topbar';
import { Badge } from '@/components/ui/badge';

export const metadata = { title: 'Billing' };

const plans = [
  {
    name: 'Free',
    price: '$0',
    period: '/mo',
    features: ['5 users', '1 workspace', 'Core RBAC', '7-day audit log'],
    current: false,
  },
  {
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

export default async function BillingPage() {
  const session = await auth();
  if (!session) redirect('/auth/signin');

  return (
    <div>
      <Topbar
        title="Billing"
        subtitle="Manage your subscription, plan, and invoices"
        userEmail={session.user.email}
        userName={session.user.name}
      />

      <main className="space-y-6 p-6">
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
              <button className="brand-gradient rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90">
                Manage subscription
              </button>
              <button
                className="hover:bg-bg-subtle rounded-xl border px-5 py-2.5 text-sm font-semibold transition-colors"
                style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}
              >
                Update payment method
              </button>
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
                <button
                  className={`w-full rounded-xl py-2 text-xs font-semibold transition-all ${plan.current ? 'cursor-default opacity-50' : 'hover:opacity-90'}`}
                  style={
                    plan.current
                      ? { background: 'var(--border-default)', color: 'var(--text-muted)' }
                      : { background: 'var(--brand-primary)', color: '#fff' }
                  }
                  disabled={plan.current}
                >
                  {plan.current
                    ? 'Current plan'
                    : plan.name === 'Enterprise'
                      ? 'Contact sales'
                      : `Upgrade to ${plan.name}`}
                </button>
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
