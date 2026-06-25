'use client';

import { InviteButton } from '@/components/team/invite-button';
import { Badge } from '@/components/ui/badge';
import { DataTable, type Column, type FilterConfig } from '@/components/ui/data-table';
import { EmptyState } from '@/components/ui/empty-state';

export interface MemberRow extends Record<string, unknown> {
  userId: string;
  email: string;
  status: string;
  roles: string[];
  joinedAt: string | null;
}

const roleColors: Record<string, 'purple' | 'blue' | 'default' | 'gray'> = {
  Admin: 'purple',
  'Billing Admin': 'blue',
  Member: 'default',
  Viewer: 'gray',
};

const statusVariant: Record<string, 'success' | 'warning' | 'error'> = {
  ACTIVE: 'success',
  INVITED: 'warning',
  SUSPENDED: 'error',
};

const statusLabel: Record<string, string> = {
  ACTIVE: 'Active',
  INVITED: 'Invited',
  SUSPENDED: 'Suspended',
};

function formatDateShort(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

const columns: Column<MemberRow>[] = [
  {
    key: 'email',
    label: 'Member',
    sortable: true,
    minWidth: '200px',
    render: (row) => (
      <div className="flex items-center gap-2.5">
        <div
          className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
          style={{ background: 'var(--brand-gradient)' }}
        >
          {row.email[0]?.toUpperCase() ?? '?'}
        </div>
        <div>
          <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
            {row.email}
          </div>
          <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
            ID: {row.userId.slice(0, 8)}…
          </div>
        </div>
      </div>
    ),
  },
  {
    key: 'roles',
    label: 'Role',
    sortable: true,
    render: (row) => {
      const primary = row.roles[0] ?? 'Member';
      return (
        <div className="flex flex-wrap gap-1">
          <Badge variant={roleColors[primary] ?? 'default'}>{primary}</Badge>
          {row.roles.length > 1 && (
            <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
              +{row.roles.length - 1}
            </span>
          )}
        </div>
      );
    },
  },
  {
    key: 'status',
    label: 'Status',
    sortable: true,
    render: (row) => (
      <Badge variant={statusVariant[row.status] ?? 'gray'} dot>
        {statusLabel[row.status] ?? row.status}
      </Badge>
    ),
  },
  {
    key: 'joinedAt',
    label: 'Joined',
    sortable: true,
    render: (row) => (
      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
        {row.joinedAt && row.status !== 'INVITED' ? formatDateShort(row.joinedAt) : '—'}
      </span>
    ),
  },
  {
    key: 'userId',
    label: '',
    render: (row) => (
      <div className="flex items-center justify-end gap-1.5">
        <button
          className="rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors hover:bg-gray-50"
          style={{ borderColor: 'var(--border-light)', color: 'var(--text-secondary)' }}
        >
          Edit role
        </button>
        {row.status !== 'SUSPENDED' ? (
          <button className="rounded-lg border border-red-100 bg-red-50 px-2.5 py-1 text-xs font-medium text-red-600 transition-colors hover:bg-red-100">
            Remove
          </button>
        ) : (
          <button
            className="rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors hover:bg-gray-50"
            style={{ borderColor: 'var(--border-light)', color: 'var(--text-secondary)' }}
          >
            Reinstate
          </button>
        )}
      </div>
    ),
  },
];

const filters: FilterConfig[] = [
  {
    key: 'status',
    label: 'All statuses',
    options: [
      { label: 'Active', value: 'ACTIVE' },
      { label: 'Invited', value: 'INVITED' },
      { label: 'Suspended', value: 'SUSPENDED' },
    ],
  },
];

export function TeamMembersTable({ data, tenantSlug }: { data: MemberRow[]; tenantSlug: string }) {
  return (
    <DataTable<MemberRow>
      columns={columns}
      data={data}
      filters={filters}
      searchPlaceholder="Search by email…"
      searchKeys={['email']}
      rowLabel="member"
      emptyMessage="No members found."
      emptyState={
        <EmptyState
          icon={
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
              <path d="M9 6a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM17 6a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 0 0-1.5-4.33A5 5 0 0 1 19 16v1h-6.07zM6 11a5 5 0 0 1 5 5v1H1v-1a5 5 0 0 1 5-5z" />
            </svg>
          }
          title="No members yet"
          description="Invite teammates to start collaborating in this workspace."
          action={<InviteButton tenantSlug={tenantSlug} />}
        />
      }
      rowKey={(row) => row.userId}
    />
  );
}
