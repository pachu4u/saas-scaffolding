'use client';

import { useState, useEffect, useCallback } from 'react';

const allScopes = [
  { group: 'Users', scopes: ['users:read', 'users:write', 'users:delete'] },
  { group: 'Teams', scopes: ['teams:read', 'teams:write'] },
  { group: 'Billing', scopes: ['billing:read', 'billing:write'] },
  { group: 'Audit', scopes: ['audit:read'] },
  { group: 'Webhooks', scopes: ['webhooks:read', 'webhooks:write'] },
  { group: 'Analytics', scopes: ['analytics:read'] },
  { group: 'Admin', scopes: ['*'] },
];

interface ScimToken {
  id: string;
  name: string;
  scopes: string[];
  createdAt: string;
  lastUsedAt: string | null;
}

export const dynamic = 'force-dynamic';

export default function ApiKeysPage() {
  const [tokens, setTokens] = useState<ScimToken[]>([]);
  const [loading, setLoading] = useState(true);

  // Form state
  const [tokenName, setTokenName] = useState('');
  const [selectedScopes, setSelectedScopes] = useState<Set<string>>(new Set());
  const [generating, setGenerating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Newly created token shown once
  const [newToken, setNewToken] = useState<string | null>(null);

  // Revoke state
  const [revoking, setRevoking] = useState<string | null>(null);

  const fetchTokens = useCallback(async () => {
    try {
      const tenantSlug = /x-tenant-slug=([^;]+)/.exec(document.cookie)?.[1] ?? 'acme';
      const res = await fetch('/api/settings/api-keys-list', {
        headers: { 'x-tenant-slug': tenantSlug },
      });
      if (res.ok) {
        const data = (await res.json()) as ScimToken[];
        setTokens(data);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchTokens();
  }, [fetchTokens]);

  function toggleScope(scope: string) {
    setSelectedScopes((prev) => {
      const next = new Set(prev);
      if (next.has(scope)) next.delete(scope);
      else next.add(scope);
      return next;
    });
  }

  async function generateToken() {
    setFormError(null);
    if (!tokenName.trim()) {
      setFormError('Token name is required');
      return;
    }
    if (selectedScopes.size === 0) {
      setFormError('Select at least one scope');
      return;
    }

    setGenerating(true);
    try {
      const res = await fetch('/api/settings/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-tenant-slug': getTenantSlug() },
        body: JSON.stringify({ name: tokenName.trim(), scopes: [...selectedScopes] }),
      });
      const json = (await res.json()) as { token?: string; error?: string } & ScimToken;
      if (!res.ok) {
        setFormError(json.error ?? 'Failed to generate token');
        return;
      }
      setNewToken(json.token ?? null);
      setTokenName('');
      setSelectedScopes(new Set());
      // Prepend the new token to the list (without the raw token field)
      setTokens((prev) => [
        {
          id: json.id,
          name: json.name,
          scopes: json.scopes,
          createdAt: json.createdAt,
          lastUsedAt: null,
        },
        ...prev,
      ]);
    } catch {
      setFormError('Request failed');
    } finally {
      setGenerating(false);
    }
  }

  async function revokeToken(id: string) {
    setRevoking(id);
    try {
      const res = await fetch(`/api/settings/api-keys?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: { 'x-tenant-slug': getTenantSlug() },
      });
      if (res.ok) {
        setTokens((prev) => prev.filter((t) => t.id !== id));
      }
    } catch {
      // ignore
    } finally {
      setRevoking(null);
    }
  }

  function getTenantSlug() {
    return process.env.NEXT_PUBLIC_DEFAULT_TENANT_SLUG ?? 'acme';
  }

  function fmtDate(iso: string) {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  return (
    <div className="max-w-3xl space-y-6">
      {/* Newly created token banner */}
      {newToken && (
        <div
          className="rounded-xl border p-4"
          style={{ background: 'rgba(22,163,74,0.06)', borderColor: 'rgba(22,163,74,0.3)' }}
        >
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-semibold" style={{ color: 'var(--status-success)' }}>
              Token created — copy it now, it won&apos;t be shown again
            </p>
            <button
              onClick={() => {
                setNewToken(null);
              }}
              className="text-xs"
              style={{ color: 'var(--text-muted)' }}
            >
              Dismiss
            </button>
          </div>
          <div className="flex items-center gap-2">
            <code
              className="flex-1 break-all rounded-lg px-3 py-2 font-mono text-xs"
              style={{
                background: 'var(--bg-white)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-light)',
              }}
            >
              {newToken}
            </code>
            <button
              onClick={() => void navigator.clipboard.writeText(newToken)}
              className="flex-shrink-0 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors hover:bg-gray-50"
              style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}
            >
              Copy
            </button>
          </div>
        </div>
      )}

      {/* Active tokens */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2
            className="text-xs font-bold uppercase tracking-wide"
            style={{ color: 'var(--text-muted)' }}
          >
            API / SCIM Tokens
          </h2>
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {loading ? '…' : `${String(tokens.length)} token${tokens.length !== 1 ? 's' : ''}`}
          </span>
        </div>
        <div
          className="overflow-hidden rounded-xl border"
          style={{
            background: 'var(--bg-white)',
            borderColor: 'var(--border-light)',
            boxShadow: 'var(--shadow-card)',
          }}
        >
          {loading ? (
            <div className="px-6 py-8 text-center">
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                Loading…
              </p>
            </div>
          ) : tokens.length === 0 ? (
            <div className="px-6 py-10 text-center">
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                No tokens yet. Create one below.
              </p>
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: 'var(--border-light)' }}>
              {tokens.map((token) => (
                <div key={token.id} className="px-6 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex items-center gap-2">
                        <code
                          className="font-mono text-sm font-semibold"
                          style={{ color: 'var(--text-primary)' }}
                        >
                          {token.name}
                        </code>
                      </div>
                      <div className="mb-1.5 flex flex-wrap gap-1">
                        {token.scopes.map((s) => (
                          <code
                            key={s}
                            className="rounded px-1.5 py-0.5 font-mono text-xs"
                            style={{
                              background: 'var(--bg-subtle)',
                              color: 'var(--brand-secondary)',
                            }}
                          >
                            {s}
                          </code>
                        ))}
                      </div>
                      <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        Created {fmtDate(token.createdAt)} · Last used{' '}
                        {token.lastUsedAt ? fmtDate(token.lastUsedAt) : 'Never'}
                      </div>
                    </div>
                    <button
                      onClick={() => void revokeToken(token.id)}
                      disabled={revoking === token.id}
                      className="flex-shrink-0 rounded-lg border border-red-100 bg-red-50 px-2.5 py-1.5 text-xs text-red-600 transition-colors hover:bg-red-100 disabled:opacity-50"
                    >
                      {revoking === token.id ? 'Revoking…' : 'Revoke'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Create new token */}
      <section>
        <h2
          className="mb-3 text-xs font-bold uppercase tracking-wide"
          style={{ color: 'var(--text-muted)' }}
        >
          Create New Token
        </h2>
        <div
          className="rounded-xl border"
          style={{
            background: 'var(--bg-white)',
            borderColor: 'var(--border-light)',
            boxShadow: 'var(--shadow-card)',
          }}
        >
          <div className="space-y-5 p-6">
            {formError && (
              <div className="rounded-lg border border-red-100 bg-red-50 px-4 py-2 text-sm text-red-700">
                {formError}
              </div>
            )}
            <div>
              <label
                className="mb-1.5 block text-xs font-semibold"
                style={{ color: 'var(--text-secondary)' }}
              >
                Token name
              </label>
              <input
                type="text"
                value={tokenName}
                onChange={(e) => {
                  setTokenName(e.target.value);
                }}
                placeholder="my-integration-key"
                className="w-full rounded-xl border px-3 py-2 font-mono text-sm outline-none"
                style={{
                  borderColor: 'var(--border-default)',
                  background: 'var(--bg-main)',
                  color: 'var(--text-primary)',
                }}
              />
              <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                Descriptive name — e.g. &quot;okta-scim&quot; or &quot;ci-pipeline&quot;
              </p>
            </div>

            {/* Scope selector */}
            <div>
              <label
                className="mb-3 block text-xs font-semibold"
                style={{ color: 'var(--text-secondary)' }}
              >
                Permissions (scopes)
              </label>
              <div
                className="overflow-hidden rounded-xl border"
                style={{ borderColor: 'var(--border-light)' }}
              >
                <div
                  className="border-b px-4 py-2"
                  style={{ background: 'var(--bg-subtle)', borderColor: 'var(--border-light)' }}
                >
                  <span
                    className="text-xs font-semibold"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    Principle of least privilege — only grant what your integration needs
                  </span>
                </div>
                <div className="divide-y" style={{ borderColor: 'var(--border-light)' }}>
                  {allScopes.map((group) => (
                    <div key={group.group} className="flex items-start gap-4 px-4 py-3">
                      <div className="w-20 flex-shrink-0">
                        <span
                          className="text-xs font-bold"
                          style={{ color: 'var(--text-secondary)' }}
                        >
                          {group.group}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {group.scopes.map((scope) => (
                          <label key={scope} className="flex cursor-pointer items-center gap-1.5">
                            <input
                              type="checkbox"
                              checked={selectedScopes.has(scope)}
                              onChange={() => {
                                toggleScope(scope);
                              }}
                              className="h-3.5 w-3.5 rounded"
                              style={{ accentColor: 'var(--brand-primary)' }}
                            />
                            <code
                              className="font-mono text-xs"
                              style={{ color: 'var(--text-secondary)' }}
                            >
                              {scope}
                            </code>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <div
            className="flex justify-end border-t px-6 py-4"
            style={{ borderColor: 'var(--border-light)' }}
          >
            <button
              onClick={() => void generateToken()}
              disabled={generating}
              className="brand-gradient rounded-xl px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {generating ? 'Generating…' : 'Generate token'}
            </button>
          </div>
        </div>
      </section>

      {/* Security notice */}
      <div
        className="flex items-start gap-3 rounded-xl p-4"
        style={{
          background: 'rgba(220, 38, 38, 0.04)',
          border: '1px solid rgba(220, 38, 38, 0.15)',
        }}
      >
        <svg viewBox="0 0 20 20" fill="#DC2626" className="mt-0.5 h-4 w-4 flex-shrink-0">
          <path
            fillRule="evenodd"
            d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm-1-8a1 1 0 0 0-1 1v3a1 1 0 0 0 2 0V6a1 1 0 0 0-1-1z"
            clipRule="evenodd"
          />
        </svg>
        <p className="text-xs" style={{ color: '#DC2626' }}>
          <strong>Tokens grant programmatic access to your workspace.</strong> Store them in
          environment variables or secret managers — never commit to source control. Tokens are
          shown only once. If lost, revoke and regenerate.
        </p>
      </div>
    </div>
  );
}
