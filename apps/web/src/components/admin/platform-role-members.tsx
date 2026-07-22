'use client';

import { useEffect, useState } from 'react';

interface Member {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  enabled: boolean;
}

export function PlatformRoleMembers({ role, canManage }: { role: string; canManage: boolean }) {
  const [members, setMembers] = useState<Member[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const res = await fetch(`/api/admin/roles/${role}/members`);
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? 'Failed to load members');
        return;
      }
      setMembers((await res.json()) as Member[]);
      setError(null);
    } catch {
      setError('Failed to load members');
    }
  }

  useEffect(() => {
    void load();
  }, [role]);

  async function grant() {
    const trimmed = email.trim();
    if (!trimmed) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/roles/${role}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmed }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? 'Failed to grant access');
        return;
      }
      setEmail('');
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function revoke(userId: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/roles/${role}/members/${userId}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? 'Failed to revoke access');
        return;
      }
      await load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 border-t pt-3" style={{ borderColor: 'var(--border-light)' }}>
      <p
        className="mb-2 text-[11px] font-semibold uppercase tracking-wide"
        style={{ color: 'var(--text-muted)' }}
      >
        Members
      </p>

      {members === null && !error && (
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          Loading…
        </p>
      )}

      {members?.length === 0 && (
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          No members in this group.
        </p>
      )}

      {members && members.length > 0 && (
        <ul className="space-y-1.5">
          {members.map((m) => (
            <li key={m.id} className="flex items-center justify-between gap-2 text-xs">
              <span style={{ color: 'var(--text-secondary)' }}>
                {m.email ?? m.id}
                {!m.enabled && (
                  <span className="ml-1.5" style={{ color: 'var(--status-error)' }}>
                    (disabled)
                  </span>
                )}
              </span>
              {canManage && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    void revoke(m.id);
                  }}
                  className="font-medium disabled:opacity-50"
                  style={{ color: 'var(--status-error)' }}
                >
                  Revoke
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {error && (
        <p className="mt-2 text-xs" style={{ color: 'var(--status-error)' }}>
          {error}
        </p>
      )}

      {canManage && (
        <div className="mt-3 flex items-center gap-2">
          <input
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
            }}
            placeholder="user@example.com"
            className="flex-1 rounded-lg border px-2.5 py-1.5 text-xs outline-none"
            style={{ borderColor: 'var(--border-light)', color: 'var(--text-primary)' }}
          />
          <button
            type="button"
            disabled={busy || !email.trim()}
            onClick={() => {
              void grant();
            }}
            className="rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
            style={{ background: 'var(--brand-secondary)', color: 'white' }}
          >
            Grant
          </button>
        </div>
      )}
    </div>
  );
}
