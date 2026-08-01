'use client';

import { useRouter } from 'next/navigation';
import { type ChangeEvent, useState, useTransition } from 'react';

export interface AppRoleOption {
  id: string;
  name: string;
  memberCount: number;
}

export interface AppRoleMember {
  userId: string;
  email: string;
  currentRoleId: string | null;
}

async function unassign(roleId: string, userId: string) {
  const res = await fetch(`/api/team/roles/${roleId}/members/${userId}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to unassign role');
}

async function assign(roleId: string, userId: string) {
  const res = await fetch(`/api/team/roles/${roleId}/members/${userId}`, { method: 'POST' });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? 'Failed to assign role');
  }
}

function MemberRow({
  appName,
  member,
  roles,
}: {
  appName: string;
  member: AppRoleMember;
  roles: AppRoleOption[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState(member.currentRoleId ?? '');
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleChange(e: ChangeEvent<HTMLSelectElement>) {
    const nextRoleId = e.target.value;
    const previousRoleId = selected;
    setSelected(nextRoleId);
    setError(null);

    startTransition(async () => {
      try {
        if (previousRoleId && previousRoleId !== nextRoleId) {
          await unassign(previousRoleId, member.userId);
        }
        if (nextRoleId) {
          await assign(nextRoleId, member.userId);
        }
        router.refresh();
      } catch (err) {
        setSelected(previousRoleId);
        setError(err instanceof Error ? err.message : 'Something went wrong');
      }
    });
  }

  return (
    <div className="flex items-center justify-between gap-3 px-5 py-3">
      <div className="min-w-0">
        <div className="truncate text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
          {member.email}
        </div>
        {error && <p className="mt-0.5 text-xs text-red-600">{error}</p>}
      </div>
      <select
        value={selected}
        onChange={handleChange}
        disabled={isPending}
        className="min-w-[160px] rounded-lg border px-2.5 py-1.5 text-xs outline-none disabled:opacity-50"
        style={{
          borderColor: 'var(--border-light)',
          background: 'var(--bg-main)',
          color: 'var(--text-primary)',
        }}
      >
        <option value="">No {appName} role</option>
        {roles.map((role) => (
          <option key={role.id} value={role.id}>
            {role.name}
          </option>
        ))}
      </select>
    </div>
  );
}

export function AppRoleAssignments({
  appName,
  roles,
  members,
}: {
  appName: string;
  roles: AppRoleOption[];
  members: AppRoleMember[];
}) {
  if (members.length === 0) {
    return (
      <p className="px-1 text-xs" style={{ color: 'var(--text-muted)' }}>
        No active members yet.
      </p>
    );
  }

  return (
    <div
      className="overflow-hidden rounded-xl border"
      style={{
        background: 'var(--bg-white)',
        borderColor: 'var(--border-light)',
        boxShadow: 'var(--shadow-card)',
      }}
    >
      <div className="divide-y" style={{ borderColor: 'var(--border-light)' }}>
        {members.map((member) => (
          <MemberRow key={member.userId} appName={appName} member={member} roles={roles} />
        ))}
      </div>
    </div>
  );
}
