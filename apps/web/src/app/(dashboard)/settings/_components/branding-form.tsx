'use client';

import { useState, useTransition } from 'react';

// Preset color palettes — static UI constants, not DB data
const presetPalettes = [
  { name: 'Cobalt', primary: '#4F7BFF', accent: '#B06CFF', bg: '#F8F6FF' },
  { name: 'Emerald', primary: '#059669', accent: '#7C3AED', bg: '#F0FDF4' },
  { name: 'Amber', primary: '#D97706', accent: '#DC2626', bg: '#FFFBEB' },
  { name: 'Rose', primary: '#E11D48', accent: '#7C3AED', bg: '#FFF1F2' },
  { name: 'Slate', primary: '#334155', accent: '#6A6DFF', bg: '#F8FAFC' },
  { name: 'Teal', primary: '#0891B2', accent: '#8B5CF6', bg: '#F0FDFA' },
];

function matchPreset(primary: string, accent: string, bg: string): string | null {
  const match = presetPalettes.find(
    (p) =>
      p.primary.toLowerCase() === primary.toLowerCase() &&
      p.accent.toLowerCase() === accent.toLowerCase() &&
      p.bg.toLowerCase() === bg.toLowerCase(),
  );
  return match?.name ?? null;
}

interface BrandingFormProps {
  initialLogoText: string;
  initialPrimaryColor: string;
  initialAccentColor: string;
  initialBgColor: string;
  initialEmailFrom: string;
  initialEmailReply: string;
  initialEmailFooter: string;
  initialLoginHeadline: string;
  initialLoginSubheading: string;
  initialLoginTestimonial: string;
  initialSsoButtonLabel: string;
  appDomain: string;
}

