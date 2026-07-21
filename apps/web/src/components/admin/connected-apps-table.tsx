'use client';

import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { DataTable, type Column } from '@/components/ui/data-table';

export interface ConnectedAppRow extends Record<string, unknown> {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  status: string;
  instanceCount: number;
  roleCount: number;
  createdAt: string;
}

function formatDateShort(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

const columns: Column<ConnectedAppRow>[] = [
  {
    key: 'name',
    label: 'App',
    sortable: true,
    minWidth: '220px',
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
    key: 'description',
    label: 'Description',
    render: (row) => (
      <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
        {row.description ?? '—'}
      </span>
    ),
  },
  {
    key: 'instanceCount',
    label: 'Tenants connected',
    sortable: true,
    render: (row) => (
      <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
        {row.instanceCount}
      </span>
    ),
  },
  {
    key: 'roleCount',
    label: 'App roles',
    sortable: true,
    render: (row) => (
      <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
        {row.roleCount}
      </span>
    ),
  },
  {
    key: 'status',
    label: 'Status',
    sortable: true,
    render: (row) => (
      <Badge variant={row.status === 'ACTIVE' ? 'success' : 'gray'} dot>
        {row.status.charAt(0) + row.status.slice(1).toLowerCase()}
      </Badge>
    ),
  },
  {
    key: 'createdAt',
    label: 'Added',
    sortable: true,
    render: (row) => (
      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
        {formatDateShort(row.createdAt)}
      </span>
    ),
  },
  {
    key: 'id',
    label: '',
    render: (row) => (
      <div className="flex items-center justify-end">
        <Link
          href={`/admin/connected-apps/${row.id}`}
          className="rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors hover:bg-gray-50"
          style={{ borderColor: 'var(--border-light)', color: 'var(--text-secondary)' }}
          onClick={(e) => {
            e.stopPropagation();
          }}
        >
          Configure
        </Link>
      </div>
    ),
  },
];

export function ConnectedAppsTable({ data }: { data: ConnectedAppRow[] }) {
  return (
    <DataTable<ConnectedAppRow>
      columns={columns}
      data={data}
      searchPlaceholder="Search by name or slug…"
      searchKeys={['name', 'slug']}
      rowLabel="app"
      emptyMessage="No connected apps registered yet."
      rowKey={(row) => row.id}
    />
  );
}
