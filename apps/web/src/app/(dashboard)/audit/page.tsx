import { auth } from '@platform/auth';
import { redirect } from 'next/navigation';

import { Topbar } from '@/components/layout/topbar';
import { Badge } from '@/components/ui/badge';

export const metadata = { title: 'Audit Log' };

const auditEvents = [
  {
    id: 1,
    action: 'user.invite',
    resourceType: 'User',
    resource: 'jane.doe@acme.com',
    actor: 'Alice Kim',
    ip: '203.0.113.42',
    time: '2026-05-01 14:32:11',
    category: 'team',
  },
  {
    id: 2,
    action: 'subscription.upgrade',
    resourceType: 'Subscription',
    resource: 'pro → enterprise',
    actor: 'Bob Lee',
    ip: '203.0.113.17',
    time: '2026-05-01 13:10:04',
    category: 'billing',
  },
  {
    id: 3,
    action: 'scim.user.sync',
    resourceType: 'User',
    resource: '47 users (bulk)',
    actor: 'System',
    ip: '10.0.0.1',
    time: '2026-05-01 11:45:00',
    category: 'scim',
  },
  {
    id: 4,
    action: 'api_key.create',
    resourceType: 'ApiKey',
    resource: 'webhook-prod-key',
    actor: 'Alice Kim',
    ip: '203.0.113.42',
    time: '2026-05-01 10:22:33',
    category: 'api',
  },
  {
    id: 5,
    action: 'role_binding.update',
    resourceType: 'RoleBinding',
    resource: 'charlie@acme.com → Admin',
    actor: 'Alice Kim',
    ip: '203.0.113.42',
    time: '2026-04-30 17:58:01',
    category: 'team',
  },
  {
    id: 6,
    action: 'webhook.delivery.failed',
    resourceType: 'Webhook',
    resource: 'POST /ingest',
    actor: 'System',
    ip: '10.0.0.1',
    time: '2026-04-30 16:40:22',
    category: 'error',
  },
  {
    id: 7,
    action: 'user.signin',
    resourceType: 'Session',
    resource: 'alice@acme.com',
    actor: 'Alice Kim',
    ip: '203.0.113.42',
    time: '2026-04-30 09:01:55',
    category: 'auth',
  },
  {
    id: 8,
    action: 'tenant.domain.add',
    resourceType: 'Domain',
    resource: 'app.acme.com',
    actor: 'Bob Lee',
    ip: '203.0.113.17',
    time: '2026-04-29 15:30:00',
    category: 'settings',
  },
  {
    id: 9,
    action: 'user.suspend',
    resourceType: 'User',
    resource: 'frank@acme.com',
    actor: 'Alice Kim',
    ip: '203.0.113.42',
    time: '2026-04-28 11:11:43',
    category: 'team',
  },
  {
    id: 10,
    action: 'scim_token.rotate',
    resourceType: 'ScimToken',
    resource: 'primary-scim-token',
    actor: 'Bob Lee',
    ip: '203.0.113.17',
    time: '2026-04-27 10:00:00',
    category: 'security',
  },
];

const categoryConfig: Record<
  string,
  {
    variant: 'blue' | 'purple' | 'success' | 'default' | 'error' | 'warning' | 'gray';
    label: string;
  }
> = {
  team: { variant: 'blue', label: 'Team' },
  billing: { variant: 'purple', label: 'Billing' },
  scim: { variant: 'success', label: 'SCIM' },
  api: { variant: 'default', label: 'API' },
  error: { variant: 'error', label: 'Error' },
  auth: { variant: 'gray', label: 'Auth' },
  settings: { variant: 'warning', label: 'Settings' },
  security: { variant: 'warning', label: 'Security' },
};

