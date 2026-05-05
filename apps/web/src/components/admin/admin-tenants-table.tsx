'use client';

import Link from 'next/link';

import { DataTable, type Column, type FilterConfig } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { TenantStatusButton } from './tenant-status-button';

export interface TenantRow {
  id: string;
  name: string;
  slug: string;
  plan: string;
  users: number;
  status: string;
  createdAt: string;
  lastActivity: string | null;
  customDomains: string[];
}

const planColors: Record<string, 'purple' | 'blue' | 'gray'> = {
  Enterprise: 'purple',
  Pro: 'blue',
  Free: 'gray',
};

function formatDateShort(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function timeAgoFn(iso: string) {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60) return 'just now';
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  if (secs < 604800) return `${Math.floor(secs / 86400)}d ago`;
  return formatDateShort(iso);
}

const columns: Column<TenantRow>[] = [
  {
    key: 'name',
    label: 'Tenant',
    sortable: true,
    minWidth: '180px',
    render: (row) => (
      <div className="flex items-center gap-2.5">
        <div
          className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white"
          style={{ background: 'var(--brand-gradient)' }}
        >
          {row.name[0]}
        </div>
        <div>
          <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            {row.name}
          </div>
          <code className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
            {row.slug}
          </code>
        </div>
      </div>
    ),
  },
  {
    key: 'plan',
    label: 'Plan',
    sortable: true,
    render: (row) => <Badge variant={planColors[row.plan] ?? 'gray'}>{row.plan}</Badge>,
  },
  {
    key: 'users',
    label: 'Users',
    sortable: true,
    render: (row) => (
      <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
        {row.users}
      </span>
    ),
  },
  {
    key: 'customDomains',
    label: 'Domains',
    render: (row) => {
      const domains = row.customDomains;
      return domains.length > 0 ? (
        <span className="font-mono text-[11px]" style={{ color: 'var(--brand-secondary)' }}>
          {domains[0]}
          {domains.length > 1 && ` +${String(domains.length - 1)}`}
        </span>
      ) : (
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
          —
        </span>
      );
    },
  },
  {
    key: 'status',
    label: 'Status',
    sortable: true,
    render: (row) => (
      <Badge
        variant={
          row.status === 'ACTIVE' ? 'success' : row.status === 'SUSPENDED' ? 'error' : 'gray'
        }
        dot
      >
        {row.status.charAt(0) + row.status.slice(1).toLowerCase()}
      </Badge>
    ),
  },
  {
    key: 'createdAt',
    label: 'Created',
    sortable: true,
    render: (row) => (
      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
        {formatDateShort(row.createdAt)}
      </span>
    ),
  },
  {
    key: 'lastActivity',
    label: 'Last Activity',
    sortable: true,
    render: (row) => (
      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
        {row.lastActivity ? timeAgoFn(row.lastActivity) : '—'}
      </span>
    ),
  },
  {
    key: 'id',
    label: '',
    render: (row) => (
      <div className="flex items-center justify-end gap-1.5">
        <Link
          href={`/admin/tenants/${row.id}`}
          className="rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors hover:bg-gray-50"
          style={{ borderColor: 'var(--border-light)', color: 'var(--text-secondary)' }}
          onClick={(e) => e.stopPropagation()}
        >
          View
        </Link>
        <TenantStatusButton tenantId={row.id} currentStatus={row.status} />
      </div>
    ),
  },
];

const filters: FilterConfig[] = [
  {
    key: 'plan',
    label: 'All plans',
    options: [
      { label: 'Free', value: 'Free' },
      { label: 'Pro', value: 'Pro' },
      { label: 'Enterprise', value: 'Enterprise' },
    ],
  },
  {
    key: 'status',
    label: 'All statuses',
    options: [
      { label: 'Active', value: 'ACTIVE' },
      { label: 'Suspended', value: 'SUSPENDED' },
    ],
  },
];

interface AdminTenantsTableProps {
  data: TenantRow[];
  /** If provided, renders a "New Tenant" button in the toolbar */
  newTenantButton?: React.ReactNode;
  /** When true, show only overview columns (no actions) */
  compact?: boolean;
  formatDate?: undefined;
  timeAgo?: undefined;
}

export function AdminTenantsTable({ data, newTenantButton, compact }: AdminTenantsTableProps) {
  const displayColumns = compact
    ? columns.filter((c) => ['name', 'plan', 'users', 'status', 'lastActivity'].includes(c.key))
    : columns;

  return (
    <DataTable<TenantRow>
      columns={displayColumns}
      data={data}
      filters={compact ? [] : filters}
      searchPlaceholder="Search by name or slug…"
      searchKeys={['name', 'slug']}
      rowLabel="tenant"
      emptyMessage="No tenants found."
      rowKey={(row) => row.id}
      toolbarRight={newTenantButto