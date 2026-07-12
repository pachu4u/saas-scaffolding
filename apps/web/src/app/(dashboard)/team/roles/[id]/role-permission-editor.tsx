'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

export interface PermissionGroup {
  resource: string;
  icon: string;
  permissions: { code: string; label: string; desc: string }[];
}

interface RolePermissionEditorProps {
  roleId: string;
  isSystem: boolean;
  initialGrants: string[];
  permissionGroups: PermissionGroup[];
}

export function RolePermissionEditor({
  roleId,
  isSystem,
  initialGrants,
  permissionGroups,
}: RolePermissionEditorProps) {
  const router = useRouter();
  const [grants, setGrants] = useState<Set<string>>(new Set(initialGrants));
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggle(code: string) {
    setGrants((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }

  function save() {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/team/roles/${roleId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ permissions: Array.from(grants) }),
        });
        const json = (await res.json()) as { error?: string };
        if (!res.ok) {
          setError(json.error ?? 'Failed to save permissions');
          return;
        }
        router.refresh();
      } catch {
        setError('Request failed');
      }
    });
  }

  function remove() {
    if (!window.confirm('Delete this role? Members with it will fall back to no role.')) return;
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/team/roles/${roleId}`, { method: 'DELETE' });
        if (!res.ok) {
          const json = (await res.json().catch(() => ({}))) as { error?: string };
          setError(json.error ?? 'Failed to delete role');
          return;
        }
        router.push('/team/roles');
        router.refresh();
      } catch {
        setError('Request failed');
      }
    });
  }

  return (
    <>
      {/* Permission groups */}
      <div className="space-y-3">
        {permissionGroups.map((group) => {
          const groupGranted = group.permissions.filter((p) => grants.has(p.code)).length;
          return (
            <div
              key={group.resource}
              className="overflow-hidden rounded-xl border"
              style={{
                background: 'var(--bg-white)',
                borderColor: 'var(--border-light)',
                boxShadow: 'var(--shadow-card)',
              }}
            >
              <div
                className="flex items-center justify-between border-b px-5 py-3.5"
                style={{ borderColor: 'var(--border-light)', background: 'var(--bg-main)' }}
              >
                <div className="flex items-center gap-2">
                  <span className="text-base">{group.icon}</span>
                  <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                    {group.resource}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {groupGranted}/{group.permissions.length} granted
                  </span>
                </div>
              </div>

              <div className="divide-y" style={{ borderColor: 'var(--border-light)' }}>
                {group.permissions.map((perm) => {
                  const granted = grants.has(perm.code);
                  return (
                    <div
                      key={perm.code}
                      className="hover:bg-bg-main flex items-center gap-4 px-5 py-3.5 transition-colors"
                    >
                      <button
                        type="button"
                        onClick={() => {
                          toggle(perm.code);
                        }}
                        disabled={isPending}
                        aria-pressed={granted}
                        aria-label={`Toggle ${perm.label}`}
                        className="relative h-5 w-9 flex-shrink-0 rounded-full transition-colors disabled:opacity-50"
                        style={{
                          background: granted ? 'var(--brand-primary)' : 'var(--border-default)',
                        }}
                      >
                        <span
                          className="absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all"
                          style={{ left: granted ? '18px' : '2px' }}
                        />
                      </button>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <code
                            className="rounded px-1.5 py-0.5 font-mono text-xs"
                            style={{
                              background: granted ? 'rgba(79,123,255,0.08)' : 'var(--bg-subtle)',
                              color: granted ? 'var(--brand-primary)' : 'var(--text-muted)',
                            }}
                          >
                            {perm.code}
                          </code>
                          <span
                            className="text-sm font-semibold"
                            style={{ color: 'var(--text-primary)' }}
                          >
                            {perm.label}
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                          {perm.desc}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {error && (
        <div className="mt-3 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Save */}
      <div className="flex items-center justify-between pt-4">
        <Link
          href="/team/roles"
          className="text-sm font-semibold hover:underline"
          style={{ color: 'var(--text-muted)' }}
        >
          ← Back to roles
        </Link>
        <div className="flex gap-3">
          {!isSystem && (
            <button
              type="button"
              onClick={remove}
              disabled={isPending}
              className="rounded-xl border border-red-100 bg-red-50 px-4 py-2 text-sm font-semibold text-red-600 transition-colors hover:bg-red-100 disabled:opacity-50"
            >
              Delete role
            </button>
          )}
          <button
            type="button"
            onClick={save}
            disabled={isPending}
            className="brand-gradient rounded-xl px-5 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {isPending ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>
    </>
  );
}
