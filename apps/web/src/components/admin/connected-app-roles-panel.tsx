'use client';

import { useRouter } from 'next/navigation';
import { type ChangeEvent, useState, useTransition } from 'react';

interface AppRole {
  id: string;
  name: string;
  memberCount: number;
}

function RoleCard({ appId, role }: { appId: string; role: AppRole }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleDelete() {
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/admin/connected-apps/${appId}/roles/${role.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? 'Failed to delete');
        return;
      }
      router.refresh();
    });
  }

  return (
    <div
      className="rounded-xl border p-4"
      style={{
        background: 'var(--bg-white)',
        borderColor: 'var(--border-light)',
        boxShadow: 'var(--shadow-card)',
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
            {role.name}
          </span>
          <span className="ml-2 text-xs" style={{ color: 'var(--text-muted)' }}>
            {role.memberCount} member{role.memberCount === 1 ? '' : 's'} across all tenants
          </span>
        </div>
        <button
          onClick={handleDelete}
          disabled={isPending || role.memberCount > 0}
          title={role.memberCount > 0 ? 'Unassign all members first' : undefined}
          className="text-xs disabled:opacity-40"
          style={{ color: 'var(--status-error)' }}
        >
          Delete
        </button>
      </div>

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}

function CreateRoleCard({ appId }: { appId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleCreate() {
    setError(null);
    if (!name.trim()) {
      setError('Name is required.');
      return;
    }
    startTransition(async () => {
      const res = await fetch(`/api/admin/connected-apps/${appId}/roles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? 'Failed to create role');
        return;
      }
      setName('');
      setOpen(false);
      router.refresh();
    });
  }

  if (!open) {
    return (
      <button
        onClick={() => {
          setOpen(true);
        }}
        className="flex min-h-[110px] items-center justify-center rounded-xl border border-dashed text-sm font-medium transition-colors hover:bg-gray-50"
        style={{ borderColor: 'var(--border-default)', color: 'var(--brand-primary)' }}
      >
        + Add app role
      </button>
    );
  }

  return (
    <div
      className="rounded-xl border p-4"
      style={{
        background: 'var(--bg-white)',
        borderColor: 'var(--brand-primary)',
        boxShadow: 'var(--shadow-card)',
      }}
    >
      <input
        value={name}
        onChange={(e: ChangeEvent<HTMLInputElement>) => {
          setName(e.target.value);
        }}
        placeholder="Role name, e.g. reports_viewer"
        className="focus:border-brand-primary w-full rounded-xl border px-3 py-2 text-sm outline-none"
        style={{ borderColor: 'var(--border-light)', background: 'var(--bg-main)' }}
      />
      <p className="mt-1.5 text-[11px]" style={{ color: 'var(--text-muted)' }}>
        Permissions for this role are configured inside the app itself, not here.
      </p>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      <div className="mt-3 flex justify-end gap-3">
        <button
          onClick={() => {
            setOpen(false);
            setError(null);
          }}
          className="text-xs"
          style={{ color: 'var(--text-muted)' }}
        >
          Cancel
        </button>
        <button
          onClick={handleCreate}
          disabled={isPending}
          className="text-xs font-semibold"
          style={{ color: 'var(--brand-primary)' }}
        >
          {isPending ? 'Creating…' : 'Create role'}
        </button>
      </div>
    </div>
  );
}

export function ConnectedAppRolesPanel({ appId, roles }: { appId: string; roles: AppRole[] }) {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
      {roles.map((role) => (
        <RoleCard key={role.id} appId={appId} role={role} />
      ))}
      <CreateRoleCard appId={appId} />
    </div>
  );
}
