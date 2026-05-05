'use client';

import { useState, useTransition } from 'react';

interface SettingsFormProps {
  initialName: string;
  initialSlug: string;
  initialDescription: string;
  initialTimezone: string;
  customDomains: string[];
}

export default function SettingsForm({
  initialName,
  initialSlug,
  initialDescription,
  initialTimezone,
  customDomains,
}: SettingsFormProps) {
  const [name, setName] = useState(initialName);
  const [slug, setSlug] = useState(initialSlug);
  const [description, setDescription] = useState(initialDescription);
  const [timezone, setTimezone] = useState(initialTimezone || 'UTC (Coordinated Universal Time)');
  const [saveMsg, setSaveMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  const [notifPrefs, setNotifPrefs] = useState({
    securityAlerts: true,
    billingEvents: true,
    memberActivity: false,
    webhookFailures: true,
  });
  const [notifMsg, setNotifMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [notifPending, startNotifTransition] = useTransition();

  function saveGeneral() {
    setSaveMsg(null);
    startTransition(async () => {
      try {
        const res = await fetch('/api/settings/general', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, slug, description, timezone }),
        });
        const json = (await res.json()) as { ok?: boolean; error?: string };
        if (json.ok) {
          setSaveMsg({ ok: true, text: 'Workspace settings saved.' });
        } else {
          setSaveMsg({ ok: false, text: json.error ?? 'Failed to save' });
        }
      } catch {
        setSaveMsg({ ok: false, text: 'Request failed' });
      }
    });
  }

  function saveNotifications() {
    setNotifMsg(null);
    startNotifTransition(async () => {
      try {
        const res = await fetch('/api/settings/general', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ notifPrefs }),
        });
        const json = (await res.json()) as { ok?: boolean; error?: string };
        if (json.ok) {
          setNotifMsg({ ok: true, text: 'Notification preferences saved.' });
        } else {
          setNotifMsg({ ok: false, text: json.error ?? 'Failed to save' });
        }
      } catch {
        setNotifMsg({ ok: false, text: 'Request failed' });
      }
    });
  }

  const NOTIF_PREFS = [
    {
      key: 'securityAlerts' as const,
      label: 'Security alerts',
      desc: 'Unusual sign-ins, new API keys, SCIM token rotation',
    },
    {
      key: 'billingEvents' as const,
      label: 'Billing events',
      desc: 'Invoice generated, payment failed, plan changed',
    },
    {
      key: 'memberActivity' as const,
      label: 'Member activity',
      desc: 'New invitations accepted, role changes',
    },
    {
      key: 'webhookFailures' as const,
      label: 'Webhook failures',
      desc: 'Delivery failures after max retries',
    },
  ];

  return (
    <div className="max-w-3xl space-y-6">
      {/* Workspace info */}
      <section>
        <h2
          className="mb-3 text-xs font-bold uppercase tracking-wide"
          style={{ color: 'var(--text-muted)' }}
        >
          Workspace
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
            <div className="grid grid-cols-2 gap-5">
              <div>
                <label
                  className="mb-1.5 block text-xs font-semibold"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  Workspace name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
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
                  Workspace slug
                </label>
                <div
                  className="flex items-center overflow-hidden rounded-xl border"
                  style={{ borderColor: 'var(--border-default)' }}
                >
                  <span
                    className="border-r px-3 py-2 text-sm"
                    style={{
                      background: 'var(--bg-subtle)',
                      borderColor: 'var(--border-light)',
                      color: 'var(--text-muted)',
                    }}
                  >
                    app/
                  </span>
                  <input
                    type="text"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    className="flex-1 px-3 py-2 text-sm outline-none"
                    style={{ background: 'var(--bg-main)', color: 'var(--text-primary)' }}
                  />
                </div>
              </div>
            </div>
            <div>
              <label
                className="mb-1.5 block text-xs font-semibold"
                style={{ color: 'var(--text-secondary)' }}
              >
                Description
              </label>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full resize-none rounded-xl border px-3 py-2 text-sm outline-none"
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
                Timezone
              </label>
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
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
          </div>
          {saveMsg && (
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
              onClick={saveGeneral}
              disabled={isPending}
              className="brand-gradient rounded-xl px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {isPending ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </div>
      </section>

      {/* Custom domain */}
      <section>
        <h2
          className="mb-3 text-xs font-bold uppercase tracking-wide"
          style={{ color: 'var(--text-muted)' }}
        >
          Custom Domains
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
            {customDomains.length > 0 ? (
              customDomains.map((domain) => (
                <div
                  key={domain}
                  className="flex items-center gap-3 rounded-xl p-3"
                  style={{ background: 'var(--bg-subtle)' }}
                >
                  <div
                    className="h-2 w-2 rounded-full"
                    style={{ background: 'var(--status-success)' }}
                  />
                  <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {domain}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                No custom domains configured.
              </p>
            )}
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="yourdomain.com"
                className="flex-1 rounded-xl border px-3 py-2 text-sm outline-none"
                style={{
                  borderColor: 'var(--border-default)',
                  background: 'var(--bg-main)',
                  color: 'var(--text-primary)',
                }}
              />
              <button className="brand-gradient rounded-xl px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90">
                Add domain
              </button>
            </div>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Add a CNAME pointing your domain to your workspace URL. TLS is auto-provisioned within
              60 s.
            </p>
          </div>
        </div>
      </section>

      {/* Notifications */}
      <section>
        <h2
          className="mb-3 text-xs font-bold uppercase tracking-wide"
          style={{ color: 'var(--text-muted)' }}
        >
          Notification Preferences
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
            {NOTIF_PREFS.map((pref) => (
              <div key={pref.key} className="flex items-center justify-between px-6 py-4">
                <div>
                  <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {pref.label}
                  </div>
                  <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {pref.desc}
                  </div>
                </div>
                <button
                  onClick={() =>
                    setNotifPrefs((prev) => ({ ...prev, [pref.key]: !prev[pref.key] }))
                  }
                  className="relative h-5 w-10 flex-shrink-0 rounded-full transition-colors"
                  style={{
                    background: notifPrefs[pref.key]
                      ? 'var(--brand-primary)'
                      : 'var(--border-default)',
                  }}
                >
                  <span
                    className="absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform"
                    style={{ left: notifPrefs[pref.key] ? '22px' : '2px' }}
                  />
                </button>
              </div>
            ))}
          </div>
          {notifMsg && (
            <div
              className="border-t px-6 py-3 text-xs"
              style={{
                borderColor: 'var(--border-light)',
                color: notifMsg.ok ? 'var(--status-success)' : '#ef4444',
              }}
            >
              {notifMsg.text}
            </div>
          )}
          <div
            className="flex justify-end border-t px-6 py-4"
            style={{ borderColor: 'var(--border-light)' }}
          >
            <button
              onClick={saveNotifications}
              disabled={notifPending}
              className="brand-gradient rounded-xl px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {notifPending ? 'Saving…' : 'Save preferences'}
            </button>
          </div>
        </div>
      </section>

      {/* Danger zone */}
      <section>
        <h2 className="mb-3 text-xs font-bold uppercase tracking-wide text-red-500">Danger Zone</h2>
        <div
          className="rounded-xl border border-red-100 p-6"
          style={{ background: 'var(--bg-white)' }}
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-red-700">Delete workspace</div>
              <div className="mt-0.5 text-xs text-red-500/80">
                Permanently deletes all workspace data. This cannot be undone.
              </div>
            </div>
            <button className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-600 transition-colors hover:bg-red-100">
              Delete workspace
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
