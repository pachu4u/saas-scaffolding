import { auth } from '@platform/auth';
import { adminDb } from '@platform/db';
import { resolveTenant } from '@platform/tenant';
import { redirect } from 'next/navigation';

import { timeAgo } from '@/lib/time';
import { Topbar } from '@/components/layout/topbar';
import { Badge } from '@/components/ui/badge';

export const metadata = { title: 'Audit Log' };

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

function getCategory(action: string): string {
  const a = action.toLowerCase();
  if (a.includes('billing') || a.includes('subscription') || a.includes('plan')) return 'billing';
  if (a.includes('scim')) return 'scim';
  if (a.includes('fail') || a.includes('error')) return 'error';
  if (a.includes('webhook') || a.includes('apikey') || a.includes('api_key')) return 'api';
  if (a.includes('settings') || a.includes('branding') || a.includes('domain')) return 'settings';
  if (a.includes('signin') || a.includes('signout') || a.includes('session')) return 'auth';
  if (a.includes('scim') || a.includes('token')) return 'security';
  return 'team';
}

const PAGE_SIZE = 25;

export default async function AuditPage() {
  const session = await auth();
  if (!session) redirect('/auth/signin');

  const slug = process.env.NEXT_PUBLIC_DEFAULT_TENANT_SLUG ?? 'acme';
  const tenantCtx = await resolveTenant(slug);
  if (!tenantCtx) redirect('/');

  const { tenantId } = tenantCtx;

  const [auditLogs, totalCount] = await Promise.all([
    adminDb.auditLog.findMany({
      where: { tenantId },
      orderBy: { occurredAt: 'desc' },
      take: PAGE_SIZE,
      include: {
        actor: { select: { email: true } },
      },
    }),
    adminDb.auditLog.count({ where: { tenantId } }),
  ]);

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
          {auditLogs.length === 0 ? (
            <div className="px-6 py-12 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
              No audit events yet. Actions taken in this workspace will appear here.
            </div>
          ) : (
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
                {auditLogs.map((event, i) => {
                  const category = getCategory(event.action);
                  const config = categoryConfig[category] ??
                    categoryConfig.api ?? {
                      variant: 'default' as const,
                      label: 'Other',
                    };
                  const actorDisplay = event.actor?.email ?? 'System';
                  const resourceDisplay =
                    event.resourceId.length > 20
                      ? event.resourceId.slice(0, 20) + '…'
                      : event.resourceId;
                  return (
                    <tr
                      key={event.id.toString()}
                      className="hover:bg-bg-main cursor-pointer transition-colors"
                      style={{
                        borderBottom:
                          i < auditLogs.length - 1 ? '1px solid var(--border-light)' : 'none',
                      }}
                    >
                      <td className="px-6 py-3.5">
                        <span className="font-mono text-xs" style={{ color: 'var(--text-muted)' }}>
                          {timeAgo(event.occurredAt)}
                        </span>
                      </td>
                      <td className="px-6 py-3.5">
                        <code
                          className="rounded px-2 py-0.5 font-mono text-xs"
                          style={{
                            background: 'var(--bg-subtle)',
                            color: 'var(--brand-secondary)',
                          }}
                        >
                          {event.action}
                        </code>
                      </td>
                      <td className="px-6 py-3.5">
                        <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                          <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                            {event.resourceType}
                          </span>{' '}
                          · {resourceDisplay}
                        </div>
                      </td>
                      <td className="px-6 py-3.5">
                        <div className="flex items-center gap-2">
                          <div className="brand-gradient flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold text-white">
                            {actorDisplay[0]?.toUpperCase() ?? '?'}
                          </div>
                          <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                            {actorDisplay}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-3.5">
                        <code className="font-mono text-xs" style={{ color: 'var(--text-muted)' }}>
                          {event.ip ?? '—'}
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
          )}

          <div
            className="flex items-center justify-between border-t px-6 py-4"
            style={{ borderColor: 'var(--border-light)' }}
          >
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Showing {auditLogs.length} of {totalCount.toLocaleString()} event
              {totalCount !== 1 ? 's' : ''}
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
            Logs are append-only and immutable — they cannot be modified or deleted. Upgrade to
            Enterprise for extended retention periods.
          </p>
        </div>
      </main>
    </div>
  );
}
