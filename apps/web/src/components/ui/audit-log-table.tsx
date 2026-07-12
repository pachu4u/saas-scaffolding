'use client';

import { Badge } from '@/components/ui/badge';
import { DataTable, type Column, type FilterConfig } from '@/components/ui/data-table';

export interface AuditRow extends Record<string, unknown> {
  id: string;
  occurredAt: string;
  action: string;
  resourceType: string;
  resourceId: string;
  actorEmail: string | null;
  ip: string | null;
  category: string;
}

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

function timeAgoFn(iso: string) {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60) return 'just now';
  if (secs < 3600) return `${String(Math.floor(secs / 60))}m ago`;
  if (secs < 86400) return `${String(Math.floor(secs / 3600))}h ago`;
  if (secs < 604800) return `${String(Math.floor(secs / 86400))}d ago`;
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

const columns: Column<AuditRow>[] = [
  {
    key: 'occurredAt',
    label: 'Time',
    sortable: true,
    minWidth: '100px',
    render: (row) => (
      <span className="font-mono text-xs" style={{ color: 'var(--text-muted)' }}>
        {timeAgoFn(row.occurredAt)}
      </span>
    ),
  },
  {
    key: 'action',
    label: 'Action',
    sortable: true,
    minWidth: '180px',
    render: (row) => (
      <code
        className="rounded px-2 py-0.5 font-mono text-xs"
        style={{ background: 'var(--bg-subtle)', color: 'var(--brand-secondary)' }}
      >
        {row.action}
      </code>
    ),
  },
  {
    key: 'resourceType',
    label: 'Resource',
    sortable: true,
    minWidth: '160px',
    render: (row) => (
      <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
        <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>
          {row.resourceType}
        </span>{' '}
        · {row.resourceId.length > 18 ? row.resourceId.slice(0, 18) + '…' : row.resourceId}
      </div>
    ),
  },
  {
    key: 'actorEmail',
    label: 'Actor',
    sortable: true,
    minWidth: '160px',
    render: (row) => {
      const actor = row.actorEmail ?? 'System';
      return (
        <div className="flex items-center gap-2">
          <div
            className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
            style={{ background: 'var(--brand-gradient)' }}
          >
            {actor[0]?.toUpperCase() ?? '?'}
          </div>
          <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            {actor}
          </span>
        </div>
      );
    },
  },
  {
    key: 'ip',
    label: 'IP Address',
    render: (row) => (
      <code className="font-mono text-xs" style={{ color: 'var(--text-muted)' }}>
        {row.ip ?? '—'}
      </code>
    ),
  },
  {
    key: 'category',
    label: 'Category',
    sortable: true,
    render: (row) => {
      const cfg = categoryConfig[row.category] ?? { variant: 'default' as const, label: 'Other' };
      return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
    },
  },
];

const filters: FilterConfig[] = [
  {
    key: 'category',
    label: 'All categories',
    options: [
      { label: 'Team', value: 'team' },
      { label: 'Billing', value: 'billing' },
      { label: 'Auth', value: 'auth' },
      { label: 'SCIM', value: 'scim' },
      { label: 'API', value: 'api' },
      { label: 'Settings', value: 'settings' },
      { label: 'Security', value: 'security' },
      { label: 'Error', value: 'error' },
    ],
  },
];

export function AuditLogTable({ data }: { data: AuditRow[] }) {
  return (
    <DataTable<AuditRow>
      columns={columns}
      data={data}
      filters={filters}
      searchPlaceholder="Search actions, actors, resources…"
      searchKeys={['action', 'actorEmail', 'resourceType', 'resourceId', 'ip']}
      rowLabel="event"
      emptyMessage="No audit events yet. Actions taken in this workspace will appear here."
      rowKey={(row) => row.id}
    />
  );
}