export default async function AuditPage() {
  const session = await auth();
  if (!session) redirect('/auth/signin');

  return (
    <div>
      <Topbar
        title="Audit Log"
        subtitle="All workspace actions, immutable and searchable"
        userEmail={session.user.email}
        userName={session.user.name ?? undefined}
        actions={
          <button
            className="hover:bg-bg-subtle rounded-xl border px-4 py-2 text-sm font-semibold transition-colors"
            style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}
          >
            Export CSV
          </button>
        }
      />

      <main className="space-y-6 p-6">
        {/* Filters */}
        <div
          className="flex flex-wrap items-center gap-3 rounded-2xl border p-4"
          style={{
            background: 'var(--bg-white)',
            borderColor: 'var(--border-light)',
            boxShadow: 'var(--shadow-card)',
          }}
        >
          <div className="relative min-w-48 flex-1">
            <svg
              viewBox="0 0 20 20"
              fill="currentColor"
              className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
              style={{ color: 'var(--text-muted)' }}
            >
              <path
                fillRule="evenodd"
                d="M8 4a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM2 8a6 6 0 1 1 10.89 3.476l4.817 4.817a1 1 0 0 1-1.414 1.414l-4.816-4.816A6 6 0 0 1 2 8z"
                clipRule="evenodd"
              />
            </svg>
            <input
              type="text"
              placeholder="Search actions, actors, resources..."
              className="w-full rounded-xl border py-2 pl-9 pr-4 text-sm outline-none"
              style={{
                borderColor: 'var(--border-light)',
                background: 'var(--bg-main)',
                color: 'var(--text-primary)',
              }}
            />
          </div>
          <select
            className="rounded-xl border px-3 py-2 text-sm outline-none"
            style={{
              borderColor: 'var(--border-light)',
              background: 'var(--bg-main)',
              color: 'var(--text-secondary)',
            }}
          >
            <option>All categories</option>
            <option>Team</option>
            <option>Billing</option>
            <option>Auth</option>
            <option>SCIM</option>
            <option>API</option>
            <option>Security</option>
          </select>
          <select
            className="rounded-xl border px-3 py-2 text-sm outline-none"
            style={{
              borderColor: 'var(--border-light)',
              background: 'var(--bg-main)',
              color: 'var(--text-secondary)',
            }}
          >
            <option>Last 7 days</option>
            <option>Last 30 days</option>
            <option>Last 90 days</option>
            <option>Custom range</option>
          </select>
          <select
            className="rounded-xl border px-3 py-2 text-sm outline-none"
            style={{
              borderColor: 'var(--border-light)',
              background: 'var(--bg-main)',
              color: 'var(--text-secondary)',
            }}
          >
            <option>All actors</option>
            <option>Alice Kim</option>
            <option>Bob Lee</option>
            <option>System</option>
          </select>
        </div>

        {/* Events table */}
        <div
          className="overflow-hidden rounded-2xl border"
          style={{
            background: 'var(--bg-white)',
            borderColor: 'var(--border-light)',
            boxShadow: 'var(--shadow-card)',
          }}
        >
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-light)' }}>
                {['Timestamp', 'Action', 'Resource', 'Actor', 'IP Address', 'Category'].map(
                  (col) => (
                    <th
                      key={col}
                      className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      {col}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {auditEvents.map((event, i) => {
                const config = categoryConfig[event.category] ??
                  categoryConfig.api ?? { variant: 'default' as const, label: 'Other', icon: '📋' };
                return (
                  <tr
                    key={event.id}
                    className="hover:bg-bg-main cursor-pointer transition-colors"
                    style={{
                      borderBottom:
                        i < auditEvents.length - 1 ? '1px solid var(--border-light)' : 'none',
                    }}
                  >
                    <td className="px-6 py-3.5">
                      <span className="font-mono text-xs" style={{ color: 'var(--text-muted)' }}>
                        {event.time}
                      </span>
                    </td>
                    <td className="px-6 py-3.5">
                      <code
                        className="rounded px-2 py-0.5 font-mono text-xs"
                        style={{ background: 'var(--bg-subtle)', color: 'var(--brand-secondary)' }}
                      >
                        {event.action}
                      </code>
                    </td>
                    <td className="px-6 py-3.5">
                      <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                        <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                          {event.resourceType}
                        </span>{' '}
                        · {event.resource}
                      </div>
                    </td>
                    <td className="px-6 py-3.5">
                      <div className="flex items-center gap-2">
                        <div className="brand-gradient flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold text-white">
                          {event.actor[0]}
                        </div>
                        <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                          {event.actor}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-3.5">
                      <code className="font-mono text-xs" style={{ color: 'var(--text-muted)' }}>
                        {event.ip}
                      </code>
                    </td>
                    <td className="px-6 py-3.5">
                      <Badge variant={config.variant}>{config.label}</Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div
            className="flex items-center justify-between border-t px-6 py-4"
            style={{ borderColor: 'var(--border-light)' }}
          >
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Showing 10 of 1,284 events (90-day retention)
            </span>
            <div className="flex items-center gap-2">
              <button
                className="hover:bg-bg-subtle rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors"
                style={{ borderColor: 'var(--border-light)', color: 'var(--text-secondary)' }}
              >
                Previous
              </button>
              <button
                className="hover:bg-bg-subtle rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors"
                style={{ borderColor: 'var(--border-light)', color: 'var(--text-secondary)' }}
              >
                Next
              </button>
            </div>
          </div>
        </div>

        {/* Retention notice */}
        <div
          className="flex items-start gap-3 rounded-xl p-4"
          style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-default)' }}
        >
          <svg
            viewBox="0 0 20 20"
            fill="currentColor"
            className="mt-0.5 h-4 w-4 flex-shrink-0"
            style={{ color: 'var(--brand-secondary)' }}
          >
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0zm-7-4a1 1 0 1 1-2 0 1 1 0 0 1 2 0zM9 9a1 1 0 0 0 0 2v3a1 1 0 0 0 1 1h1a1 1 0 1 0 0-2v-3a1 1 0 0 0-1-1H9z"
              clipRule="evenodd"
            />
          </svg>
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            Audit log is retained for <strong>90 days</strong> on the Pro plan. Upgrade to
            Enterprise for unlimited retention. Logs are append-only and cryptographically signed —
            they cannot be modified or deleted.
          </p>
        </div>
      </main>
    </div>
  );
}
