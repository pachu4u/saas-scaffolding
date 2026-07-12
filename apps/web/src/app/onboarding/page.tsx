'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

// ────────────────────────────────────────────────────────────
// Step definitions
// ────────────────────────────────────────────────────────────
const STEPS = [
  { id: 'workspace', label: 'Workspace' },
  { id: 'invite', label: 'Invite team' },
  { id: 'branding', label: 'Branding' },
  { id: 'billing', label: 'Billing' },
  { id: 'done', label: 'Done!' },
] as const;

type StepId = (typeof STEPS)[number]['id'];

// ────────────────────────────────────────────────────────────
// Main page
// ────────────────────────────────────────────────────────────
export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<StepId>('workspace');
  const [isPending, startTransition] = useTransition();

  // Shared state collected across steps
  const [workspaceName, setWorkspaceName] = useState('');
  const [workspaceSlug, setWorkspaceSlug] = useState('');
  const [timezone, setTimezone] = useState('UTC (Coordinated Universal Time)');
  const [inviteEmails, setInviteEmails] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#4F7BFF');
  const [logoText, setLogoText] = useState('');
  const [plan, setPlan] = useState<'free' | 'pro' | 'enterprise'>('free');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const currentIdx = STEPS.findIndex((s) => s.id === step);

  function goNext() {
    setErrorMsg(null);
    const next = STEPS[currentIdx + 1];
    if (next) setStep(next.id);
  }

  function goBack() {
    setErrorMsg(null);
    const prev = STEPS[currentIdx - 1];
    if (prev) setStep(prev.id);
  }

  function saveWorkspace() {
    if (!workspaceName.trim()) {
      setErrorMsg('Workspace name is required');
      return;
    }
    if (!/^[a-z0-9-]{2,63}$/.test(workspaceSlug)) {
      setErrorMsg('Slug must be 2–63 lowercase letters, numbers, or hyphens');
      return;
    }
    startTransition(async () => {
      try {
        const res = await fetch('/api/settings/general', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: workspaceName, slug: workspaceSlug, timezone }),
        });
        const json = (await res.json()) as { ok?: boolean; error?: string };
        if (!json.ok) {
          setErrorMsg(json.error ?? 'Failed to save workspace');
          return;
        }
        goNext();
      } catch {
        setErrorMsg('Request failed');
      }
    });
  }

  async function sendInvites() {
    // Fire-and-forget; skip if empty
    const emails = inviteEmails
      .split(/[\n,;]+/)
      .map((e) => e.trim())
      .filter(Boolean);
    if (emails.length > 0) {
      try {
        await fetch('/api/team/invite', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ emails }),
        });
      } catch {
        // non-blocking
      }
    }
    goNext();
  }

  function saveBranding() {
    startTransition(async () => {
      try {
        await fetch('/api/settings/branding', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ section: 'colors', primaryColor, logoText }),
        });
      } catch {
        // non-blocking
      }
      goNext();
    });
  }

  function handleBillingChoice(chosen: 'free' | 'pro' | 'enterprise') {
    setPlan(chosen);
    if (chosen === 'free') {
      goNext();
      return;
    }
    if (chosen === 'enterprise') {
      window.open('mailto:sales@riogentix.com', '_blank');
      goNext();
      return;
    }
    // Pro → redirect to Stripe
    startTransition(async () => {
      try {
        const res = await fetch('/api/billing/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ planCode: 'pro' }),
        });
        const json = (await res.json()) as { url?: string; error?: string };
        if (json.url) {
          window.location.href = json.url;
          return;
        }
      } catch {
        // non-blocking
      }
      goNext();
    });
  }

  function finish() {
    router.push('/dashboard');
  }

  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center p-6"
      style={{ background: 'var(--bg-main)' }}
    >
      {/* Card */}
      <div
        className="w-full max-w-lg rounded-3xl border"
        style={{
          background: 'var(--bg-white)',
          borderColor: 'var(--border-light)',
          boxShadow: 'var(--shadow-brand)',
        }}
      >
        {/* Header */}
        <div className="border-b px-8 py-6" style={{ borderColor: 'var(--border-light)' }}>
          <div className="mb-1 flex items-center gap-2">
            <div className="brand-gradient flex h-7 w-7 items-center justify-center rounded-lg text-xs font-extrabold text-white">
              R
            </div>
            <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
              riogentix
            </span>
          </div>
          <h1 className="mt-3 text-xl font-extrabold" style={{ color: 'var(--text-primary)' }}>
            {step === 'done' ? "🎉 You're all set!" : "Welcome! Let's get you set up."}
          </h1>
          <p className="mt-0.5 text-sm" style={{ color: 'var(--text-muted)' }}>
            {step === 'workspace' && 'First, tell us a bit about your workspace.'}
            {step === 'invite' && 'Invite your teammates to collaborate.'}
            {step === 'branding' && 'Customize your workspace appearance.'}
            {step === 'billing' && 'Choose the plan that fits your team.'}
            {step === 'done' && 'Your workspace is ready to use.'}
          </p>
        </div>

        {/* Step progress */}
        <div className="flex gap-1.5 px-8 pt-5">
          {STEPS.map((s, i) => (
            <div key={s.id} className="flex flex-1 flex-col items-center gap-1">
              <div
                className="h-1 w-full rounded-full transition-all"
                style={{
                  background: i <= currentIdx ? 'var(--brand-primary)' : 'var(--border-light)',
                }}
              />
              <span
                className="text-xs"
                style={{
                  color: i === currentIdx ? 'var(--brand-primary)' : 'var(--text-muted)',
                  fontWeight: i === currentIdx ? 700 : 400,
                }}
              >
                {s.label}
              </span>
            </div>
          ))}
        </div>

        {/* Step content */}
        <div className="space-y-5 px-8 py-6">
          {errorMsg && (
            <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
              {errorMsg}
            </div>
          )}

          {/* Step 1: Workspace */}
          {step === 'workspace' && (
            <>
              <div>
                <label
                  className="mb-1.5 block text-sm font-semibold"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  Workspace name *
                </label>
                <input
                  type="text"
                  value={workspaceName}
                  onChange={(e) => {
                    setWorkspaceName(e.target.value);
                    // Auto-slug
                    setWorkspaceSlug(
                      e.target.value
                        .toLowerCase()
                        .replace(/[^a-z0-9]+/g, '-')
                        .replace(/^-|-$/g, '')
                        .slice(0, 63),
                    );
                  }}
                  placeholder="Acme Corporation"
                  className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none"
                  style={{
                    borderColor: 'var(--border-default)',
                    background: 'var(--bg-main)',
                    color: 'var(--text-primary)',
                  }}
                />
              </div>
              <div>
                <label
                  className="mb-1.5 block text-sm font-semibold"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  Workspace URL
                </label>
                <div
                  className="flex items-center overflow-hidden rounded-xl border"
                  style={{ borderColor: 'var(--border-default)' }}
                >
                  <span
                    className="border-r px-3 py-2.5 text-sm"
                    style={{
                      background: 'var(--bg-subtle)',
                      borderColor: 'var(--border-light)',
                      color: 'var(--text-muted)',
                    }}
                  >
                    app.riogentix.com/
                  </span>
                  <input
                    type="text"
                    value={workspaceSlug}
                    onChange={(e) => {
                      setWorkspaceSlug(e.target.value.toLowerCase());
                    }}
                    placeholder="acme"
                    className="flex-1 px-3 py-2.5 text-sm outline-none"
                    style={{ background: 'var(--bg-main)', color: 'var(--text-primary)' }}
                  />
                </div>
                <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                  Only lowercase letters, numbers, and hyphens.
                </p>
              </div>
              <div>
                <label
                  className="mb-1.5 block text-sm font-semibold"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  Timezone
                </label>
                <select
                  value={timezone}
                  onChange={(e) => {
                    setTimezone(e.target.value);
                  }}
                  className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none"
                  style={{
                    borderColor: 'var(--border-default)',
                    background: 'var(--bg-main)',
                    color: 'var(--text-primary)',
                  }}
                >
                  <option>UTC (Coordinated Universal Time)</option>
                  <option>America/New_York (EST/EDT)</option>
                  <option>America/Los_Angeles (PST/PDT)</option>
                  <option>Europe/London (GMT/BST)</option>
                  <option>Asia/Tokyo (JST)</option>
                </select>
              </div>
            </>
          )}

          {/* Step 2: Invite */}
          {step === 'invite' && (
            <>
              <div>
                <label
                  className="mb-1.5 block text-sm font-semibold"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  Team member emails
                </label>
                <textarea
                  rows={4}
                  value={inviteEmails}
                  onChange={(e) => {
                    setInviteEmails(e.target.value);
                  }}
                  placeholder={`alice@acme.com\nbob@acme.com, carol@acme.com`}
                  className="w-full resize-none rounded-xl border px-3 py-2.5 text-sm outline-none"
                  style={{
                    borderColor: 'var(--border-default)',
                    background: 'var(--bg-main)',
                    color: 'var(--text-primary)',
                  }}
                />
                <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                  Separate multiple emails with commas, semicolons, or newlines. You can also do
                  this later from the Team page.
                </p>
              </div>
              <div
                className="flex items-center gap-3 rounded-xl p-3"
                style={{ background: 'var(--bg-subtle)' }}
              >
                <svg
                  viewBox="0 0 20 20"
                  fill="var(--brand-primary)"
                  className="h-4 w-4 flex-shrink-0"
                >
                  <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                  <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                </svg>
                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                  Invitees will receive an email to join your workspace. They will need to create or
                  sign in to their account.
                </p>
              </div>
            </>
          )}

          {/* Step 3: Branding */}
          {step === 'branding' && (
            <>
              <div>
                <label
                  className="mb-1.5 block text-sm font-semibold"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  Workspace display name
                </label>
                <input
                  type="text"
                  value={logoText}
                  onChange={(e) => {
                    setLogoText(e.target.value);
                  }}
                  placeholder={workspaceName || 'Acme Corp'}
                  className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none"
                  style={{
                    borderColor: 'var(--border-default)',
                    background: 'var(--bg-main)',
                    color: 'var(--text-primary)',
                  }}
                />
                <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                  Shown in the sidebar and browser tab.
                </p>
              </div>
              <div>
                <label
                  className="mb-3 block text-sm font-semibold"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  Brand color
                </label>
                <div className="flex flex-wrap gap-3">
                  {[
                    '#4F7BFF',
                    '#059669',
                    '#D97706',
                    '#E11D48',
                    '#334155',
                    '#0891B2',
                    '#8B5CF6',
                    '#F97316',
                  ].map((c) => (
                    <button
                      key={c}
                      onClick={() => {
                        setPrimaryColor(c);
                      }}
                      className="h-9 w-9 rounded-full border-2 transition-transform hover:scale-110"
                      style={{
                        background: c,
                        borderColor: primaryColor === c ? 'var(--text-primary)' : 'transparent',
                      }}
                    />
                  ))}
                  {/* Custom color picker */}
                  <div
                    className="relative h-9 w-9 overflow-hidden rounded-full border-2"
                    style={{ borderColor: 'var(--border-light)' }}
                  >
                    <input
                      type="color"
                      value={primaryColor}
                      onChange={(e) => {
                        setPrimaryColor(e.target.value);
                      }}
                      className="absolute inset-0 h-12 w-12 -translate-x-1 -translate-y-1 cursor-pointer border-none opacity-0"
                    />
                    <div
                      className="flex h-full w-full items-center justify-center text-xs font-bold text-white"
                      style={{ background: primaryColor }}
                    >
                      ＋
                    </div>
                  </div>
                </div>
              </div>
              {/* Preview */}
              <div
                className="overflow-hidden rounded-xl border"
                style={{ borderColor: 'var(--border-light)' }}
              >
                <div
                  className="flex items-center gap-2 border-b px-3 py-2"
                  style={{ borderColor: 'var(--border-light)', background: 'var(--bg-white)' }}
                >
                  <div
                    className="flex h-5 w-5 items-center justify-center rounded text-xs font-bold text-white"
                    style={{ background: primaryColor }}
                  >
                    {(logoText || workspaceName || 'A')[0]?.toUpperCase()}
                  </div>
                  <span className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>
                    {logoText || workspaceName || 'Your Workspace'}
                  </span>
                </div>
                <div
                  className="flex items-center gap-2 px-3 py-2"
                  style={{ background: 'var(--bg-main)' }}
                >
                  <div
                    className="rounded px-2 py-1 text-xs font-bold text-white"
                    style={{ background: primaryColor }}
                  >
                    Primary button
                  </div>
                  <div
                    className="rounded border px-2 py-1 text-xs font-bold"
                    style={{ borderColor: primaryColor, color: primaryColor }}
                  >
                    Outline
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Step 4: Billing */}
          {step === 'billing' && (
            <div className="space-y-3">
              {[
                {
                  id: 'free' as const,
                  name: 'Free',
                  price: '$0',
                  period: '/mo',
                  features: ['Up to 5 users', '1 workspace', 'Basic SSO', '5,000 events/mo'],
                },
                {
                  id: 'pro' as const,
                  name: 'Pro',
                  price: '$49',
                  period: '/mo',
                  features: [
                    'Unlimited users',
                    '5 workspaces',
                    'Advanced SSO + SCIM',
                    '500k events/mo',
                    'White-label branding',
                  ],
                  highlight: true,
                },
                {
                  id: 'enterprise' as const,
                  name: 'Enterprise',
                  price: 'Custom',
                  period: '',
                  features: ['Unlimited everything', 'Dedicated infra', 'SLA', 'Custom contracts'],
                },
              ].map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    handleBillingChoice(p.id);
                  }}
                  disabled={isPending}
                  className="w-full rounded-xl border p-4 text-left transition-all hover:shadow-md disabled:opacity-50"
                  style={{
                    borderColor:
                      plan === p.id
                        ? 'var(--brand-primary)'
                        : p.highlight
                          ? 'rgba(79,123,255,0.3)'
                          : 'var(--border-light)',
                    background: p.highlight ? 'rgba(79,123,255,0.04)' : 'var(--bg-white)',
                  }}
                >
                  <div className="mb-2 flex items-center justify-between">
                    <span className="font-bold" style={{ color: 'var(--text-primary)' }}>
                      {p.name}
                      {p.highlight && (
                        <span
                          className="ml-2 rounded-full px-2 py-0.5 text-xs font-bold text-white"
                          style={{ background: 'var(--brand-primary)' }}
                        >
                          Popular
                        </span>
                      )}
                    </span>
                    <span className="font-extrabold" style={{ color: 'var(--text-primary)' }}>
                      {p.price}
                      <span className="text-xs font-normal" style={{ color: 'var(--text-muted)' }}>
                        {p.period}
                      </span>
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-0.5">
                    {p.features.map((f) => (
                      <span key={f} className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        ✓ {f}
                      </span>
                    ))}
                  </div>
                </button>
              ))}
              <p className="text-center text-xs" style={{ color: 'var(--text-muted)' }}>
                You can change your plan anytime from Billing settings.
              </p>
            </div>
          )}

          {/* Step 5: Done */}
          {step === 'done' && (
            <div className="space-y-4 text-center">
              <div
                className="mx-auto flex h-16 w-16 items-center justify-center rounded-full text-3xl"
                style={{ background: 'rgba(79,123,255,0.1)' }}
              >
                🚀
              </div>
              <div className="space-y-1">
                <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                  {workspaceName || 'Your workspace'} is ready!
                </p>
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                  Invites sent · Plan: <span className="font-semibold capitalize">{plan}</span>
                </p>
              </div>
              <div className="grid grid-cols-3 gap-3 text-center">
                {[
                  { icon: '👥', label: 'Manage team', href: '/team' },
                  { icon: '🔐', label: 'Set up SSO', href: '/settings/security' },
                  { icon: '📊', label: 'View dashboard', href: '/dashboard' },
                ].map((link) => (
                  <a
                    key={link.href}
                    href={link.href}
                    className="flex flex-col items-center gap-1.5 rounded-xl border p-3 text-xs font-semibold transition-colors hover:bg-gray-50"
                    style={{
                      borderColor: 'var(--border-light)',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    <span className="text-xl">{link.icon}</span>
                    {link.label}
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer nav */}
        {step !== 'billing' && (
          <div
            className="flex items-center justify-between border-t px-8 py-5"
            style={{ borderColor: 'var(--border-light)' }}
          >
            {currentIdx > 0 && step !== 'done' ? (
              <button
                onClick={goBack}
                disabled={isPending}
                className="rounded-xl border px-4 py-2 text-sm font-semibold transition-colors"
                style={{
                  borderColor: 'var(--border-default)',
                  color: 'var(--text-secondary)',
                }}
              >
                Back
              </button>
            ) : (
              <div />
            )}

            {step === 'workspace' && (
              <button
                onClick={() => {
                  saveWorkspace();
                }}
                disabled={isPending}
                className="brand-gradient rounded-xl px-5 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {isPending ? 'Saving…' : 'Continue →'}
              </button>
            )}
            {step === 'invite' && (
              <button
                onClick={() => void sendInvites()}
                disabled={isPending}
                className="brand-gradient rounded-xl px-5 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {inviteEmails.trim() ? 'Send invites & continue →' : 'Skip →'}
              </button>
            )}
            {step === 'branding' && (
              <button
                onClick={() => {
                  saveBranding();
                }}
                disabled={isPending}
                className="brand-gradient rounded-xl px-5 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {isPending ? 'Saving…' : 'Continue →'}
              </button>
            )}
            {step === 'done' && (
              <button
                onClick={finish}
                className="brand-gradient rounded-xl px-5 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
              >
                Go to dashboard →
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
