'use client';

import { useRouter } from 'next/navigation';
import { type ChangeEvent, type KeyboardEvent, useState, useTransition } from 'react';

interface AppRole {
  id: string;
  name: string;
  memberCount: number;
  permissions: string[];
}

function PermissionTagInput({
  tags,
  onChange,
}: {
  tags: string[];
  onChange: (tags: string[]) => void;
}) {
  const [draft, setDraft] = useState('');

  function commit() {
    const value = draft.trim();
    if (value && !tags.includes(value)) onChange([...tags, value]);
    setDraft('');
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      commit();
    } else if (e.key === 'Backspace' && draft === '' && tags.length > 0) {
      onChange(tags.slice(0, -1));
    }
  }

  return (
    <div>
      <div
        className="flex flex-wrap items-center gap-1.5 rounded-xl border px-2.5 py-2"
        style={{ borderColor: 'var(--border-light)', background: 'var(--bg-main)' }}
      >
        {tags.map((tag) => (
          <span
            key={tag}
            className="flex items-center gap-1 rounded-lg px-2 py-0.5 font-mono text-[11px]"
            style={{ background: 'var(--bg-subtle)', color: 'var(--brand-secondary)' }}
          >
            {tag}
            <button
              type="button"
              onClick={() => {
                onChange(tags.filter((t) => t !== tag));
              }}
              style={{ color: 'var(--text-muted)' }}
            >
              ×
            </button>
          </span>
        ))}
        <input
          value={draft}
          onChange={(e: ChangeEvent<HTMLInputElement>) => {
            setDraft(e.target.value);
          }}
          onKeyDown={handleKeyDown}
          onBlur={commit}
          placeholder={tags.length === 0 ? 'e.g. reports:view' : 'Add another…'}
          className="min-w-[120px] flex-1 bg-transparent text-xs outline-none"
          style={{ color: 'var(--text-primary)' }}
        />
      </div>
      <p className="mt-1 text-[11px]" style={{ color: 'var(--text-muted)' }}>
        Opaque permission codes passed to the app via SCIM — press Enter or comma to add.
      </p>
    </div>
  );
}

function RoleCard({ appId, role }: { appId: string; role: AppRole }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [permissions, setPermissions] = useState(role.permissions);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSave() {
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/admin/connected-apps/${appId}/roles/${role.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ permissions }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? 'Failed to save');
        return;
      }
      setEditing(false);
      router.refresh();
    });
  }

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
      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
            {role.name}
          </span>
          <span className="ml-2 text-xs" style={{ color: 'var(--text-muted)' }}>
            {role.memberCount} member{role.memberCount === 1 ? '' : 's'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {editing ? (
            <>
              <button
                onClick={() => {
                  setEditing(false);
                  setPermissions(role.permissions);
                }}
                className="text-xs"
                style={{ color: 'var(--text-muted)' }}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={isPending}
                className="text-xs font-semibold"
                style={{ color: 'var(--brand-primary)' }}
              >
                {isPending ? 'Saving…' : 'Save'}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => {
                  setEditing(true);
                }}
                className="text-xs font-semibold"
                style={{ color: 'var(--brand-primary)' }}
              >
                Edit
              </button>
              <button
                onClick={handleDelete}
                disabled={isPending || role.memberCount > 0}
                title={role.memberCount > 0 ? 'Unassign all members first' : undefined}
                className="text-xs disabled:opacity-40"
                style={{ color: 'var(--status-error)' }}
              >
                Delete
              </button>
            </>
          )}
        </div>
      </div>

      {editing ? (
        <PermissionTagInput tags={permissions} onChange={setPermissions} />
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {role.permissions.length === 0 ? (
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              No permissions
            </span>
          ) : (
            role.permissions.map((code) => (
              <code
                key={code}
                className="rounded-lg px-2 py-0.5 font-mono text-[11px]"
                style={{ background: 'var(--bg-subtle)', color: 'var(--brand-secondary)' }}
              >
                {code}
              </code>
            ))
          )}
        </div>
      )}

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}

function CreateRoleCard({ appId }: { appId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [permissions, setPermissions] = useState<string[]>([]);
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
        body: JSON.stringify({ name, permissions }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? 'Failed to create role');
        return;
      }
      setName('');
      setPermissions([]);
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
        className="focus:border-brand-primary mb-2 w-full rounded-xl border px-3 py-2 text-sm outline-none"
        style={{ borderColor: 'var(--border-light)', background: 'var(--bg-main)' }}
      />
      <PermissionTagInput tags={permissions} onChange={setPermissions} />
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
