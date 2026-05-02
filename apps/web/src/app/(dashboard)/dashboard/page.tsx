import { auth } from '@platform/auth';
import { redirect } from 'next/navigation';

import { Topbar } from '@/components/layout/topbar';
import { Badge } from '@/components/ui/badge';
import { StatCard } from '@/components/ui/stat-card';

export const metadata = { title: 'Dashboard' };

const recentActivity = [
  {
    action: 'User invited',
    subject: 'jane.doe@acme.com',
    actor: 'Alice Kim',
    time: '2 min ago',
    type: 'team',
  },
  {
    action: 'Plan upgraded',
    subject: 'Pro → Enterprise',
    actor: 'Bob Lee',
    time: '1 hr ago',
    type: 'billing',
  },
  {
    action: 'SCIM sync completed',
    subject: '47 users synced from Okta',
    actor: 'System',
    time: '3 hr ago',
    type: 'scim',
  },
  {
    action: 'API key created',
    subject: 'webhook-prod-key',
    actor: 'Alice Kim',
    time: '5 hr ago',
    type: 'api',
  },
  {
    action: 'Member role changed',
    subject: 'charlie@acme.com → Admin',
    actor: 'Alice Kim',
    time: '1 day ago',
    type: 'team',
  },
  {
    action: 'Webhook delivery failed',
    subject: 'POST /ingest (3 retries)',
    actor: 'System',
    time: '1 day ago',
    type: 'error',
  },
];

const activityTypeConfig = {
  team: { variant: 'blue' as const, label: 'Team' },
  billing: { variant: 'purple' as const, label: 'Billing' },
  scim: { variant: 'success' as const, label: 'SCIM' },
  api: { variant: 'default' as const, label: 'API' },
  error: { variant: 'error' as const, label: 'Error' },
};

const quickActions = [
  {
    label: 'Invite team member',
    href: '/team',
    icon: '👤',
    description: 'Add someone to your workspace',
  },
  {
    label: 'Manage subscription',
    href: '/billing',
    icon: '💳',
    description: 'View plans and usage',
  },
  { label: 'Configure SSO', href: '/settings', icon: '🔐', description: 'Set up SAML or OIDC' },
  { label: 'View audit log', href: '/audit', icon: '📋', description: 'Track all user actions' },
];

