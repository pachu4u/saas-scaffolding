import { auth } from '@platform/auth';
import { adminDb } from '@platform/db';
import { redirect } from 'next/navigation';

import { Topbar } from '@/components/layout/topbar';
import { Badge } from '@/components/ui/badge';
import { DataTable, type Column } from '@/components/ui/data-table';

export const metadata = { title: 'Activity — Platform Admin' };

interface ActivityRow extends Record<string, unknown> {
  id: string;
  occurredAt: string;
  action: string;
  tenantSlug: string;
  tenantName: string;
  actorEmail: string | null;
  resourceType: string;
}

function timeAgo(iso: string) {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60) return 'just now';
  if (secs < 3600) return `${String(Math.floor(secs / 60))}m ago`;
  if (secs < 86400) return `${String(Math.floor(secs / 3600))}h ago`;
  return `${String(Math.floor(secs / 86400))}d ago`;
}

const columns: Column<ActivityRow>[] = [
  {
    key: 'occurredAt',
    label: 'Time',
    sortable: true,
    minWidth: '100px',
    render: (row) => (
      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
        {timeAgo(row.occurredAt)}
      </span>
    ),
  },
  {
    key: 'action',
    label: 'Action',
    sortable: true,
    minWidth: '220px',
    render: (row) => (
      <code className="text-xs" style={{ color: 'var(--text-primary)' }}>
        {row.action}
      </code>
    ),
  },
  {
    key: 'tenantName',
    label: 'Tenant',
    sortable: true,
    render: (row) => (
      <Badge variant="blue">
        {row.tenantName} ({row.tenantSlug})
      </Badge>
    ),
  },
  {
    key: 'actorEmail',
    label: 'Actor',
    sortable: true,
    render: (row) => (
      <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
        {row.actorEmail ?? 'system'}
      </span>
    ),
  },
  {
    key: 'resourceType',
    label: 'Resource',
    render: (row) => (
      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
        {row.resourceType}
      </span>
    ),
  },
];

export default async function AdminActivityPage() {
  const session = await auth();
  if (!session) redirect('/auth/signin');

  const logs = await adminDb.auditLog.findMany({
    orderBy: { occurredAt: 'desc' },
    take: 500,
    include: {
      actor: { select: { email: true } },
      tenant: { select: { slug: true, name: true } },
    },
  });

  const rows: ActivityRow[] = logs.map((log) => ({
    id: String(log.id),
    occurredAt: log.occurredAt.toISOString(),
    action: log.action,
    tenantSlug: log.tenant.slug,
    tenantName: log.tenant.name,
    actorEmail: log.actor?.email ?? null,
    resourceType: log.resourceType,
  }));

  return (
    <div>
      <Topbar
        title="Platform Activity"
        subtitle="Cross-tenant audit log — last 500 events"
        userEmail={session.user.email}
        userName={session.user.name ?? undefined}
      />
      <main className="p-6">
        <DataTable<ActivityRow>
          columns={columns}
          data={rows}
          searchPlaceholder="Search by action…"
          searchKeys={['action', 'tenantName', 'actorEmail']}
          rowLabel="event"
          emptyMessage="No platform activity yet."
          rowKey={(row) => row.id}
        />
      </main>
    </div>
  );
}
