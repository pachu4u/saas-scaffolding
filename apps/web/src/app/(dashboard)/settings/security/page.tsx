import { Badge } from '@/components/ui/badge';

export const metadata = { title: 'Security & SSO — Settings' };

export default function SecurityPage() {
  return (
    <div className="max-w-3xl space-y-6">
      {/* SAML SSO */}
      <section>
        <h2
          className="mb-3 text-xs font-bold uppercase tracking-wide"
          style={{ color: 'var(--text-muted)' }}
        >
          SAML 2.0 Single Sign-On
        </h2>
        <div
          className="rounded-2xl border"
          style={{
            background: 'var(--bg-white)',
            borderColor: 'var(--border-light)',
            boxShadow: 'var(--shadow-card)',
          }}
        >
          <div
            className="flex items-center justify-between border-b px-6 py-4"
            style={{ borderColor: 'var(--border-light)' }}
          >
            <div>
              <div className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                SAML / OIDC configuration
              </div>
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Connect to Okta, Entra ID, OneLogin, Google Workspace, or any SAML 2.0 IdP
              </div>
            </div>
            <Badge variant="success" dot>
              Configured
            </Badge>
          </div>
          <div className="space-y-4 p-6">
            <div className="grid grid-cols-2 gap-5">
              <div>
                <label
                  className="mb-1.5 block text-xs font-semibold"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  Protocol
                </label>
                <select
                  className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
                  style={{
                    borderColor: 'var(--border-default)',
                    background: 'var(--bg-main)',
                    color: 'var(--text-primary)',
                  }}
                >
                  <option>SAML 2.0</option>
                  <option>OIDC</option>
                </select>
              </div>
              <div>
                <label
                  className="mb-1.5 block text-xs font-semibold"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  IdP Issuer / Entity ID
                </label>
                <input
                  type="text"
                  defaultValue="https://okta.example.com/sso/saml"
                  className="w-full rounded-xl border px-3 py-2 font-mono text-sm outline-none"
                  style={{
                    borderColor: 'var(--border-default)',
                    background: 'var(--bg-main)',
                    color: 'var(--text-primary)',
                  }}
                />
              </div>
            </div>
            <div>
              <label
                className="mb-1.5 block text-xs font-semibold"
                style={{ color: 'var(--text-secondary)' }}
              >
                IdP SSO URL
              </label>
              <input
                type="text"
                defaultValue="https://okta.example.com/app/acme/sso/saml"
                className="w-full rounded-xl border px-3 py-2 font-mono text-sm outline-none"
                style={{
                  borderColor: 'var(--border-default)',
                  background: 'var(--bg-main)',
                  color: 'var(--text-primary)',
                }}
              />
            </div>
            <div>
              <label
                className="mb-1.5 block text-xs font-semibold"
                style={{ color: 'var(--text-secondary)' }}
              >
                IdP x.509 Certificate (PEM)
              </label>
              <textarea
                rows={3}
                defaultValue="-----BEGIN CERTIFICATE-----
MIIDpDCCAoygAwIBAgIGAV2ka+55MA0GCSqGSIb3DQEBDQUAMIG...
-----END CERTIFICATE-----"
                className="w-full resize-none rounded-xl border px-3 py-2 font-mono text-xs outline-none"
                style={{
                  borderColor: 'var(--border-default)',
                  background: 'var(--bg-main)',
                  color: 'var(--text-secondary)',
                }}
              />
            </div>

            {/* SP values (read-only) */}
            <div className="space-y-2 rounded-xl p-4" style={{ background: 'var(--bg-subtle)' }}>
              <div className="mb-2 text-xs font-bold" style={{ color: 'var(--text-secondary)' }}>
                Your SP configuration (enter these in your IdP)
              </div>
              {[
                { label: 'SP Entity ID', value: 'https://acme.riogentix.app/sso/saml/metadata' },
                { label: 'ACS URL', value: 'https://acme.riogentix.app/sso/saml/acs' },
                { label: 'SLO URL', value: 'https://acme.riogentix.app/sso/saml/slo' },
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between gap-3">
                  <span
                    className="w-24 flex-shrink-0 text-xs font-semibold"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    {row.label}
                  </span>
                  <code
                    className="flex-1 truncate font-mono text-xs"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    {row.value}
                  </code>
                  <button
                    className="hover:bg-bg-subtle flex-shrink-0 rounded-lg border px-2 py-1 text-xs transition-colors"
                    style={{ borderColor: 'var(--border-light)', color: 'var(--text-muted)' }}
                  >
                    Copy
                  </button>
                </div>
              ))}
            </div>

            {/* Attribute mapping */}
            <div>
              <div className="mb-2 text-xs font-bold" style={{ color: 'var(--text-secondary)' }}>
                Attribute mapping
              </div>
              <div className="space-y-2">
                {[
                  {
                    field: 'Email',
                    samlAttr: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress',
                  },
                  {
                    field: 'First name',
                    samlAttr: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname',
                  },
                  {
                    field: 'Last name',
                    samlAttr: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname',
                  },
                  {
                    field: 'Groups',
                    samlAttr: 'http://schemas.microsoft.com/ws/2008/06/identity/claims/groups',
                  },
                ].map((m) => (
                  <div key={m.field} className="flex items-center gap-3">
                    <span
                      className="w-20 flex-shrink-0 text-xs font-semibold"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      {m.field}
                    </span>
                    <svg className="h-3 w-3 flex-shrink-0" viewBox="0 0 12 12" fill="none">
                      <path
                        d="M2 6h8M7 3l3 3-3 3"
                        stroke="var(--text-muted)"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    <input
                      type="text"
                      defaultValue={m.samlAttr}
                      className="flex-1 rounded-lg border px-2.5 py-1.5 font-mono text-xs outline-none"
                      style={{
                        borderColor: 'var(--border-light)',
                        background: 'var(--bg-main)',
                        color: 'var(--text-secondary)',
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div
            className="flex items-center justify-between border-t px-6 py-4"
            style={{ borderColor: 'var(--border-light)' }}
          >
            <button
              className="hover:bg-bg-subtle rounded-xl border px-3 py-2 text-xs font-semibold transition-colors"
              style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}
            >
              Test connection
            </button>
            <button className="brand-gradient rounded-xl px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90">
              Save SSO configuration
            </button>
          </div>
        </div>
      </section>

      {/* SCIM */}
      <section>
        <h2
          className="mb-3 text-xs font-bold uppercase tracking-wide"
          style={{ color: 'var(--text-muted)' }}
        >
          SCIM 2.0 Provisioning
        </h2>
        <div
          className="rounded-2xl border"
          style={{
            background: 'var(--bg-white)',
            borderColor: 'var(--border-light)',
            boxShadow: 'var(--shadow-card)',
          }}
        >
          <div className="space-y-4 p-6">
            <div
              className="flex items-center justify-between rounded-xl p-3"
              style={{ background: 'var(--bg-subtle)' }}
            >
              <div>
                <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                  SCIM endpoint
                </div>
                <code className="font-mono text-xs" style={{ color: 'var(--text-secondary)' }}>
                  https://acme.riogentix.app/scim/v2
                </code>
              </div>
              <Badge variant="success" dot>
                Active
              </Badge>
            </div>

            <div>
              <label
                className="mb-1.5 block text-xs font-semibold"
                style={{ color: 'var(--text-secondary)' }}
              >
                Bearer token
              </label>
              <div className="flex items-center gap-2">
                <div
                  className="flex-1 truncate rounded-xl border px-3 py-2 font-mono text-xs"
                  style={{
                    borderColor: 'var(--border-light)',
                    background: 'var(--bg-main)',
                    color: 'var(--text-secondary)',
                  }}
                >
                  scim_••••••••••••••••••••••••••••••••
                </div>
                <button
                  className="hover:bg-bg-subtle flex-shrink-0 rounded-xl border px-3 py-2 text-xs font-semibold transition-colors"
                  style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}
                >
                  Copy
                </button>
                <button className="flex-shrink-0 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-xs font-semibold text-red-600 transition-colors hover:bg-red-100">
                  Rotate
                </button>
              </div>
            </div>

            <div className="rounded-xl p-4" style={{ background: 'var(--bg-subtle)' }}>
              <div className="mb-2 text-xs font-bold" style={{ color: 'var(--text-secondary)' }}>
                Sync status
              </div>
              <div className="grid grid-cols-3 gap-4 text-center">
                {[
                  { label: 'Last sync', value: '3 hr ago' },
                  { label: 'Users synced', value: '47' },
                  { label: 'Groups synced', value: '8' },
                ].map((s) => (
                  <div key={s.label}>
                    <div
                      className="text-sm font-extrabold"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      {s.value}
                    </div>
                    <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {s.label}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Supported operations */}
            <div>
              <div className="mb-2 text-xs font-bold" style={{ color: 'var(--text-secondary)' }}>
                Supported SCIM operations
              </div>
              <div className="flex flex-wrap gap-2">
                {[
                  'GET /Users',
                  'POST /Users',
                  'PATCH /Users/:id',
                  'DELETE /Users/:id',
                  'GET /Groups',
                  'POST /Groups',
                  'PATCH /Groups/:id',
                  'GET /Schemas',
                  'GET /ServiceProviderConfig',
                ].map((op) => (
                  <code
                    key={op}
                    className="rounded-md px-2 py-0.5 font-mono text-xs"
                    style={{
                      background: 'rgba(79, 123, 255, 0.08)',
                      color: 'var(--brand-secondary)',
                    }}
                  >
                    {op}
                  </code>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Session policy */}
      <section>
        <h2
          className="mb-3 text-xs font-bold uppercase tracking-wide"
          style={{ color: 'var(--text-muted)' }}
        >
          Session & Access Policy
        </h2>
        <div
          className="rounded-2xl border"
          style={{
            background: 'var(--bg-white)',
            borderColor: 'var(--border-light)',
            boxShadow: 'var(--shadow-card)',
          }}
        >
          <div className="divide-y" style={{ borderColor: 'var(--border-light)' }}>
            {[
              {
                label: 'Session lifetime',
                desc: 'How long before users must re-authenticate',
                control: (
                  <select
                    className="rounded-lg border px-3 py-1.5 text-xs outline-none"
                    style={{
                      borderColor: 'var(--border-light)',
                      background: 'var(--bg-main)',
                      color: 'var(--text-primary)',
                    }}
                  >
                    <option>8 hours</option>
                    <option>24 hours</option>
                    <option>7 days</option>
                    <option>30 days</option>
                  </select>
                ),
              },
              {
                label: 'Enforce SSO',
                desc: 'Require all members to sign in via SSO only',
                control: <Toggle on={true} />,
              },
              {
                label: 'IP allowlist',
                desc: 'Restrict access to specific IP ranges',
                control: <Toggle on={false} />,
              },
              {
                label: 'MFA required',
                desc: 'Enforce multi-factor authentication for all members',
                control: <Toggle on={false} />,
              },
            ].map((policy) => (
              <div key={policy.label} className="flex items-center justify-between px-6 py-4">
                <div>
                  <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {policy.label}
                  </div>
                  <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {policy.desc}
                  </div>
                </div>
                {policy.control}
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function Toggle({ on }: { on: boolean }) {
  return (
    <button
      className="relative h-5 w-10 flex-shrink-0 rounded-full transition-colors"
      style={{ background: on ? 'var(--brand-primary)' : 'var(--border-default)' }}
    >
      <span
        className="absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform"
        style={{ left: on ? '22px' : '2px' }}
      />
    </button>
  );
}
