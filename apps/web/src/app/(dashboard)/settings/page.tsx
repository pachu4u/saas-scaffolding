export const metadata = { title: 'Settings — General' };

export default function SettingsGeneralPage() {
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
                  Workspace name
                </label>
                <input
                  type="text"
                  defaultValue="Acme Corp"
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
                    defaultValue="acme"
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
                defaultValue="Acme Corporation — enterprise platform team"
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
          <div
            className="flex justify-end border-t px-6 py-4"
            style={{ borderColor: 'var(--border-light)' }}
          >
            <button className="brand-gradient rounded-xl px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90">
              Save changes
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
          Custom Domain
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
              className="flex items-center gap-3 rounded-xl p-3"
              style={{ background: 'var(--bg-subtle)' }}
            >
              <div
                className="h-2 w-2 rounded-full"
                style={{ background: 'var(--status-success)' }}
              />
              <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                app.acme.com
              </span>
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                · SSL cert valid until Jan 2027
              </span>
            </div>
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
              Add a CNAME record:{' '}
              <code
                className="rounded px-1 py-0.5 font-mono"
                style={{ background: 'var(--bg-subtle)' }}
              >
                yourdomain.com
              </code>{' '}
              →{' '}
              <code
                className="rounded px-1 py-0.5 font-mono"
                style={{ background: 'var(--bg-subtle)' }}
              >
                acme.riogentix.app
              </code>
              . TLS is auto-provisioned within 60 s.
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
                label: 'Security alerts',
                desc: 'Unusual sign-ins, new API keys, SCIM token rotation',
                on: true,
              },
              {
                label: 'Billing events',
                desc: 'Invoice generated, payment failed, plan changed',
                on: true,
              },
              {
                label: 'Member activity',
                desc: 'New invitations accepted, role changes',
                on: false,
              },
              { label: 'Webhook failures', desc: 'Delivery failures after max retries', on: true },
            ].map((pref) => (
              <div key={pref.label} className="flex items-center justify-between px-6 py-4">
                <div>
                  <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {pref.label}
                  </div>
                  <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {pref.desc}
                  </div>
                </div>
                {/* Toggle */}
                <button
                  className={`relative h-5 w-10 flex-shrink-0 rounded-full transition-colors`}
                  style={{ background: pref.on ? 'var(--brand-primary)' : 'var(--border-default)' }}
                >
                  <span
                    className="absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform"
                    style={{ left: pref.on ? '22px' : '2px' }}
                  />
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Danger zone */}
      <section>
        <h2 className="mb-3 text-xs font-bold uppercase tracking-wide text-red-500">Danger Zone</h2>
        <div
          className="rounded-2xl border border-red-100 p-6"
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
