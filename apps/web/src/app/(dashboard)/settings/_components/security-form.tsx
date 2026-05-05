'use client';

import { useState, useTransition } from 'react';

import { Badge } from '@/components/ui/badge';
import { timeAgo } from '@/lib/time';

// Standard SAML attribute URIs — static app constants, not DB data
const ATTR_MAPPINGS = [
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
];

// Supported SCIM operations — static documentation of the SCIM endpoint
const SCIM_OPS = [
  'GET /Users',
  'POST /Users',
  'PATCH /Users/:id',
  'DELETE /Users/:id',
  'GET /Groups',
  'POST /Groups',
  'PATCH /Groups/:id',
  'GET /Schemas',
  'GET /ServiceProviderConfig',
];

interface SecurityFormProps {
  appDomain: string;
  ssoConfigured: boolean;
  initialProtocol: 'SAML 2.0' | 'OIDC';
  initialIdpIssuer: string;
  initialIdpSsoUrl: string;
  initialIdpCertificate: string;
  initialSessionLifetime: string;
  initialEnforceSso: boolean;
  initialIpAllowlist: boolean;
  initialMfaRequired: boolean;
  scimConfigured: boolean;
  scimTokenName: string | null;
  scimLastUsedAt: string | null; // ISO string
  memberCount: number;
}

