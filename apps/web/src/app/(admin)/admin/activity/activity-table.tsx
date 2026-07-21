'use client';

import { Badge } from '@/components/ui/badge';
import { DataTable, type Column } from '@/components/ui/data-table';

export interface ActivityRow extends Record<string, unknown> {
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

export function ActivityTable({ data }: { data: ActivityRow[] }) {
  return (
    <DataTable<ActivityRow>
      columns={columns}
      data={data}
      searchPlaceholder="Search by action…"
      searchKeys={['action', 'tenantName', 'actorEmail']}
      rowLabel="event"
      emptyMessage="No platform activity yet."
      rowKey={(row) => row.id}
    />
  );
}
