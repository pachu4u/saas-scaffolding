'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { ChangeRoleModal } from '@/components/modals/change-role-modal';
import { InviteButton } from '@/components/team/invite-button';
import { Badge } from '@/components/ui/badge';

export interface HubMember {
  userId: string;
  email: string;
  status: string;
  roleName: string;
  roleLabel: string;
}

const roleBadgeVariant: Record<string, 'purple' | 'blue' | 'default' | 'gray'> = {
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

export function HubTeamPanel({
  members,
  tenantSlug,
  viewAllHref,
}: {
  members: HubMember[];
  tenantSlug: string;
  viewAllHref: string;
}) {
  const router = useRouter();
  const [editingMember, setEditingMember] = useState<HubMember | null>(null);
  const visible = members.slice(0, 6);
  const remaining = members.length - visible.length;

  return (
    <div
      className="rounded-xl border p-5"
      style={{
        background: 'var(--bg-white)',
        borderColor: 'var(--border-light)',
        boxShadow: 'var(--shadow-card)',
      }}
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
            Team & Access
          </h2>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Invite members and assign roles without leaving this page
          </p>
        </div>
        <InviteButton tenantSlug={tenantSlug} />
      </div>

      {visible.length === 0 ? (
        <div
          className="rounded-lg p-6 text-center text-xs"
          style={{ background: 'var(--bg-subtle)', color: 'var(--text-muted)' }}
        >
          No members yet — invite your first teammate above.
        </div>
      ) : (
        <div className="space-y-1">
          {visible.map((m) => (
            <div
              key={m.userId}
              className="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-gray-50"
            >
              <div className="brand-gradient flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold text-white">
                {m.email[0]?.toUpperCase() ?? '?'}
              </div>
              <div className="min-w-0 flex-1">
                <div
                  className="truncate text-sm font-medium"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {m.email}
                </div>
              </div>
              <Badge variant={statusVariant[m.status] ?? 'gray'} dot>
                {m.status === 'ACTIVE'
                  ? 'Active'
                  : m.status === 'INVITED'
                    ? 'Invited'
                    : 'Suspended'}
              </Badge>
              <Badge variant={roleBadgeVariant[m.roleLabel] ?? 'default'}>{m.roleLabel}</Badge>
              <button
                onClick={() => {
                  setEditingMember(m);
                }}
                className="flex-shrink-0 rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors hover:bg-gray-100"
                style={{ borderColor: 'var(--border-light)', color: 'var(--text-secondary)' }}
              >
                Change role
              </button>
            </div>
          ))}
        </div>
      )}

      <a
        href={viewAllHref}
        className="mt-4 block text-center text-xs font-semibold hover:underline"
        style={{ color: 'var(--brand-primary)' }}
      >
        {remaining > 0 ? `View all members (+${String(remaining)} more) →` : 'View all members →'}
      </a>

      {editingMember && (
        <ChangeRoleModal
          tenantSlug={tenantSlug}
          member={{
            userId: editingMember.userId,
            name: editingMember.email,
            email: editingMember.email,
            currentRole: editingMember.roleName,
          }}
          onClose={() => {
            setEditingMember(null);
          }}
          onSuccess={() => {
            setEditingMember(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