export function SecurityForm({
  appDomain,
  ssoConfigured,
  initialProtocol,
  initialIdpIssuer,
  initialIdpSsoUrl,
  initialIdpCertificate,
  initialSessionLifetime,
  initialEnforceSso,
  initialIpAllowlist,
  initialMfaRequired,
  scimConfigured,
  scimTokenName,
  scimLastUsedAt,
  memberCount,
}: SecurityFormProps) {
  // SSO form state
  const [protocol, setProtocol] = useState<'SAML 2.0' | 'OIDC'>(initialProtocol);
  const [idpIssuer, setIdpIssuer] = useState(initialIdpIssuer);
  const [idpSsoUrl, setIdpSsoUrl] = useState(initialIdpSsoUrl);
  const [idpCertificate, setIdpCertificate] = useState(initialIdpCertificate);
  const [ssoMsg, setSsoMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [ssoPending, startSsoTransition] = useTransition();

  // Session policy state
  const [sessionLifetime, setSessionLifetime] = useState(initialSessionLifetime);
  const [enforceSso, setEnforceSso] = useState(initialEnforceSso);
  const [ipAllowlist, setIpAllowlist] = useState(initialIpAllowlist);
  const [mfaRequired, setMfaRequired] = useState(initialMfaRequired);
  const [policyMsg, setPolicyMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [policyPending, startPolicyTransition] = useTransition();

  // SP config derived from appDomain
  const spConfig = [
    { label: 'SP Entity ID', value: `https://${appDomain}/sso/saml/metadata` },
    { label: 'ACS URL', value: `https://${appDomain}/sso/saml/acs` },
    { label: 'SLO URL', value: `https://${appDomain}/sso/saml/slo` },
  ];

  const scimEndpoint = `https://${appDomain}/scim/v2`;

  const scimLastUsed = scimLastUsedAt ? new Date(scimLastUsedAt) : null;

  function saveSso() {
    setSsoMsg(null);
    startSsoTransition(async () => {
      try {
        const res = await fetch('/api/settings/security', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ section: 'sso', protocol, idpIssuer, idpSsoUrl, idpCertificate }),
        });
        const json = (await res.json()) as { ok?: boolean; error?: string };
        if (json.ok) {
          setSsoMsg({ ok: true, text: 'SSO configuration saved.' });
        } else {
          setSsoMsg({ ok: false, text: json.error ?? 'Failed to save' });
        }
      } catch {
        setSsoMsg({ ok: false, text: 'Request failed' });
      }
    });
  }

  function savePolicy() {
    setPolicyMsg(null);
    startPolicyTransition(async () => {
      try {
        const res = await fetch('/api/settings/security', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            section: 'session',
            sessionLifetime,
            enforceSso,
            ipAllowlist,
            mfaRequired,
          }),
        });
        const json = (await res.json()) as { ok?: boolean; error?: string };
        if (json.ok) {
          setPolicyMsg({ ok: true, text: 'Session policy saved.' });
        } else {
          setPolicyMsg({ ok: false, text: json.error ?? 'Failed to save' });
        }
      } catch {
        setPolicyMsg({ ok: false, text: 'Request failed' });
      }
    });
  }

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
          className="rounded-xl border"
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
            {ssoConfigured ? (
              <Badge variant="success" dot>
                Configured
              </Badge>
            ) : (
              <Badge variant="gray" dot>
                Not configured
              </Badge>
            )}
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
                  value={protocol}
                  onChange={(e) => setProtocol(e.target.value as 'SAML 2.0' | 'OIDC')}
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
                  value={idpIssuer}
                  onChange={(e) => setIdpIssuer(e.target.value)}
                  placeholder="https://your-idp.example.com/issuer"
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
                value={idpSsoUrl}
                onChange={(e) => setIdpSsoUrl(e.target.value)}
                placeholder="https://your-idp.example.com/sso/saml"
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
                value={idpCertificate}
                onChange={(e) => setIdpCertificate(e.target.value)}
                placeholder="-----BEGIN CERTIFICATE-----"
                className="w-full resize-none rounded-xl border px-3 py-2 font-mono text-xs outline-none"
                style={{
                  borderColor: 'var(--border-default)',
                  background: 'var(--bg-main)',
                  color: 'var(--text-secondary)',
                }}
              />
            </div>

            {/* SP values (read-only, derived from appDomain) */}
            <div className="space-y-2 rounded-xl p-4" style={{ background: 'var(--bg-subtle)' }}>
              <div className="mb-2 text-xs font-bold" style={{ color: 'var(--text-secondary)' }}>
                Your SP configuration (enter these in your IdP)
              </div>
              {spConfig.map((row) => (
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
                    onClick={() => void navigator.clipboard.writeText(row.value)}
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
                {ATTR_MAPPINGS.map((m) => (
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
          {ssoMsg && (
            <div
              className="border-t px-6 py-3 text-xs"
              style={{
                borderColor: 'var(--border-light)',
                color: ssoMsg.ok ? 'var(--status-success)' : '#ef4444',
              }}
            >
              {ssoMsg.text}
            </div>
          )}
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
            <button
              onClick={saveSso}
              disabled={ssoPending}
              className="brand-gradient rounded-xl px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {ssoPending ? 'Saving…' : 'Save SSO configuration'}
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
          className="rounded-xl border"
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
                  {scimEndpoint}
                </code>
              </div>
              {scimConfigured ? (
                <Badge variant="success" dot>
                  Active
                </Badge>
              ) : (
                <Badge variant="gray" dot>
                  Not configured
                </Badge>
              )}
            </div>

            {scimConfigured && (
              <>
                <div>
                  <label
                    className="mb-1.5 block text-xs font-semibold"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    Bearer token
                    {scimTokenName && (
                      <span className="ml-1 font-normal" style={{ color: 'var(--text-muted)' }}>
                        · {scimTokenName}
                      </span>
                    )}
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
                      style={{
                        borderColor: 'var(--border-default)',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      Copy
                    </button>
                    <button className="flex-shrink-0 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-xs font-semibold text-red-600 transition-colors hover:bg-red-100">
                      Rotate
                    </button>
                  </div>
                </div>

                <div className="rounded-xl p-4" style={{ background: 'var(--bg-subtle)' }}>
                  <div
                    className="mb-2 text-xs font-bold"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    Sync status
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-center">
                    <div>
                      <div
                        className="text-sm font-extrabold"
                        style={{ color: 'var(--text-primary)' }}
                      >
                        {scimLastUsed ? timeAgo(scimLastUsed) : 'Never'}
                      </div>
                      <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        Last sync
                      </div>
                    </div>
                    <div>
                      <div
                        className="text-sm font-extrabold"
                        style={{ color: 'var(--text-primary)' }}
                      >
                        {memberCount}
                      </div>
                      <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        Users synced
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}

            {!scimConfigured && (
              <div
                className="rounded-xl p-4 text-center"
                style={{ background: 'var(--bg-subtle)' }}
              >
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  No SCIM token configured. Generate one via the API or contact support.
                </p>
              </div>
            )}

            {/* Supported operations */}
            <div>
              <div className="mb-2 text-xs font-bold" style={{ color: 'var(--text-secondary)' }}>
                Supported SCIM operations
              </div>
              <div className="flex flex-wrap gap-2">
                {SCIM_OPS.map((op) => (
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
          className="rounded-xl border"
          style={{
            background: 'var(--bg-white)',
            borderColor: 'var(--border-light)',
            boxShadow: 'var(--shadow-card)',
          }}
        >
          <div className="divide-y" style={{ borderColor: 'var(--border-light)' }}>
            <div className="flex items-center justify-between px-6 py-4">
              <div>
                <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                  Session lifetime
                </div>
                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  How long before users must re-authenticate
                </div>
              </div>
              <select
                value={sessionLifetime}
                onChange={(e) => setSessionLifetime(e.target.value)}
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
            </div>

            {(
              [
                {
                  key: 'enforceSso' as const,
                  label: 'Enforce SSO',
                  desc: 'Require all members to sign in via SSO only',
                  value: enforceSso,
                  set: setEnforceSso,
                },
                {
                  key: 'ipAllowlist' as const,
                  label: 'IP allowlist',
                  desc: 'Restrict access to specific IP ranges',
                  value: ipAllowlist,
                  set: setIpAllowlist,
                },
                {
                  key: 'mfaRequired' as const,
                  label: 'MFA required',
                  desc: 'Enforce multi-factor authentication for all members',
                  value: mfaRequired,
                  set: setMfaRequired,
                },
              ] as const
            ).map((policy) => (
              <div key={policy.key} className="flex items-center justify-between px-6 py-4">
                <div>
                  <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {policy.label}
                  </div>
                  <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {policy.desc}
                  </div>
                </div>
                <button
                  onClick={() => policy.set((v) => !v)}
                  className="relative h-5 w-10 flex-shrink-0 rounded-full transition-colors"
                  style={{
                    background: policy.value ? 'var(--brand-primary)' : 'var(--border-default)',
                  }}
                >
                  <span
                    className="absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform"
                    style={{ left: policy.value ? '22px' : '2px' }}
                  />
                </button>
              </div>
            ))}
          </div>
          {policyMsg && (
            <div
              className="border-t px-6 py-3 text-xs"
              style={{
                borderColor: 'var(--border-light)',
                color: policyMsg.ok ? 'var(--status-success)' : '#ef4444',
              }}
            >
              {policyMsg.text}
            </div>
          )}
          <div
            className="flex justify-end border-t px-6 py-4"
            style={{ borderColor: 'var(--border-light)' }}
          >
            <button
              onClick={savePolicy}
              disabled={policyPending}
              className="brand-gradient rounded-xl px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {policyPending ? 'Saving…' : 'Save session policy'}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
