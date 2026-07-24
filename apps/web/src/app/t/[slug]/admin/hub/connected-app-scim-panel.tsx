'use client';

import { useRouter } from 'next/navigation';
import { type ChangeEvent, useState, useTransition } from 'react';

const fieldStyle = {
  borderColor: 'var(--border-light)',
  background: 'var(--bg-main)',
  color: 'var(--text-primary)',
};

export function ConnectedAppScimPanel({
  scimBaseUrl: initialScimBaseUrl,
  lastSyncedAt,
  lastSyncError,
}: {
  scimBaseUrl: string;
  lastSyncedAt: string | null;
  lastSyncError: string | null;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [scimBaseUrl, setScimBaseUrl] = useState(initialScimBaseUrl);
  const [scimToken, setScimToken] = useState('');
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function handleSave() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const res = await fetch('/api/settings/connected-app', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scimBaseUrl,
          ...(scimToken.trim() && { scimToken: scimToken.trim() }),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? 'Failed to save');
        return;
      }
      setScimToken('');
      setEditing(false);
      setSaved(true);
      router.refresh();
    });
  }

  return (
    <div
      className="rounded-xl border p-4"
      style={{
        background: 'var(--bg-white)',
        borderColor: 'var(--border-light)',
        boxShadow: 'var(--shadow-card)',
      }}
    >
      <h2 className="mb-1 text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
        SCIM connection
      </h2>
      <p className="mb-3 text-xs" style={{ color: 'var(--text-muted)' }}>
        Where this app receives your team&apos;s users and roles.{' '}
        {lastSyncError ? (
          <span style={{ color: 'var(--status-error)' }}>Last sync failed: {lastSyncError}</span>
        ) : lastSyncedAt ? (
          `Last synced ${new Date(lastSyncedAt).toLocaleString()}`
        ) : (
          'Not synced yet.'
        )}
      </p>

      {editing ? (
        <div className="space-y-2">
          <input
            value={scimBaseUrl}
            onChange={(e: ChangeEvent<HTMLInputElement>) => {
              setScimBaseUrl(e.target.value);
            }}
            placeholder="SCIM base URL"
            className="w-full rounded-lg border px-2.5 py-1.5 font-mono text-xs outline-none"
            style={fieldStyle}
          />
          <input
            value={scimToken}
            onChange={(e: ChangeEvent<HTMLInputElement>) => {
              setScimToken(e.target.value);
            }}
            type="password"
            placeholder="New bearer token (leave blank to keep current)"
            className="w-full rounded-lg border px-2.5 py-1.5 font-mono text-xs outline-none"
            style={fieldStyle}
          />
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => {
                setEditing(false);
                setScimBaseUrl(initialScimBaseUrl);
                setScimToken('');
                setError(null);
              }}
              className="text-xs"
              style={{ color: 'var(--text-muted)' }}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isPending}
              className="text-xs font-semibold"
              style={{ color: 'var(--brand-primary)' }}
            >
              {isPending ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-2">
          <code
            className="min-w-0 flex-1 truncate rounded-lg px-2.5 py-1.5 text-xs"
            style={{ background: 'var(--bg-subtle)', color: 'var(--text-secondary)' }}
          >
            {scimBaseUrl}
          </code>
          <button
            onClick={() => {
              setEditing(true);
            }}
            className="flex-shrink-0 text-xs font-semibold"
            style={{ color: 'var(--brand-primary)' }}
          >
            Edit
          </button>
        </div>
      )}
      {saved && !editing && !error && (
        <p className="mt-2 text-xs" style={{ color: 'var(--status-success)' }}>
          Saved.
        </p>
      )}
    </div>
  );
}