export default async function DashboardPage() {
  const session = await auth();
  if (!session) redirect('/auth/signin');

  return (
    <div>
      <Topbar
        title="Dashboard"
        subtitle="Welcome back — here's what's happening"
        userEmail={session.user.email}
        userName={session.user.name ?? undefined}
      />

      <main className="space-y-6 p-6">
        {/* Stats */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Active Users"
            value="2,847"
            change="12% this month"
            positive={true}
            iconColor="rgba(79, 123, 255, 0.1)"
            icon={
              <svg viewBox="0 0 20 20" fill="var(--brand-primary)" className="h-5 w-5">
                <path d="M9 6a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM17 6a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 0 0-1.5-4.33A5 5 0 0 1 19 16v1h-6.07zM6 11a5 5 0 0 1 5 5v1H1v-1a5 5 0 0 1 5-5z" />
              </svg>
            }
          />
          <StatCard
            label="Uptime"
            value="99.97%"
            change="0.02% from last month"
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
            label="API Latency (p95)"
            value="143ms"
            change="8ms from last week"
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
          <StatCard
            label="MRR"
            value="$4,280"
            change="23% this quarter"
            positive={true}
            iconColor="rgba(106, 109, 255, 0.1)"
            icon={
              <svg viewBox="0 0 20 20" fill="var(--brand-secondary)" className="h-5 w-5">
                <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 0 1-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 0 1-.567.267z" />
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
          {/* Activity chart placeholder */}
          <div
            className="rounded-2xl border p-6 xl:col-span-2"
            style={{
              background: 'var(--bg-white)',
              borderColor: 'var(--border-light)',
              boxShadow: 'var(--shadow-card)',
            }}
          >
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                  API Requests
                </h2>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  Last 30 days
                </p>
              </div>
              <div className="flex items-center gap-2">
                {['1W', '1M', '3M'].map((period, i) => (
                  <button
                    key={period}
                    className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${i === 1 ? 'text-white' : ''}`}
                    style={
                      i === 1
                        ? { background: 'var(--brand-primary)' }
                        : { color: 'var(--text-muted)' }
                    }
                  >
                    {period}
                  </button>
                ))}
              </div>
            </div>
            {/* Chart bars */}
            <div className="flex h-36 items-end gap-1">
              {[
                55, 72, 48, 90, 63, 85, 71, 94, 68, 88, 75, 96, 82, 58, 77, 89, 66, 92, 74, 86, 61,
                95, 79, 84, 70, 93, 67, 88, 76, 91,
              ].map((h, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-sm transition-opacity hover:opacity-100"
                  style={{
                    height: `${String(h)}%`,
                    background: i >= 27 ? 'var(--brand-primary)' : 'var(--bg-subtle)',
                    opacity: i >= 27 ? 1 : 0.6,
                  }}
                />
              ))}
            </div>
            <div className="mt-2 flex justify-between">
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Apr 1
              </span>
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Apr 30
              </span>
            </div>
          </div>

          {/* Quick actions */}
          <div
            className="rounded-2xl border p-6"
            style={{
              background: 'var(--bg-white)',
              borderColor: 'var(--border-light)',
              boxShadow: 'var(--shadow-card)',
            }}
          >
            <h2 className="mb-4 text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
              Quick Actions
            </h2>
            <div className="space-y-2">
              {quickActions.map((action) => (
                <a
                  key={action.href}
                  href={action.href}
                  className="flex items-center gap-3 rounded-xl border p-3 transition-all hover:-translate-y-0.5"
                  style={{ borderColor: 'var(--border-light)', background: 'var(--bg-main)' }}
                >
                  <span className="text-xl">{action.icon}</span>
                  <div>
                    <div className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
                      {action.label}
                    </div>
                    <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {action.description}
                    </div>
                  </div>
                </a>
              ))}
            </div>
          </div>
        </div>

        {/* Recent activity */}
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
              Recent Activity
            </h2>
            <a
              href="/audit"
              className="text-xs font-semibold hover:underline"
              style={{ color: 'var(--brand-primary)' }}
            >
              View full audit log →
            </a>
          </div>
          <div className="divide-y" style={{ borderColor: 'var(--border-light)' }}>
            {recentActivity.map((event, i) => {
              const config = activityTypeConfig[event.type as keyof typeof activityTypeConfig];
              return (
                <div key={i} className="flex items-center gap-4 px-6 py-4">
                  <div className="brand-gradient flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold text-white">
                    {event.actor[0]}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className="text-sm font-semibold"
                        style={{ color: 'var(--text-primary)' }}
                      >
                        {event.action}
                      </span>
                      <Badge variant={config.variant}>{config.label}</Badge>
                    </div>
                    <div className="mt-0.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                      {event.subject} · by{' '}
                      <span style={{ color: 'var(--text-secondary)' }}>{event.actor}</span>
                    </div>
                  </div>
                  <span className="flex-shrink-0 text-xs" style={{ color: 'var(--text-muted)' }}>
                    {event.time}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Plan banner */}
        <div
          className="flex items-center justify-between rounded-2xl p-5"
          style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-default)' }}
        >
          <div className="flex items-center gap-3">
            <div className="brand-gradient flex h-10 w-10 items-center justify-center rounded-xl text-lg text-white">
              ⚡
            </div>
            <div>
              <div className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                You&apos;re on the Pro plan
              </div>
              <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                43 of 50 seats used · renews June 1, 2026
              </div>
            </div>
          </div>
          <a
            href="/billing"
            className="brand-gradient rounded-xl px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          >
            Manage plan
          </a>
        </div>
      </main>
    </div>
  );
}