export function BrandingForm({
  initialLogoText,
  initialPrimaryColor,
  initialAccentColor,
  initialBgColor,
  initialEmailFrom,
  initialEmailReply,
  initialEmailFooter,
  initialLoginHeadline,
  initialLoginSubheading,
  initialLoginTestimonial,
  initialSsoButtonLabel,
  appDomain,
}: BrandingFormProps) {
  const [primaryColor, setPrimaryColor] = useState(initialPrimaryColor);
  const [accentColor, setAccentColor] = useState(initialAccentColor);
  const [bgColor, setBgColor] = useState(initialBgColor);
  const [logoText, setLogoText] = useState(initialLogoText);
  const [emailFrom, setEmailFrom] = useState(initialEmailFrom);
  const [emailReply, setEmailReply] = useState(initialEmailReply);
  const [activePreset, setActivePreset] = useState<string | null>(
    matchPreset(initialPrimaryColor, initialAccentColor, initialBgColor),
  );
  const [activeTab, setActiveTab] = useState<'colors' | 'logo' | 'email' | 'login'>('colors');
  const [saveMsg, setSaveMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [testEmailMsg, setTestEmailMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function sendTestEmail() {
    setIsSendingTest(true);
    setTestEmailMsg(null);
    try {
      const tenantSlug = process.env.NEXT_PUBLIC_DEFAULT_TENANT_SLUG ?? 'acme';
      const res = await fetch('/api/notifications/test', {
        method: 'POST',
        headers: { 'x-tenant-slug': tenantSlug },
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      setTestEmailMsg(
        json.ok
          ? { ok: true, text: 'Test email sent — check your inbox.' }
          : { ok: false, text: json.error ?? 'Failed to send test email' },
      );
    } catch {
      setTestEmailMsg({ ok: false, text: 'Request failed' });
    } finally {
      setIsSendingTest(false);
    }
  }

  function saveBranding(
    section: 'colors' | 'logo' | 'email' | 'login',
    extra: Record<string, string> = {},
  ) {
    setSaveMsg(null);
    startTransition(async () => {
      try {
        const body: Record<string, string> = { section, ...extra };
        if (section === 'colors') {
          body.primaryColor = primaryColor;
          body.accentColor = accentColor;
          body.bgColor = bgColor;
        } else if (section === 'logo') {
          body.logoText = logoText;
        } else if (section === 'email') {
          body.emailFrom = emailFrom;
          body.emailReply = emailReply;
        }
        const res = await fetch('/api/settings/branding', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const json = (await res.json()) as { ok?: boolean; error?: string };
        if (json.ok) {
          setSaveMsg({ ok: true, text: 'Branding settings saved.' });
        } else {
          setSaveMsg({ ok: false, text: json.error ?? 'Failed to save' });
        }
      } catch {
        setSaveMsg({ ok: false, text: 'Request failed' });
      }
    });
  }

  const applyPreset = (preset: (typeof presetPalettes)[number]) => {
    setPrimaryColor(preset.primary);
    setAccentColor(preset.accent);
    setBgColor(preset.bg);
    setActivePreset(preset.name);
  };

  return (
    <div className="max-w-5xl space-y-6">
      {/* Top info banner */}
      <div
        className="flex items-start gap-3 rounded-xl p-4"
        style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-default)' }}
      >
        <svg
          viewBox="0 0 20 20"
          fill="var(--brand-secondary)"
          className="mt-0.5 h-4 w-4 flex-shrink-0"
        >
          <path
            fillRule="evenodd"
            d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0zm-7-4a1 1 0 1 1-2 0 1 1 0 0 1 2 0zM9 9a1 1 0 0 0 0 2v3a1 1 0 0 0 1 1h1a1 1 0 1 0 0-2v-3a1 1 0 0 0-1-1H9z"
            clipRule="evenodd"
          />
        </svg>
        <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
          <strong>White-label branding</strong> is available on Pro and Enterprise plans. Changes
          apply to your workspace login page, email notifications, and the app UI seen by your team
          members. Custom domain is required for the login page to show your branding.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
        {/* Left: controls */}
        <div className="space-y-5 xl:col-span-3">
          {/* Section tabs */}
          <div className="flex gap-1 rounded-xl p-1" style={{ background: 'var(--bg-subtle)' }}>
            {(
              [
                { id: 'colors', label: '🎨 Colors' },
                { id: 'logo', label: '🖼 Logo' },
                { id: 'email', label: '✉️ Email' },
                { id: 'login', label: '🔐 Login page' },
              ] as { id: 'colors' | 'logo' | 'email' | 'login'; label: string }[]
            ).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="flex-1 rounded-lg py-2 text-xs font-semibold transition-all"
                style={
                  activeTab === tab.id
                    ? {
                        background: 'var(--bg-white)',
                        color: 'var(--text-primary)',
                        boxShadow: 'var(--shadow-card)',
                      }
                    : { color: 'var(--text-muted)' }
                }
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Colors tab */}
          {activeTab === 'colors' && (
            <div
              className="rounded-xl border"
              style={{
                background: 'var(--bg-white)',
                borderColor: 'var(--border-light)',
                boxShadow: 'var(--shadow-card)',
              }}
            >
              <div className="space-y-6 p-6">
                {/* Preset palettes */}
                <div>
                  <label
                    className="mb-3 block text-xs font-semibold"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    Quick palettes
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {presetPalettes.map((p) => (
                      <button
                        key={p.name}
                        onClick={() => {
                          applyPreset(p);
                        }}
                        className="flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition-all"
                        style={{
                          borderColor: activePreset === p.name ? p.primary : 'var(--border-light)',
                          background: activePreset === p.name ? `${p.primary}15` : 'var(--bg-main)',
                          color: activePreset === p.name ? p.primary : 'var(--text-secondary)',
                        }}
                      >
                        <span className="flex gap-0.5">
                          <span
                            className="h-3 w-3 rounded-full"
                            style={{ background: p.primary }}
                          />
                          <span className="h-3 w-3 rounded-full" style={{ background: p.accent }} />
                          <span
                            className="h-3 w-3 rounded-full border"
                            style={{ background: p.bg, borderColor: 'var(--border-light)' }}
                          />
                        </span>
                        {p.name}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="border-t" style={{ borderColor: 'var(--border-light)' }} />

                {/* Custom colors */}
                <div className="grid grid-cols-1 gap-5">
                  <ColorField
                    label="Primary brand color"
                    desc="Used for buttons, links, active states, and accent elements"
                    value={primaryColor}
                    onChange={(v) => {
                      setPrimaryColor(v);
                      setActivePreset(null);
                    }}
                  />
                  <ColorField
                    label="Accent / gradient color"
                    desc="Used for gradient highlights, badges, and secondary accents"
                    value={accentColor}
                    onChange={(v) => {
                      setAccentColor(v);
                      setActivePreset(null);
                    }}
                  />
                  <ColorField
                    label="Background color"
                    desc="Page background — should be a very light tint of your brand"
                    value={bgColor}
                    onChange={(v) => {
                      setBgColor(v);
                      setActivePreset(null);
                    }}
                  />
                </div>

                {/* Generated CSS vars preview */}
                <div>
                  <label
                    className="mb-2 block text-xs font-semibold"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    Generated CSS variables
                  </label>
                  <pre
                    className="overflow-x-auto rounded-xl p-3 font-mono text-xs"
                    style={{ background: 'var(--bg-main)', color: 'var(--text-secondary)' }}
                  >
                    {`:root {
  --brand-primary: ${primaryColor};
  --brand-accent:  ${accentColor};
  --bg-main:       ${bgColor};
  --brand-gradient: linear-gradient(135deg, ${accentColor}, ${primaryColor});
}`}
                  </pre>
                </div>
              </div>
              {saveMsg && activeTab === 'colors' && (
                <div
                  className="border-t px-6 py-3 text-xs"
                  style={{
                    borderColor: 'var(--border-light)',
                    color: saveMsg.ok ? 'var(--status-success)' : '#ef4444',
                  }}
                >
                  {saveMsg.text}
                </div>
              )}
              <div
                className="flex justify-end border-t px-6 py-4"
                style={{ borderColor: 'var(--border-light)' }}
              >
                <button
                  onClick={() => saveBranding('colors')}
                  disabled={isPending}
                  className="rounded-xl px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                  style={{ background: primaryColor }}
                >
                  {isPending ? 'Saving…' : 'Save color scheme'}
                </button>
              </div>
            </div>
          )}

          {/* Logo tab */}
          {activeTab === 'logo' && (
            <div
              className="rounded-xl border"
              style={{
                background: 'var(--bg-white)',
                borderColor: 'var(--border-light)',
                boxShadow: 'var(--shadow-card)',
              }}
            >
              <div className="space-y-6 p-6">
                {/* Logo upload */}
                <div>
                  <label
                    className="mb-3 block text-xs font-semibold"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    Workspace logo
                  </label>
                  <div className="flex items-center gap-4">
                    <div
                      className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-xl text-2xl font-bold text-white"
                      style={{ background: primaryColor }}
                    >
                      {logoText[0]?.toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <div
                        className="hover:bg-bg-subtle flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-6 transition-colors"
                        style={{ borderColor: 'var(--border-default)' }}
                      >
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          className="h-8 w-8"
                          style={{ color: 'var(--text-muted)' }}
                        >
                          <path
                            d="M4 16l4.586-4.586a2 2 0 0 1 2.828 0L16 16m-2-2 1.586-1.586a2 2 0 0 1 2.828 0L20 14M14 8h.01M6 20h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2z"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                        <span
                          className="text-xs font-semibold"
                          style={{ color: 'var(--text-secondary)' }}
                        >
                          Click to upload or drag & drop
                        </span>
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                          PNG, SVG, WebP · Max 2MB · 512×512px recommended
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Favicon */}
                <div>
                  <label
                    className="mb-3 block text-xs font-semibold"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    Favicon
                  </label>
                  <div className="flex items-center gap-4">
                    <div
                      className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded text-xs font-bold text-white"
                      style={{ background: primaryColor }}
                    >
                      {logoText[0]?.toUpperCase()}
                    </div>
                    <div
                      className="hover:bg-bg-subtle flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-2 transition-colors"
                      style={{ borderColor: 'var(--border-default)' }}
                    >
                      <span
                        className="text-xs font-semibold"
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        Upload favicon
                      </span>
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        · ICO, PNG · 32×32 or 64×64px
                      </span>
                    </div>
                  </div>
                </div>

                {/* Workspace display name */}
                <div>
                  <label
                    className="mb-1.5 block text-xs font-semibold"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    Display name (shown in app header and browser tab)
                  </label>
                  <input
                    type="text"
                    value={logoText}
                    onChange={(e) => setLogoText(e.target.value)}
                    className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
                    style={{
                      borderColor: 'var(--border-default)',
                      background: 'var(--bg-main)',
                      color: 'var(--text-primary)',
                    }}
                  />
                </div>

                {/* App icon style */}
                <div>
                  <label
                    className="mb-3 block text-xs font-semibold"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    Fallback icon style (when no logo uploaded)
                  </label>
                  <div className="flex gap-3">
                    {(['rounded-lg', 'rounded-full', 'rounded-md'] as const).map((shape, i) => (
                      <button
                        key={shape}
                        className={`flex flex-col items-center gap-2 rounded-xl border p-3 text-xs font-semibold transition-all ${i === 0 ? 'ring-2' : ''}`}
                        style={{
                          borderColor: i === 0 ? primaryColor : 'var(--border-light)',
                          background: 'var(--bg-main)',
                          color: i === 0 ? primaryColor : 'var(--text-muted)',
                        }}
                      >
                        <div
                          className={`h-8 w-8 ${shape} flex items-center justify-center text-sm font-bold text-white`}
                          style={{ background: primaryColor }}
                        >
                          {logoText[0]?.toUpperCase() ?? 'A'}
                        </div>
                        {['Rounded', 'Circle', 'Square'][i]}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              {saveMsg && activeTab === 'logo' && (
                <div
                  className="border-t px-6 py-3 text-xs"
                  style={{
                    borderColor: 'var(--border-light)',
                    color: saveMsg.ok ? 'var(--status-success)' : '#ef4444',
                  }}
                >
                  {saveMsg.text}
                </div>
              )}
              <div
                className="flex justify-end border-t px-6 py-4"
                style={{ borderColor: 'var(--border-light)' }}
              >
                <button
                  onClick={() => saveBranding('logo')}
                  disabled={isPending}
                  className="rounded-xl px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                  style={{ background: primaryColor }}
                >
                  {isPending ? 'Saving…' : 'Save logo settings'}
                </button>
              </div>
            </div>
          )}

          {/* Email tab */}
          {activeTab === 'email' && (
            <div
              className="rounded-xl border"
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
                      Sender name
                    </label>
                    <input
                      type="text"
                      value={emailFrom}
                      onChange={(e) => setEmailFrom(e.target.value)}
                      placeholder="Your workspace name"
                      className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
                      style={{
                        borderColor: 'var(--border-default)',
                        background: 'var(--bg-main)',
                        color: 'var(--text-primary)',
                      }}
                    />
                    <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                      Shown as &ldquo;From: {emailFrom || 'Your name'}&rdquo;
                    </p>
                  </div>
                  <div>
                    <label
                      className="mb-1.5 block text-xs font-semibold"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      Reply-to address
                    </label>
                    <input
                      type="email"
                      value={emailReply}
                      onChange={(e) => setEmailReply(e.target.value)}
                      placeholder={`hello@${appDomain}`}
                      className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
                      style={{
                        borderColor: 'var(--border-default)',
                        background: 'var(--bg-main)',
                        color: 'var(--text-primary)',
                      }}
                    />
                  </div>
                </div>

                {/* Email header preview */}
                <div>
                  <label
                    className="mb-3 block text-xs font-semibold"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    Email header (shown at top of all notifications)
                  </label>
                  <div
                    className="overflow-hidden rounded-xl border"
                    style={{ borderColor: 'var(--border-light)' }}
                  >
                    <div
                      className="flex items-center gap-3 p-4"
                      style={{ background: primaryColor }}
                    >
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/20 text-sm font-bold text-white">
                        {logoText[0]?.toUpperCase()}
                      </div>
                      <span className="font-bold text-white">{logoText || 'Your Workspace'}</span>
                    </div>
                    <div className="p-4" style={{ background: bgColor }}>
                      <div
                        className="mb-2 h-2 w-32 rounded-full"
                        style={{ background: 'var(--border-default)' }}
                      />
                      <div
                        className="mb-2 h-2 w-48 rounded-full"
                        style={{ background: 'var(--border-light)' }}
                      />
                      <div
                        className="h-2 w-40 rounded-full"
                        style={{ background: 'var(--border-light)' }}
                      />
                    </div>
                    <div
                      className="border-t px-4 py-3 text-center text-xs"
                      style={{
                        borderColor: 'var(--border-light)',
                        color: 'var(--text-muted)',
                        background: 'var(--bg-white)',
                      }}
                    >
                      Sent by {emailFrom || logoText} · Unsubscribe
                      {emailReply ? ` · ${emailReply}` : ''}
                    </div>
                  </div>
                </div>

                {/* Custom footer text */}
                <div>
                  <label
                    className="mb-1.5 block text-xs font-semibold"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    Email footer text
                  </label>
                  <textarea
                    rows={2}
                    defaultValue={initialEmailFooter}
                    className="w-full resize-none rounded-xl border px-3 py-2 text-sm outline-none"
                    style={{
                      borderColor: 'var(--border-default)',
                      background: 'var(--bg-main)',
                      color: 'var(--text-primary)',
                    }}
                  />
                  <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                    Required for CAN-SPAM compliance. Include your physical mailing address.
                  </p>
                </div>
              </div>
              {saveMsg && activeTab === 'email' && (
                <div
                  className="border-t px-6 py-3 text-xs"
                  style={{
                    borderColor: 'var(--border-light)',
                    color: saveMsg.ok ? 'var(--status-success)' : '#ef4444',
                  }}
                >
                  {saveMsg.text}
                </div>
              )}
              {testEmailMsg && activeTab === 'email' && (
                <div
                  className="border-t px-6 py-3 text-xs"
                  style={{
                    borderColor: 'var(--border-light)',
                    color: testEmailMsg.ok ? 'var(--status-success)' : '#ef4444',
                  }}
                >
                  {testEmailMsg.text}
                </div>
              )}
              <div
                className="flex justify-end gap-2 border-t px-6 py-4"
                style={{ borderColor: 'var(--border-light)' }}
              >
                <button
                  onClick={() => void sendTestEmail()}
                  disabled={isSendingTest}
                  className="hover:bg-bg-subtle rounded-xl border px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-50"
                  style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}
                >
                  {isSendingTest ? 'Sending…' : 'Send test email'}
                </button>
                <button
                  onClick={() => saveBranding('email')}
                  disabled={isPending}
                  className="rounded-xl px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                  style={{ background: primaryColor }}
                >
                  {isPending ? 'Saving…' : 'Save email settings'}
                </button>
              </div>
            </div>
          )}

          {/* Login page tab */}
          {activeTab === 'login' && (
            <div
              className="rounded-xl border"
              style={{
                background: 'var(--bg-white)',
                borderColor: 'var(--border-light)',
                boxShadow: 'var(--shadow-card)',
              }}
            >
              <div className="space-y-5 p-6">
                <div>
                  <label
                    className="mb-1.5 block text-xs font-semibold"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    Login page headline
                  </label>
                  <input
                    type="text"
                    defaultValue={initialLoginHeadline}
                    className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
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
                    Login page subheading
                  </label>
                  <input
                    type="text"
                    defaultValue={initialLoginSubheading}
                    className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
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
                    Left panel background
                  </label>
                  <div className="flex items-center gap-3">
                    <div
                      className="h-8 w-8 rounded-lg border"
                      style={{ background: primaryColor, borderColor: 'var(--border-light)' }}
                    />
                    <select
                      className="rounded-xl border px-3 py-2 text-sm outline-none"
                      style={{
                        borderColor: 'var(--border-default)',
                        background: 'var(--bg-main)',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      <option>Solid primary color</option>
                      <option>Brand gradient</option>
                      <option>Custom image</option>
                      <option>None (right panel only)</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label
                    className="mb-1.5 block text-xs font-semibold"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    Left panel testimonial / marketing copy
                  </label>
                  <textarea
                    rows={3}
                    defaultValue={initialLoginTestimonial}
                    className="w-full resize-none rounded-xl border px-3 py-2 font-mono text-sm outline-none"
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
                    SSO button label
                  </label>
                  <input
                    type="text"
                    defaultValue={initialSsoButtonLabel}
                    className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
                    style={{
                      borderColor: 'var(--border-default)',
                      background: 'var(--bg-main)',
                      color: 'var(--text-primary)',
                    }}
                  />
                </div>
              </div>
              {saveMsg && activeTab === 'login' && (
                <div
                  className="border-t px-6 py-3 text-xs"
                  style={{
                    borderColor: 'var(--border-light)',
                    color: saveMsg.ok ? 'var(--status-success)' : '#ef4444',
                  }}
                >
                  {saveMsg.text}
                </div>
              )}
              <div
                className="flex justify-end border-t px-6 py-4"
                style={{ borderColor: 'var(--border-light)' }}
              >
                <button
                  onClick={() => saveBranding('login')}
                  disabled={isPending}
                  className="rounded-xl px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                  style={{ background: primaryColor }}
                >
                  {isPending ? 'Saving…' : 'Save login page settings'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right: live preview */}
        <div className="xl:col-span-2">
          <div className="sticky top-6">
            <div
              className="mb-3 text-xs font-semibold uppercase tracking-wide"
              style={{ color: 'var(--text-muted)' }}
            >
              Live preview
            </div>
            <div
              className="overflow-hidden rounded-xl border"
              style={{ borderColor: 'var(--border-light)', boxShadow: 'var(--shadow-brand)' }}
            >
              {/* Preview: mini nav */}
              <div
                className="flex items-center gap-2 border-b px-3 py-2"
                style={{ background: 'var(--bg-white)', borderColor: 'var(--border-light)' }}
              >
                <div className="flex gap-1">
                  {['#FF5F57', '#FEBC2E', '#28C840'].map((c) => (
                    <div key={c} className="h-2.5 w-2.5 rounded-full" style={{ background: c }} />
                  ))}
                </div>
                <div
                  className="mx-2 flex h-4 flex-1 items-center justify-center rounded-md text-center text-xs"
                  style={{ background: 'var(--bg-main)', color: 'var(--text-muted)' }}
                >
                  {appDomain}
                </div>
              </div>

              {/* Preview: app UI */}
              <div style={{ background: bgColor }}>
                {/* App header */}
                <div
                  className="flex items-center gap-2 border-b px-3 py-2"
                  style={{ borderColor: `${primaryColor}20`, background: 'var(--bg-white)' }}
                >
                  <div
                    className="flex h-5 w-5 items-center justify-center rounded text-xs font-bold text-white"
                    style={{ background: primaryColor }}
                  >
                    {logoText[0]?.toUpperCase()}
                  </div>
                  <span className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>
                    {logoText || 'Your Workspace'}
                  </span>
                </div>

                <div className="flex" style={{ minHeight: '200px' }}>
                  {/* Sidebar */}
                  <div
                    className="w-28 space-y-0.5 border-r p-2"
                    style={{ borderColor: `${primaryColor}15`, background: 'var(--bg-white)' }}
                  >
                    {['Dashboard', 'Team', 'Billing', 'Settings'].map((item, i) => (
                      <div
                        key={item}
                        className="rounded-md px-2 py-1.5 text-xs font-medium"
                        style={
                          i === 0
                            ? { background: primaryColor, color: '#fff' }
                            : { color: 'var(--text-muted)' }
                        }
                      >
                        {item}
                      </div>
                    ))}
                  </div>

                  {/* Content */}
                  <div className="flex-1 p-3">
                    <div className="mb-3 grid grid-cols-2 gap-2">
                      {[accentColor, primaryColor].map((c, i) => (
                        <div
                          key={i}
                          className="rounded-lg border p-2"
                          style={{
                            borderColor: `${primaryColor}20`,
                            background: 'var(--bg-white)',
                          }}
                        >
                          <div
                            className="mb-1.5 h-1.5 w-12 rounded-full"
                            style={{ background: 'var(--border-light)' }}
                          />
                          <div className="text-base font-extrabold" style={{ color: c }}>
                            {i === 0 ? '2.8k' : '99%'}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div
                      className="rounded-lg border p-2"
                      style={{ borderColor: `${primaryColor}20`, background: 'var(--bg-white)' }}
                    >
                      <div
                        className="mb-2 h-1.5 w-16 rounded-full"
                        style={{ background: 'var(--border-light)' }}
                      />
                      <div className="flex h-10 items-end gap-0.5">
                        {[40, 65, 45, 80, 55, 90, 70, 85, 60].map((h, i) => (
                          <div
                            key={i}
                            className="flex-1 rounded-sm"
                            style={{
                              height: `${String(h)}%`,
                              background: i >= 7 ? primaryColor : `${primaryColor}30`,
                            }}
                          />
                        ))}
                      </div>
                    </div>
                    {/* Button preview */}
                    <div className="mt-2 flex gap-1.5">
                      <div
                        className="rounded px-2 py-1 text-xs font-bold text-white"
                        style={{ background: primaryColor }}
                      >
                        Primary
                      </div>
                      <div
                        className="rounded border px-2 py-1 text-xs font-bold"
                        style={{ borderColor: primaryColor, color: primaryColor }}
                      >
                        Outline
                      </div>
                      <div
                        className="rounded px-2 py-1 text-xs font-bold"
                        style={{ background: `${accentColor}18`, color: accentColor }}
                      >
                        Accent
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Login preview */}
            <div
              className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wide"
              style={{ color: 'var(--text-muted)' }}
            >
              Login page preview
            </div>
            <div
              className="overflow-hidden rounded-xl border"
              style={{ borderColor: 'var(--border-light)', boxShadow: 'var(--shadow-card)' }}
            >
              <div className="flex" style={{ minHeight: '120px' }}>
                <div
                  className="flex flex-1 flex-col justify-between p-3"
                  style={{ background: primaryColor }}
                >
                  <div className="flex items-center gap-1.5">
                    <div className="flex h-4 w-4 items-center justify-center rounded bg-white/20 text-xs font-bold text-white">
                      {logoText[0]?.toUpperCase()}
                    </div>
                    <span className="text-xs font-bold text-white">{logoText}</span>
                  </div>
                  <div className="text-xs leading-relaxed text-white/80">
                    &ldquo;Great platform for enterprise teams.&rdquo;
                  </div>
                </div>
                <div
                  className="flex flex-1 flex-col justify-center gap-2 p-3"
                  style={{ background: bgColor }}
                >
                  <div
                    className="h-2 w-20 rounded-full"
                    style={{ background: 'var(--border-default)' }}
                  />
                  <div className="h-6 rounded-lg" style={{ background: primaryColor }} />
                  <div
                    className="mx-auto h-1.5 w-16 rounded-full"
                    style={{ background: 'var(--border-light)' }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ColorField({
  label,
  desc,
  value,
  onChange,
}: {
  label: string;
  desc: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-4">
      <div className="relative flex-shrink-0">
        <div
          className="h-10 w-10 overflow-hidden rounded-xl border-2"
          style={{ borderColor: 'var(--border-light)' }}
        >
          <input
            type="color"
            value={value}
            onChange={(e) => {
              onChange(e.target.value);
            }}
            className="h-12 w-12 -translate-x-1 -translate-y-1 cursor-pointer border-none outline-none"
            style={{ background: 'transparent' }}
          />
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-0.5 flex items-center gap-2">
          <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            {label}
          </span>
          <code
            className="rounded px-1.5 py-0.5 font-mono text-xs"
            style={{ background: 'var(--bg-subtle)', color: 'var(--text-secondary)' }}
          >
            {value}
          </code>
        </div>
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          {desc}
        </p>
      </div>
      <div className="h-8 w-8 flex-shrink-0 rounded-lg" style={{ background: value }} />
    </div>
  );
}
