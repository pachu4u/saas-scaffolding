'use client';

import { useRouter } from 'next/navigation';
import { type ChangeEvent, type SyntheticEvent, useState, useTransition } from 'react';

interface ConnectedAppConfigFormProps {
  appId: string;
  name: string;
  description: string | null;
  iconUrl: string | null;
  docsUrl: string | null;
  status: string;
  config: Record<string, unknown>;
}

const fieldStyle = {
  borderColor: 'var(--border-light)',
  background: 'var(--bg-main)',
  color: 'var(--text-primary)',
};

export function ConnectedAppConfigForm({
  appId,
  name: initialName,
  description: initialDescription,
  iconUrl: initialIconUrl,
  docsUrl: initialDocsUrl,
  status: initialStatus,
  config: initialConfig,
}: ConnectedAppConfigFormProps) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription ?? '');
  const [iconUrl, setIconUrl] = useState(initialIconUrl ?? '');
  const [docsUrl, setDocsUrl] = useState(initialDocsUrl ?? '');
  const [status, setStatus] = useState(initialStatus);
  const [configText, setConfigText] = useState(JSON.stringify(initialConfig, null, 2));
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function handleSubmit(e: SyntheticEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);

    let config: Record<string, unknown>;
    try {
      config = configText.trim() ? (JSON.parse(configText) as Record<string, unknown>) : {};
    } catch {
      setError('App-specific config must be valid JSON.');
      return;
    }

    startTransition(async () => {
      try {
        const res = await fetch(`/api/admin/connected-apps/${appId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name,
            description: description || null,
            iconUrl: iconUrl || null,
            docsUrl: docsUrl || null,
            status,
            config,
          }),
        });
        const data = (await res.json()) as { error?: string };
        if (!res.ok) {
          setError(data.error ?? 'Failed to save');
          return;
        }
        setSaved(true);
        router.refresh();
      } catch {
        setError('Something went wrong. Please try again.');
      }
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border p-5"
      style={{
        background: 'var(--bg-white)',
        borderColor: 'var(--border-light)',
        boxShadow: 'var(--shadow-card)',
      }}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label
            className="mb-1.5 block text-xs font-semibold"
            style={{ color: 'var(--text-secondary)' }}
          >
            Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e: ChangeEvent<HTMLInputElement>) => {
              setName(e.target.value);
            }}
            required
            className="focus:border-brand-primary w-full rounded-xl border px-4 py-2.5 text-sm outline-none transition-colors"
            style={fieldStyle}
          />
        </div>

        <div>
          <label
            className="mb-1.5 block text-xs font-semibold"
            style={{ color: 'var(--text-secondary)' }}
          >
            Status
          </label>
          <select
            value={status}
            onChange={(e: ChangeEvent<HTMLSelectElement>) => {
              setStatus(e.target.value);
            }}
            className="focus:border-brand-primary w-full rounded-xl border px-4 py-2.5 text-sm outline-none transition-colors"
            style={fieldStyle}
          >
            <option value="ACTIVE">Active</option>
            <option value="PAUSED">Paused</option>
            <option value="DISABLED">Disabled</option>
          </select>
        </div>

        <div className="sm:col-span-2">
          <label
            className="mb-1.5 block text-xs font-semibold"
            style={{ color: 'var(--text-secondary)' }}
          >
            Description
          </label>
          <input
            type="text"
            value={description}
            onChange={(e: ChangeEvent<HTMLInputElement>) => {
              setDescription(e.target.value);
            }}
            className="focus:border-brand-primary w-full rounded-xl border px-4 py-2.5 text-sm outline-none transition-colors"
            style={fieldStyle}
          />
        </div>

        <div>
          <label
            className="mb-1.5 block text-xs font-semibold"
            style={{ color: 'var(--text-secondary)' }}
          >
            Icon URL
          </label>
          <input
            type="url"
            value={iconUrl}
            onChange={(e: ChangeEvent<HTMLInputElement>) => {
              setIconUrl(e.target.value);
            }}
            placeholder="https://…/icon.svg"
            className="focus:border-brand-primary w-full rounded-xl border px-4 py-2.5 text-sm outline-none transition-colors"
            style={fieldStyle}
          />
        </div>

        <div>
          <label
            className="mb-1.5 block text-xs font-semibold"
            style={{ color: 'var(--text-secondary)' }}
          >
            Docs URL
          </label>
          <input
            type="url"
            value={docsUrl}
            onChange={(e: ChangeEvent<HTMLInputElement>) => {
              setDocsUrl(e.target.value);
            }}
            placeholder="https://docs…"
            className="focus:border-brand-primary w-full rounded-xl border px-4 py-2.5 text-sm outline-none transition-colors"
            style={fieldStyle}
          />
        </div>

        <div className="sm:col-span-2">
          <label
            className="mb-1.5 block text-xs font-semibold"
            style={{ color: 'var(--text-secondary)' }}
          >
            App-specific config (JSON)
          </label>
          <textarea
            value={configText}
            onChange={(e: ChangeEvent<HTMLTextAreaElement>) => {
              setConfigText(e.target.value);
            }}
            rows={6}
            spellCheck={false}
            className="focus:border-brand-primary w-full rounded-xl border px-4 py-2.5 font-mono text-xs outline-none transition-colors"
            style={fieldStyle}
          />
          <p className="mt-1 text-[11px]" style={{ color: 'var(--text-muted)' }}>
            Free-form settings only this app needs — e.g. an SSO launch path or a SCIM base URL
            template used when provisioning a new tenant instance. Not interpreted by the registry
            itself.
          </p>
        </div>
      </div>

      {error && <p className="mt-3 text-xs text-red-600">{error}</p>}
      {saved && !error && (
        <p className="mt-3 text-xs" style={{ color: 'var(--status-success)' }}>
          Saved.
        </p>
      )}

      <div className="mt-4 flex justify-end">
        <button
          type="submit"
          disabled={isPending}
          className="brand-gradient rounded-xl px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {isPending ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </form>
  );
}
