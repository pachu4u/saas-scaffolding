'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';

const STEPS = [
  { id: 'company', label: 'Company' },
  { id: 'account', label: 'Your account' },
  { id: 'done', label: 'Done!' },
] as const;

type StepId = (typeof STEPS)[number]['id'];

interface SignupResult {
  tenantId: string;
  slug: string;
  name: string;
  workspaceUrl: string;
  message: string;
}

export default function SignupPage() {
  const [step, setStep] = useState<StepId>('company');
  const [isPending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Company step
  const [companyName, setCompanyName] = useState('');
  const [slug, setSlug] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#4F7BFF');
  const [timezone, setTimezone] = useState('UTC');

  // Account step
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Result
  const [result, setResult] = useState<SignupResult | null>(null);

  const currentIdx = STEPS.findIndex((s) => s.id === step);

  function goBack() {
    setErrorMsg(null);
    const prev = STEPS[currentIdx - 1];
    if (prev) setStep(prev.id);
  }

  function validateCompany() {
    if (!companyName.trim()) {
      setErrorMsg('Company name is required');
      return false;
    }
    if (!/^[a-z0-9-]{2,63}$/.test(slug)) {
      setErrorMsg('Slug must be 2–63 lowercase letters, numbers, or hyphens');
      return false;
    }
    return true;
  }

  function validateAccount() {
    if (!adminName.trim()) {
      setErrorMsg('Your name is required');
      return false;
    }
    if (!adminEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail)) {
      setErrorMsg('A valid email address is required');
      return false;
    }
    if (adminPassword.length < 8) {
      setErrorMsg('Password must be at least 8 characters');
      return false;
    }
    if (adminPassword !== confirmPassword) {
      setErrorMsg('Passwords do not match');
      return false;
    }
    return true;
  }

  function handleCompanyNext() {
    setErrorMsg(null);
    if (!validateCompany()) return;
    setStep('account');
  }

  function handleSubmit() {
    setErrorMsg(null);
    if (!validateAccount()) return;

    startTransition(async () => {
      try {
        const res = await fetch('/api/signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            companyName,
            slug,
            adminEmail,
            adminPassword,
            adminName,
            plan: 'free',
            primaryColor,
            timezone,
          }),
        });

        const json = (await res.json()) as SignupResult & { error?: string };

        if (!res.ok || json.error) {
          setErrorMsg(json.error ?? 'Signup failed. Please try again.');
          return;
        }

        setResult(json);
        setStep('done');
      } catch {
        setErrorMsg('Network error. Please check your connection and try again.');
      }
    });
  }

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--bg-main)' }}>
      {/* Left panel */}
      <div className="brand-gradient relative hidden w-[420px] flex-col overflow-hidden p-12 lg:flex">
        <div
          className="absolute inset-0 opacity-20"
          style={{
            background:
              'radial-gradient(circle at 20% 80%, rgba(255,255,255,0.3), transparent 50%), radial-gradient(circle at 80% 20%, rgba(255,255,255,0.2), transparent 50%)',
          }}
        />
        <div className="relative flex flex-1 flex-col">
          <div className="mb-auto flex items-center gap-2">
            <Link href="/">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/20 text-sm font-bold text-white">
                R
              </div>
            </Link>
            <Link href="/" className="text-lg font-bold text-white">
              riogentix
            </Link>
          </div>
          <div className="mb-auto space-y-8">
            <div>
              <h2 className="mb-3 text-2xl font-extrabold text-white">Start building in minutes</h2>
              <p className="text-white/80">
                Your workspace comes pre-wired with multi-tenancy, SSO, RBAC, billing, and
                observability. Skip the plumbing.
              </p>
            </div>
            <ul className="space-y-3">
              {[
                'Multi-tenant architecture with subdomain routing',
                'Keycloak SSO & SCIM provisioning',
                'RBAC + plan-gated feature entitlements',
                'Riogentix AI builder, ready to go',
              ].map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-sm text-white/90">
                  <svg
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    className="mt-0.5 h-4 w-4 flex-shrink-0 text-white/60"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
                      clipRule="evenodd"
                    />
                  </svg>
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {['SOC 2 Ready', 'GDPR Compliant', 'Enterprise SSO'].map((badge) => (
              <div key={badge} className="rounded-xl bg-white/10 p-3 text-center">
                <div className="text-xs font-semibold text-white">{badge}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="mb-8 flex items-center justify-between lg:hidden">
            <Link href="/" className="flex items-center gap-2">
              <div className="brand-gradient flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold text-white">
                R
              </div>
              <span className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                riogentix
              </span>
            </Link>
          </div>

          {step !== 'done' && (
            <>
              <h1 className="mb-1 text-2xl font-extrabold" style={{ color: 'var(--text-primary)' }}>
                {step === 'company' ? 'Create your workspace' : 'Set up your account'}
              </h1>
              <p className="mb-6 text-sm" style={{ color: 'var(--text-secondary)' }}>
                {step === 'company'
                  ? 'Your workspace will be available at slug.techhanker.com'
                  : "You'll use these credentials to sign in"}
              </p>
            </>
          )}

          {/* Progress */}
          {step !== 'done' && (
            <div className="mb-6 flex gap-2">
              {STEPS.filter((s) => s.id !== 'done').map((s, i) => (
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
          )}

          {/* Error banner */}
          {errorMsg && (
            <div className="mb-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
              {errorMsg}
            </div>
          )}

          {/* ── Step 1: Company ── */}
          {step === 'company' && (
            <div className="space-y-4">
              <div>
                <label
                  className="mb-1.5 block text-sm font-semibold"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  Company name *
                </label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => {
                    setCompanyName(e.target.value);
                    setSlug(
                      e.target.value
                        .toLowerCase()
                        .replace(/[^a-z0-9]+/g, '-')
                        .replace(/^-|-$/g, '')
                        .slice(0, 63),
                    );
                  }}
                  placeholder="Acme Corporation"
                  autoFocus
                  className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none focus:ring-2"
                  style={{
                    borderColor: 'var(--border-default)',
                    background: 'var(--bg-white)',
                    color: 'var(--text-primary)',
                  }}
                />
              </div>

              <div>
                <label
                  className="mb-1.5 block text-sm font-semibold"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  Workspace URL *
                </label>
                <div
                  className="flex overflow-hidden rounded-xl border"
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
                    *.techhanker.com/
                  </span>
                  <input
                    type="text"
                    value={slug}
                    onChange={(e) => {
                      setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''));
                    }}
                    placeholder="acme"
                    className="flex-1 px-3 py-2.5 text-sm outline-none"
                    style={{ background: 'var(--bg-white)', color: 'var(--text-primary)' }}
                  />
                </div>
                <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                  Lowercase letters, numbers, and hyphens only.
                </p>
              </div>

              <div>
                <label
                  className="mb-1.5 block text-sm font-semibold"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  Brand color
                </label>
                <div className="flex flex-wrap gap-2.5">
                  {['#4F7BFF', '#059669', '#D97706', '#E11D48', '#0891B2', '#8B5CF6'].map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => {
                        setPrimaryColor(c);
                      }}
                      className="h-8 w-8 rounded-full border-2 transition-transform hover:scale-110"
                      style={{
                        background: c,
                        borderColor: primaryColor === c ? 'var(--text-primary)' : 'transparent',
                      }}
                    />
                  ))}
                </div>
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
                    background: 'var(--bg-white)',
                    color: 'var(--text-primary)',
                  }}
                >
                  <option value="UTC">UTC</option>
                  <option value="America/New_York">America/New_York (EST/EDT)</option>
                  <option value="America/Los_Angeles">America/Los_Angeles (PST/PDT)</option>
                  <option value="Europe/London">Europe/London (GMT/BST)</option>
                  <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
                  <option value="Asia/Tokyo">Asia/Tokyo (JST)</option>
                  <option value="Asia/Singapore">Asia/Singapore (SGT)</option>
                </select>
              </div>

              <button
                type="button"
                onClick={handleCompanyNext}
                className="brand-gradient w-full rounded-xl py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
              >
                Continue →
              </button>

              <p className="text-center text-xs" style={{ color: 'var(--text-muted)' }}>
                Already have a workspace?{' '}
                <Link href="/auth/signin" className="hover:text-brand-primary underline">
                  Sign in
                </Link>
              </p>
            </div>
          )}

          {/* ── Step 2: Account ── */}
          {step === 'account' && (
            <div className="space-y-4">
              <div>
                <label
                  className="mb-1.5 block text-sm font-semibold"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  Your name *
                </label>
                <input
                  type="text"
                  value={adminName}
                  onChange={(e) => {
                    setAdminName(e.target.value);
                  }}
                  placeholder="Jane Smith"
                  autoFocus
                  className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none"
                  style={{
                    borderColor: 'var(--border-default)',
                    background: 'var(--bg-white)',
                    color: 'var(--text-primary)',
                  }}
                />
              </div>

              <div>
                <label
                  className="mb-1.5 block text-sm font-semibold"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  Work email *
                </label>
                <input
                  type="email"
                  value={adminEmail}
                  onChange={(e) => {
                    setAdminEmail(e.target.value);
                  }}
                  placeholder="jane@acme.com"
                  className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none"
                  style={{
                    borderColor: 'var(--border-default)',
                    background: 'var(--bg-white)',
                    color: 'var(--text-primary)',
                  }}
                />
              </div>

              <div>
                <label
                  className="mb-1.5 block text-sm font-semibold"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  Password *
                </label>
                <input
                  type="password"
                  value={adminPassword}
                  onChange={(e) => {
                    setAdminPassword(e.target.value);
                  }}
                  placeholder="At least 8 characters"
                  className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none"
                  style={{
                    borderColor: 'var(--border-default)',
                    background: 'var(--bg-white)',
                    color: 'var(--text-primary)',
                  }}
                />
              </div>

              <div>
                <label
                  className="mb-1.5 block text-sm font-semibold"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  Confirm password *
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                  }}
                  placeholder="Repeat your password"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !isPending) handleSubmit();
                  }}
                  className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none"
                  style={{
                    borderColor: 'var(--border-default)',
                    background: 'var(--bg-white)',
                    color: 'var(--text-primary)',
                  }}
                />
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={goBack}
                  disabled={isPending}
                  className="rounded-xl border px-4 py-2.5 text-sm font-semibold transition-colors disabled:opacity-50"
                  style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={isPending}
                  className="brand-gradient flex-1 rounded-xl py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  {isPending ? 'Creating your workspace…' : 'Create workspace →'}
                </button>
              </div>

              <p className="text-center text-xs" style={{ color: 'var(--text-muted)' }}>
                By creating an account you agree to our{' '}
                <a href="#" className="hover:text-brand-primary underline">
                  Terms
                </a>{' '}
                and{' '}
                <a href="#" className="hover:text-brand-primary underline">
                  Privacy Policy
                </a>
                .
              </p>
            </div>
          )}

          {/* ── Step 3: Done ── */}
          {step === 'done' && result && (
            <div className="text-center">
              <div
                className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full text-4xl"
                style={{ background: 'rgba(79,123,255,0.1)' }}
              >
                🎉
              </div>

              <h1 className="mb-2 text-2xl font-extrabold" style={{ color: 'var(--text-primary)' }}>
                Your workspace is ready!
              </h1>
              <p className="mb-6 text-sm" style={{ color: 'var(--text-secondary)' }}>
                <strong>{result.name}</strong> has been created and the Riogentix AI builder has
                been provisioned for your team.
              </p>

              <div
                className="mb-6 rounded-xl border p-4 text-left"
                style={{ background: 'var(--bg-subtle)', borderColor: 'var(--border-light)' }}
              >
                <p
                  className="mb-1 text-xs font-semibold uppercase tracking-wider"
                  style={{ color: 'var(--text-muted)' }}
                >
                  Workspace URL
                </p>
                <p
                  className="font-mono text-sm font-bold"
                  style={{ color: 'var(--brand-primary)' }}
                >
                  {result.workspaceUrl}
                </p>
                <p className="mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                  Sign in with the email and password you just created.
                </p>
              </div>

              <Link
                href="/auth/signin"
                className="brand-gradient mb-3 block rounded-xl py-3 text-center text-sm font-semibold text-white transition-opacity hover:opacity-90"
              >
                Sign in to your workspace →
              </Link>
              <Link href="/" className="block text-sm" style={{ color: 'var(--text-muted)' }}>
                Back to home
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
