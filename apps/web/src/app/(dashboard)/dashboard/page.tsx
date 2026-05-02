import { auth } from '@platform/auth';
import { adminDb } from '@platform/db';
import { resolveTenant } from '@platform/tenant';
import { redirect } from 'next/navigation';

import { timeAgo, formatDate } from '@/lib/time';
import { Topbar } from '@/components/layout/topbar';
import { Badge } from '@/components/ui/badge';
import { StatCard } from '@/components/ui/stat-card';

export const metadata = { title: 'Dashboard' };

const activityTypeConfig = {
  team: { variant: 'blue' as const, label: 'Team' },
  billing: { variant: 'purple' as const, label: 'Billing' },
  scim: { variant: 'success' as const, label: 'SCIM' },
  api: { variant: 'default' as const, label: 'API' },
  error: { variant: 'error' as const, label: 'Error' },
  settings: { variant: 'warning' as const, label: 'Settings' },
  auth: { variant: 'gray' as const, label: 'Auth' },
};

function getActivityType(action: string): keyof typeof activityTypeConfig {
  const a = action.toLowerCase();
  if (a.includes('billing') || a.includes('subscription') || a.includes('plan')) return 'billing';
  if (a.includes('scim')) return 'scim';
  if (a.includes('fail') || a.includes('error')) return 'error';
  if (a.includes('webhook') || a.includes('apikey') || a.includes('api_key')) return 'api';
  if (a.includes('settings') || a.includes('branding') || a.includes('domain')) return 'settings';
  if (a.includes('signin') || a.includes('signout') || a.includes('session')) return 'auth';
  return 'team';
}

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

  const slug = process.env.NEXT_PUBLIC_DEFAULT_TENANT_SLUG ?? 'acme';
  const tenantCtx = await resolveTenant(slug);
  if (!tenantCtx) redirect('/');

  const { tenantId } = tenantCtx;
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [
    activeUserCount,
    pendingInviteCount,
    recentAuditLogs,
    subscription,
    totalUserCount,
    usageEvents,
  ] = await Promise.all([
    adminDb.tenantUser.count({ where: { tenantId, status: 'ACTIVE' } }),
    adminDb.tenantUser.count({ where: { tenantId, status: 'INVITED' } }),
    adminDb.auditLog.findMany({
      where: { tenantId },
      orderBy: { occurredAt: 'desc' },
      take: 6,
      include: { actor: { select: { email: true } } },
    }),
    adminDb.subscription.findUnique({
      where: { tenantId },
      include: { plan: true },
    }),
    adminDb.tenantUser.count({ where: { tenantId } }),
    adminDb.usageEvent.findMany({
      where: { tenantId, occurredAt: { gte: thirtyDaysAgo } },
      select: { quantity: true, occurredAt: true },
      orderBy: { occurredAt: 'asc' },
    }),
  ]);

  // Build 30-day chart data from usage events
  const dayMap = new Map<string, number>();
  for (const ev of usageEvents) {
    const day = ev.occurredAt.toISOString().slice(0, 10);
    dayMap.set(day, (dayMap.get(day) ?? 0) + ev.quantity);
  }
  const chartData: number[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    chartData.push(dayMap.get(d.toISOString().slice(0, 10)) ?? 0);
  }
  const maxVal = Math.max(...chartData, 1);
  const chartBars = chartData.map((v) => Math.max(4, Math.round((v / maxVal) * 90) + 4));
  const hasUsageData = usageEvents.length > 0;

  // Map audit logs to activity items
  const recentActivity = recentAuditLogs.map((log) => ({
    action: log.action
      .split(/[._]/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' '),
    subject: `${log.resourceType} · ${log.resourceId.length > 24 ? log.resourceId.slice(0, 24) + '…' : log.resourceId}`,
    actor: log.actor?.email ?? 'System',
    time: timeAgo(log.occurredAt),
    type: getActivityType(log.action),
  }));

  // Plan banner data
  const planName = subscription?.plan.name ?? tenantCtx.plan ?? 'Free';
  const planFeatures = (subscription?.plan.features ?? {}) as Record<string, unknown>;
  const seatLimit = typeof planFeatures.maxSeats === 'number' ? planFeatures.maxSeats : null;
  const periodEnd = subscription?.currentPeriodEnd;

  // Chart date range labels
  const chartStart = new Date(Date.now() - 29 * 24 * 60 * 60 * 1000);
  const chartEnd = new Date();
  const chartStartLabel = chartStart.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
  const chartEndLabel = chartEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

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
            label="Active Members"
            value={activeUserCount.toLocaleString()}
            change={
              pendingInviteCount > 0
                ? `${String(pendingInviteCount)} pending invite${pendingInviteCount !== 1 ? 's' : ''}`
                : 'No pending invites'
            }
            positive={true}
            iconColor="rgba(79, 123, 255, 0.1)"
            icon={
              <svg viewBox="0 0 20 20" fill="var(--brand-primary)" className="h-5 w-5">
                <path d="M9 6a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM17 6a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 0 0-1.5-4.33A5 5 0 0 1 19 16v1h-6.07zM6 11a5 5 0 0 1 5 5v1H1v-1a5 5 0 0 1 5-5z" />
              </svg>
            }
          />
          <StatCard
            label="Total Members"
            value={totalUserCount.toLocaleString()}
            change={
              seatLimit
                ? `${String(seatLimit - totalUserCount)} seats remaining`
                : 'Unlimited seats'
            }
            positive={seatLimit ? totalUserCount < seatLimit : true}
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
            label="Current Plan"
            value={planName}
            change={periodEnd ? `Renews ${formatDate(periodEnd)}` : 'No active subscription'}
            positive={true}
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
            label="Usage Events (30d)"
            value={usageEvents.reduce((s, e) => s + e.quantity, 0).toLocaleString()}
            change="Last 30 days"
            positive={true}
            iconColor="rgba(106, 109, 255, 0.1)"
            icon={
              <svg viewBox="0 0 20 20" fill="var(--brand-secondary)" className="h-5 w-5">
                <path d="M2 11a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-5zM8 7a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V7zM14 4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1V4z" />
              </svg>
            }
          />
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          {/* Activity chart */}
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
                  Usage Events
                </h2>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  Last 30 days
                </p>
              </div>
            </div>
            {hasUsageData ? (
              <>
                <div className="flex h-36 items-end gap-1">
                  {chartBars.map((h, i) => (
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
                    {chartStartLabel}
                  </span>
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {chartEndLabel}
                  </span>
                </div>
              </>
            ) : (
              <div
                className="flex h-36 items-center justify-center rounded-xl"
                style={{ background: 'var(--bg-subtle)' }}
              >
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                  No usage events in the last 30 days
                </p>
              </div>
            )}
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
            {recentActivity.length === 0 ? (
              <div className="px-6 py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
                No activity recorded yet.
              </div>
            ) : (
              recentActivity.map((event, i) => {
                const config =
                  activityTypeConfig[event.type as keyof typeof activityTypeConfig] ??
                  activityTypeConfig.team;
                return (
                  <div key={i} className="flex items-center gap-4 px-6 py-4">
                    <div className="brand-gradient flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold text-white">
                      {event.actor[0]?.toUpperCase() ?? '?'}
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
              })
            )}
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
                You&apos;re on the {planName} plan
              </div>
              <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                {totalUserCount} {seatLimit ? `of ${String(seatLimit)} seats used` : 'members'}{' '}
                {periodEnd ? `· renews ${formatDate(periodEnd)}` : ''}
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
