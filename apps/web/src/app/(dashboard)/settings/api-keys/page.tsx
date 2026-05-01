export const metadata = { title: 'API Keys — Settings' };

const apiKeys = [
  {
    name: 'webhook-prod-key',
    created: 'Apr 28, 2026',
    lastUsed: '2 min ago',
    scopes: ['webhooks:write', 'events:read'],
    expiresAt: 'Never',
    status: 'active',
  },
  {
    name: 'analytics-read',
    created: 'Feb 12, 2026',
    lastUsed: '1 hr ago',
    scopes: ['analytics:read'],
    expiresAt: 'Never',
    status: 'active',
  },
  {
    name: 'ci-deploy-token',
    created: 'Jan 5, 2026',
    lastUsed: '4 days ago',
    scopes: ['deployments:write', 'releases:write'],
    expiresAt: 'Jan 5, 2027',
    status: 'active',
  },
  {
    name: 'legacy-integration',
    created: 'Dec 1, 2025',
    lastUsed: 'Never',
    scopes: ['*'],
    expiresAt: 'Expired Mar 1, 2026',
    status: 'expired',
  },
];

const allScopes = [
  { group: 'Users', scopes: ['users:read', 'users:write', 'users:delete'] },
  { group: 'Teams', scopes: ['teams:read', 'teams:write'] },
  { group: 'Billing', scopes: ['billing:read', 'billing:write'] },
  { group: 'Audit', scopes: ['audit:read'] },
  { group: 'Webhooks', scopes: ['webhooks:read', 'webhooks:write'] },
  { group: 'Analytics', scopes: ['analytics:read'] },
  { group: 'Deployments', scopes: ['deployments:write', 'releases:write'] },
  { group: 'Admin', scopes: ['*'] },
];

export default function ApiKeysPage() {
  return (
    <div className="max-w-3xl space-y-6">
      {/* Active keys */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2
            className="text-xs font-bold uppercase tracking-wide"
            style={{ color: 'var(--text-muted)' }}
          >
            API Keys
          </h2>
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            3 active · 1 expired
          </span>
        </div>
        <div
          className="overflow-hidden rounded-2xl border"
          style={{
            background: 'var(--bg-white)',
            borderColor: 'var(--border-light)',
            boxShadow: 'var(--shadow-card)',
          }}
        >
          <div className="divide-y" style={{ borderColor: 'var(--border-light)' }}>
            {apiKeys.map((key) => (
              <div
                key={key.name}
                className="px-6 py-4"
                style={{ opacity: key.status === 'expired' ? 0.6 : 1 }}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-center gap-2">
                      <code
                        className="font-mono text-sm font-semibold"
                        style={{ color: 'var(--text-primary)' }}
                      >
                        {key.name}
                      </code>
                      {key.status === 'expired' && (
                        <span className="rounded border border-red-100 bg-red-50 px-1.5 py-0.5 text-xs font-semibold text-red-600">
                          Expired
                        </span>
                      )}
                    </div>
                    <div className="mb-1.5 flex flex-wrap gap-1">
                      {key.scopes.map((s) => (
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
                      Created {key.created} · Last used {key.lastUsed} · Expires {key.expiresAt}
                    </div>
                  </div>
                  <div className="flex flex-shrink-0 items-center gap-2">
                    {key.status === 'active' && (
                      <button
                        className="hover:bg-bg-subtle rounded-lg border px-2.5 py-1.5 text-xs transition-colors"
                        style={{
                          borderColor: 'var(--border-light)',
                          color: 'var(--text-secondary)',
                        }}
                      >
                        Rotate
                      </button>
                    )}
                    <button className="rounded-lg border border-red-100 bg-red-50 px-2.5 py-1.5 text-xs text-red-600 transition-colors hover:bg-red-100">
                      Revoke
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Create new key */}
      <section>
        <h2
          className="mb-3 text-xs font-bold uppercase tracking-wide"
          style={{ color: 'var(--text-muted)' }}
        >
          Create New API Key
        </h2>
        <div
          className="rounded-2xl border"
          style={{
            background: 'var(--bg-white)',
            borderColor: 'var(--border-light)',
            boxShadow: 'var(--shadow-card)',
          }}
        >
          <div className="space-y-5 p-6">
            <div className="grid grid-cols-2 gap-5">
              <div>
                <label
                  className="mb-1.5 block text-xs font-semibold"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  Key name
                </label>
                <input
                  type="text"
                  placeholder="my-integration-key"
                  className="w-full rounded-xl border px-3 py-2 font-mono text-sm outline-none"
                  style={{
                    borderColor: 'var(--border-default)',
                    background: 'var(--bg-main)',
                    color: 'var(--text-primary)',
                  }}
                />
                <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                  Only lowercase, hyphens, no spaces
                </p>
              </div>
              <div>
                <label
                  className="mb-1.5 block text-xs font-semibold"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  Expiration
                </label>
                <select
                  className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
                  style={{
                    borderColor: 'var(--border-default)',
                    background: 'var(--bg-main)',
                    color: 'var(--text-primary)',
                  }}
                >
                  <option>Never</option>
                  <option>30 days</option>
                  <option>90 days</option>
                  <option>1 year</option>
                  <option>Custom</option>
                </select>
              </div>
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
                    Follow the principle of least privilege — only grant what your integration needs
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
            <button className="brand-gradient rounded-xl px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90">
              Generate API key
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
          <strong>API keys grant programmatic access to your workspace.</strong> Store them in
          environment variables or secret managers — never commit them to source control. Keys are
          shown only once at creation time. If lost, rotate immediately.
        </p>
      </div>
    </div>
  );
}
