'use client';

import { useCallback, useEffect, useState, useTransition } from 'react';

interface TenantMembership {
  status: string;
  tenant: { id: string; name: string; slug: string; plan: string };
}

interface LastActivity {
  createdAt: string;
  action: string;
}

interface AdminUser {
  id: string;
  externalId: string;
  email: string;
  status: 'ACTIVE' | 'SUSPENDED' | 'DELETED';
  createdAt: string;
  updatedAt: string;
  tenantUsers: TenantMembership[];
  lastActivity: LastActivity | null;
}

interface UsersData {
  users: AdminUser[];
  total: number;
  limit: number;
  offset: number;
}

const STATUS_STYLE: Record<string, { color: string; bg: string }> = {
  ACTIVE: { color: 'var(--status-success)', bg: 'rgba(22,163,74,0.1)' },
  SUSPENDED: { color: 'var(--status-warning)', bg: 'rgba(245,158,11,0.1)' },
  DELETED: { color: 'var(--text-muted)', bg: 'var(--bg-subtle)' },
};

export default function AdminUsersPage() {
  const [data, setData] = useState<UsersData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 350);
    return () => clearTimeout(t);
  }, [query]);

  const fetchUsers = useCallback(async (q: string) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ limit: '50' });
      if (q) params.set('q', q);
      const res = await fetch(`/api/admin/users?${params.toString()}`);
      if (res.ok) {
        const json = (await res.json()) as UsersData;
        setData(json);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchUsers(debouncedQuery);
  }, [debouncedQuery, fetchUsers]);

  function handleAction(userId: string, action: 'suspend' | 'reinstate') {
    setActionMsg(null);
    startTransition(async () => {
      try {
        const res = await fetch('/api/admin/users', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, action }),
        });
        const json = (await res.json()) as { ok?: boolean; status?: string; error?: string };
        if (json.ok) {
          setActionMsg(`User ${action === 'suspend' ? 'suspended' : 'reinstated'}`);
          void fetchUsers(debouncedQuery);
        } else {
          setActionMsg(`Error: ${json.error ?? 'Unknown'}`);
        }
      } catch {
        setActionMsg('Request failed');
      }
    });
  }

  return (
    <div>
      {/* Topbar */}
      <div
        className="flex flex-col gap-3 border-b px-6 py-4 sm:flex-row sm:items-center sm:justify-between"
        style={{ background: 'var(--bg-white)', borderColor: 'var(--border-light)' }}
      >
        <div>
          <h1 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>
            User Management
          </h1>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Cross-tenant user search and account actions
            {data ? ` · ${data.total.toLocaleString()} users` : ''}
          </p>
        </div>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by email…"
          className="w-full rounded-xl border px-3 py-2 text-sm outline-none sm:w-64"
          style={{
            borderColor: 'var(--border-default)',
            background: 'var(--bg-main)',
            color: 'var(--text-primary)',
          }}
        />
      </div>

      <main className="p-6">
        {actionMsg && (
          <div
            className="mb-4 rounded-xl border px-4 py-3 text-sm"
            style={{
              background: 'var(--bg-white)',
              borderColor: 'var(--border-light)',
              color: 'var(--text-secondary)',
            }}
          >
            {actionMsg}
          </div>
        )}

        <div
          className="overflow-hidden rounded-xl border"
          style={{
            background: 'var(--bg-white)',
            borderColor: 'var(--border-light)',
            boxShadow: 'var(--shadow-card)',
          }}
        >
          {isLoading ? (
            <div className="space-y-px">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 px-6 py-4">
                  <div
                    className="h-9 w-9 animate-pulse rounded-full"
                    style={{ background: 'var(--bg-subtle)' }}
                  />
                  <div className="flex-1 space-y-1.5">
                    <div
                      className="h-3 w-48 animate-pulse rounded"
                      style={{ background: 'var(--bg-subtle)' }}
                    />
                    <div
                      className="h-3 w-32 animate-pulse rounded"
                      style={{ background: 'var(--bg-subtle)' }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : data?.users.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                No users found{query ? ` matching "${query}"` : ''}.
              </p>
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: 'var(--border-light)' }}>
              {data?.users.map((user) => {
                const style = STATUS_STYLE[user.status] ?? STATUS_STYLE.ACTIVE!;
                const isExpanded = expandedUserId === user.id;
                return (
                  <div key={user.id}>
                    <div
                      className="flex cursor-pointer items-center gap-3 px-5 py-3.5 transition-colors hover:bg-gray-50"
                      onClick={() => setExpandedUserId(isExpanded ? null : user.id)}
                    >
                      {/* Avatar */}
                      <div className="brand-gradient flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold text-white">
                        {user.email[0]?.toUpperCase()}
                      </div>

                      {/* Email + meta */}
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className="text-sm font-semibold"
                            style={{ color: 'var(--text-primary)' }}
                          >
                            {user.email}
                          </span>
                          <span
                            className="rounded-md px-1.5 py-0.5 text-xs font-semibold"
                            style={{ color: style.color, background: style.bg }}
                          >
                            {user.status}
                          </span>
                        </div>
                        <div
                          className="flex flex-wrap gap-3 text-xs"
                          style={{ color: 'var(--text-muted)' }}
                        >
                          <span>
                            {user.tenantUsers.length} workspace
                            {user.tenantUsers.length !== 1 ? 's' : ''}
                          </span>
                          {user.lastActivity && (
                            <span>
                              Last: {user.lastActivity.action} ·{' '}
                              {new Date(user.lastActivity.createdAt).toLocaleDateString()}
                            </span>
                          )}
                          <span>Joined {new Date(user.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div
                        className="flex flex-shrink-0 items-center gap-1.5"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {user.status === 'ACTIVE' ? (
                          <button
                            onClick={() => handleAction(user.id, 'suspend')}
                            disabled={isPending}
                            className="rounded-lg border px-2.5 py-1 text-xs font-semibold transition-colors hover:bg-amber-50 disabled:opacity-50"
                            style={{
                              borderColor: 'rgba(245,158,11,0.3)',
                              color: 'var(--status-warning)',
                            }}
                          >
                            Suspend
                          </button>
                        ) : user.status === 'SUSPENDED' ? (
                          <button
                            onClick={() => handleAction(user.id, 'reinstate')}
                            disabled={isPending}
                            className="rounded-lg border px-2.5 py-1 text-xs font-semibold transition-colors hover:bg-green-50 disabled:opacity-50"
                            style={{
                              borderColor: 'rgba(22,163,74,0.3)',
                              color: 'var(--status-success)',
                            }}
                          >
                            Reinstate
                          </button>
                        ) : null}
                      </div>
                    </div>

                    {/* Expanded: workspace memberships */}
                    {isExpanded && (
                      <div
                        className="border-t px-5 py-3"
                        style={{ borderColor: 'var(--border-light)', background: 'var(--bg-main)' }}
                      >
                        <div
                          className="mb-2 text-xs font-bold uppercase tracking-wide"
                          style={{ color: 'var(--text-muted)' }}
                        >
                          Workspace memberships
                        </div>
                        {user.tenantUsers.length === 0 ? (
                          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                            No workspace memberships.
                          </p>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {user.tenantUsers.map((tu) => (
                              <div
                                key={tu.tenant.id}
                                className="flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs"
                                style={{
                                  borderColor: 'var(--border-light)',
                                  background: 'var(--bg-white)',
                                }}
                              >
                                <span
                                  className="font-semibold"
                                  style={{ color: 'var(--text-primary)' }}
                                >
                                  {tu.tenant.name}
                                </span>
                                <span style={{ color: 'var(--text-muted)' }}>·</span>
                                <span style={{ color: 'var(--text-muted)' }}>{tu.tenant.plan}</span>
                                <span style={{ color: 'var(--text-muted)' }}>·</span>
                                <span
                                  style={{
                                    color:
                                      tu.status === 'ACTIVE'
                                        ? 'var(--status-success)'
                                        : 'var(--text-muted)',
                                  }}
                                >
                                  {tu.status}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                        <div
                          className="mt-2 font-mono text-xs"
                          style={{ color: 'var(--text-muted)' }}
                        >
                          ID: {user.id}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
