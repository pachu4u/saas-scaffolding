import { auth } from '@platform/auth';
import { adminDb } from '@platform/db';
import { resolveTenant } from '@platform/tenant';
import { redirect } from 'next/navigation';

import { Topbar } from '@/components/layout/topbar';
import { AuditLogTable, type AuditRow } from '@/components/ui/audit-log-table';
import { AuditFilters } from './audit-filters';

export const metadata = { title: 'Audit Log' };

function getCategory(action: string): string {
  const a = action.toLowerCase();
  if (a.includes('billing') || a.includes('subscription') || a.includes('plan')) return 'billing';
  if (a.includes('scim')) return 'scim';
  if (a.includes('fail') || a.includes('error')) return 'error';
  if (a.includes('webhook') || a.includes('apikey') || a.includes('api_key')) return 'api';
  if (a.includes('settings') || a.includes('branding') || a.includes('domain')) return 'settings';
  if (a.includes('signin') || a.includes('signout') || a.includes('session')) return 'auth';
  if (a.includes('token')) return 'security';
  return 'team';
}

interface AuditPageProps {
  searchParams: Promise<{
    action?: string;
    actor?: string;
    resource?: string;
    from?: string;
    to?: string;
  }>;
}

export default async function AuditPage({ searchParams }: AuditPageProps) {
  const session = await auth();
  if (!session) redirect('/auth/signin');

  const slug = process.env.NEXT_PUBLIC_DEFAULT_TENANT_SLUG ?? 'acme';
  const tenantCtx = await resolveTenant(slug);
  if (!tenantCtx) redirect('/');

  const { tenantId } = tenantCtx;
  const filters = await searchParams;

  // Actor email filter: resolve to user IDs first
  let actorUserIds: string[] | undefined;
  if (filters.actor?.trim()) {
    const matchingUsers = await adminDb.user.findMany({
      where: { email: { contains: filters.actor.trim(), mode: 'insensitive' } },
      select: { id: true },
    });
    actorUserIds = matchingUsers.map((u) => u.id);
  }

  // Build date range
  let fromDate: Date | undefined;
  let toDate: Date | undefined;
  if (filters.from) {
    const d = new Date(filters.from);
    if (!isNaN(d.getTime())) fromDate = d;
  }
  if (filters.to) {
    const d = new Date(filters.to);
    if (!isNaN(d.getTime())) {
      d.setHours(23, 59, 59, 999);
      toDate = d;
    }
  }

  const auditLogs = await adminDb.auditLog.findMany({
    where: {
      tenantId,
      ...(filters.action?.trim() && {
        action: { contains: filters.action.trim(), mode: 'insensitive' },
      }),
      ...(filters.resource?.trim() && {
        resourceType: { equals: filters.resource.trim(), mode: 'insensitive' },
      }),
      ...(actorUserIds !== undefined && { actorUserId: { in: actorUserIds } }),
      ...((fromDate ?? toDate) && {
        occurredAt: {
          ...(fromDate && { gte: fromDate }),
          ...(toDate && { lte: toDate }),
        },
      }),
    },
    orderBy: { occurredAt: 'desc' },
    take: 200,
    include: { actor: { select: { email: true } } },
  });

  const rows: AuditRow[] = auditLogs.map((log) => ({
    id: String(log.id),
    occurredAt: log.occurredAt.toISOString(),
    action: log.action,
    resourceType: log.resourceType,
    resourceId: log.resourceId,
    actorEmail: log.actor?.email ?? null,
    ip: log.ip ?? null,
    category: getCategory(log.action),
  }));

  const hasFilters = !!(
    filters.action ||
    filters.actor ||
    filters.resource ||
    filters.from ||
    filters.to
  );

  return (
    <div>
      <Topbar
        title="Audit Log"
        subtitle="Immutable record of all workspace actions"
        userEmail={session.user.email}
        userName={session.user.name ?? undefined}
        actions={
          <a
            href="/api/audit/export"
            className="rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-gray-50"
            style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}
          >
            Export CSV
          </a>
        }
      />

      <main className="space-y-4 p-6">
        {/* Filters */}
        <AuditFilters
          initialAction={filters.action ?? ''}
          initialActor={filters.actor ?? ''}
          initialResource={filters.resource ?? ''}
          initialFrom={filters.from ?? ''}
          initialTo={filters.to ?? ''}
        />

        {/* Results count */}
        <div className="flex items-center justify-between">
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {hasFilters
              ? `${rows.length} result${rows.length !== 1 ? 's' : ''} (filtered)`
              : `Showing last ${rows.length} events`}
          </p>
          {hasFilters && (
            <a
              href="/audit"
              className="text-xs font-semibold hover:underline"
              style={{ color: 'var(--brand-primary)' }}
            >
              Clear filters
            </a>
          )}
        </div>

        <AuditLogTable data={rows} />

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
            Logs are <strong>append-only and immutable</strong> — they cannot be modified or
            deleted. Showing up to 200 events per query. Upgrade to Enterprise for extended
            retention and full-text search.
          </p>
        </div>
      </main>
    </div>
  );
}
