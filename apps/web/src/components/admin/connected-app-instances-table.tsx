'use client';

import { useRouter } from 'next/navigation';
import { type ChangeEvent, type SyntheticEvent, useState, useTransition } from 'react';

import { Badge } from '@/components/ui/badge';

interface InstanceRow {
  id: string;
  tenantName: string;
  tenantSlug: string;
  scimBaseUrl: string;
  status: string;
  lastSyncedAt: string | null;
  lastSyncError: string | null;
}

interface AvailableTenant {
  id: string;
  name: string;
  slug: string;
}

const fieldStyle = {
  borderColor: 'var(--border-light)',
  background: 'var(--bg-main)',
  color: 'var(--text-primary)',
};

function timeAgo(iso: string) {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60) return 'just now';
  if (secs < 3600) return `${String(Math.floor(secs / 60))}m ago`;
  if (secs < 86400) return `${String(Math.floor(secs / 3600))}h ago`;
  return `${String(Math.floor(secs / 86400))}d ago`;
}

function InstanceRowView({ appId, instance }: { appId: string; instance: InstanceRow }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [scimBaseUrl, setScimBaseUrl] = useState(instance.scimBaseUrl);
  const [scimToken, setScimToken] = useState('');
  const [status, setStatus] = useState(instance.status);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSave() {
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/admin/connected-apps/${appId}/instances/${instance.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scimBaseUrl,
          status,
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
      router.refresh();
    });
  }

  function handleDelete() {
    if (!window.confirm(`Disconnect ${instance.tenantName} from this app?`)) return;
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/admin/connected-apps/${appId}/instances/${instance.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? 'Failed to delete');
        return;
      }
      router.refresh();
    });
  }

  if (editing) {
    return (
      <tr style={{ borderBottom: '1px solid var(--border-light)' }}>
        <td className="px-5 py-3 text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
          {instance.tenantName}{' '}
          <code className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
            {instance.tenantSlug}
          </code>
        </td>
        <td className="px-5 py-3" colSpan={3}>
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={scimBaseUrl}
              onChange={(e: ChangeEvent<HTMLInputElement>) => {
                setScimBaseUrl(e.target.value);
              }}
              placeholder="SCIM base URL"
              className="min-w-[220px] flex-1 rounded-lg border px-2.5 py-1.5 font-mono text-xs outline-none"
              style={fieldStyle}
            />
            <input
              value={scimToken}
              onChange={(e: ChangeEvent<HTMLInputElement>) => {
                setScimToken(e.target.value);
              }}
              type="password"
              placeholder="New bearer token (leave blank to keep)"
              className="min-w-[220px] flex-1 rounded-lg border px-2.5 py-1.5 font-mono text-xs outline-none"
              style={fieldStyle}
            />
            <select
              value={status}
              onChange={(e: ChangeEvent<HTMLSelectElement>) => {
                setStatus(e.target.value);
              }}
              className="rounded-lg border px-2 py-1.5 text-xs outline-none"
              style={fieldStyle}
            >
              <option value="ACTIVE">Active</option>
              <option value="PAUSED">Paused</option>
              <option value="DISABLED">Disabled</option>
            </select>
            <button
              onClick={() => {
                setEditing(false);
                setScimBaseUrl(instance.scimBaseUrl);
                setScimToken('');
                setStatus(instance.status);
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
          {error && <p className="mt-1.5 text-xs text-red-600">{error}</p>}
        </td>
      </tr>
    );
  }

  return (
    <tr style={{ borderBottom: '1px solid var(--border-light)' }}>
      <td className="px-5 py-3 text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
        {instance.tenantName}{' '}
        <code className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
          {instance.tenantSlug}
        </code>
      </td>
      <td className="px-5 py-3 font-mono text-xs" style={{ color: 'var(--text-secondary)' }}>
        {instance.scimBaseUrl}
      </td>
      <td className="px-5 py-3">
        <Badge variant={instance.status === 'ACTIVE' ? 'success' : 'gray'} dot>
          {instance.status.charAt(0) + instance.status.slice(1).toLowerCase()}
        </Badge>
      </td>
      <td className="px-5 py-3 text-xs" style={{ color: 'var(--text-muted)' }}>
        <div className="flex items-center justify-between gap-3">
          <span>
            {instance.lastSyncError ? (
              <span style={{ color: 'var(--status-error)' }}>Error: {instance.lastSyncError}</span>
            ) : instance.lastSyncedAt ? (
              timeAgo(instance.lastSyncedAt)
            ) : (
              'Never'
            )}
          </span>
          <span className="flex items-center gap-2">
            <button
              onClick={() => {
                setEditing(true);
              }}
              className="text-xs font-semibold"
              style={{ color: 'var(--brand-primary)' }}
            >
              Edit
            </button>
            <button
              onClick={handleDelete}
              disabled={isPending}
              className="text-xs"
              style={{ color: 'var(--status-error)' }}
            >
              Disconnect
            </button>
          </span>
        </div>
        {error && <p className="mt-1.5 text-xs text-red-600">{error}</p>}
      </td>
    </tr>
  );
}

function AddInstanceForm({
  appId,
  availableTenants,
}: {
  appId: string;
  availableTenants: AvailableTenant[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [tenantId, setTenantId] = useState('');
  const [scimBaseUrl, setScimBaseUrl] = useState('');
  const [scimToken, setScimToken] = useState('');
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleCreate(e: SyntheticEvent) {
    e.preventDefault();
    setError(null);
    if (!tenantId) {
      setError('Choose a tenant.');
      return;
    }
    if (!scimBaseUrl.trim() || !scimToken.trim()) {
      setError('SCIM base URL and bearer token are both required.');
      return;
    }
    startTransition(async () => {
      const res = await fetch(`/api/admin/connected-apps/${appId}/instances`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId,
          scimBaseUrl: scimBaseUrl.trim(),
          scimToken: scimToken.trim(),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? 'Failed to connect tenant');
        return;
      }
      setTenantId('');
      setScimBaseUrl('');
      setScimToken('');
      setOpen(false);
      router.refresh();
    });
  }

  if (!open) {
    if (availableTenants.length === 0) return null;
    return (
      <button
        onClick={() => {
          setOpen(true);
        }}
        className="mt-3 flex w-full items-center justify-center rounded-xl border border-dashed py-3 text-sm font-medium transition-colors hover:bg-gray-50"
        style={{ borderColor: 'var(--border-default)', color: 'var(--brand-primary)' }}
      >
        + Connect a tenant
      </button>
    );
  }

  return (
    <form
      onSubmit={handleCreate}
      className="mt-3 rounded-xl border p-4"
      style={{
        background: 'var(--bg-white)',
        borderColor: 'var(--brand-primary)',
        boxShadow: 'var(--shadow-card)',
      }}
    >
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        <select
          value={tenantId}
          onChange={(e: ChangeEvent<HTMLSelectElement>) => {
            setTenantId(e.target.value);
          }}
          className="rounded-lg border px-2.5 py-2 text-xs outline-none sm:col-span-2"
          style={fieldStyle}
        >
          <option value="">Select tenant…</option>
          {availableTenants.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name} ({t.slug})
            </option>
          ))}
        </select>
        <input
          value={scimBaseUrl}
          onChange={(e: ChangeEvent<HTMLInputElement>) => {
            setScimBaseUrl(e.target.value);
          }}
          placeholder="SCIM base URL, e.g. https://app.example.com/scim/v2"
          className="rounded-lg border px-2.5 py-2 font-mono text-xs outline-none sm:col-span-2"
          style={fieldStyle}
        />
        <input
          value={scimToken}
          onChange={(e: ChangeEvent<HTMLInputElement>) => {
            setScimToken(e.target.value);
          }}
          type="password"
          placeholder="Bearer token the app expects"
          className="rounded-lg border px-2.5 py-2 font-mono text-xs outline-none sm:col-span-2"
          style={fieldStyle}
        />
      </div>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      <div className="mt-3 flex justify-end gap-3">
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setError(null);
          }}
          className="text-xs"
          style={{ color: 'var(--text-muted)' }}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="text-xs font-semibold"
          style={{ color: 'var(--brand-primary)' }}
        >
          {isPending ? 'Connecting…' : 'Connect tenant'}
        </button>
      </div>
    </form>
  );
}

export function ConnectedAppInstancesTable({
  appId,
  data,
  availableTenants,
}: {
  appId: string;
  data: InstanceRow[];
  availableTenants: AvailableTenant[];
}) {
  return (
    <div>
      {data.length === 0 ? (
        <div
          className="rounded-xl border p-6 text-center text-xs"
          style={{
            background: 'var(--bg-white)',
            borderColor: 'var(--border-light)',
            color: 'var(--text-muted)',
          }}
        >
          No tenant has connected this app yet. Riogentix instances are created automatically during
          tenant provisioning; other apps need to be connected manually below.
        </div>
      ) : (
        <div
          className="overflow-hidden rounded-xl border"
          style={{
            background: 'var(--bg-white)',
            borderColor: 'var(--border-light)',
            boxShadow: 'var(--shadow-card)',
          }}
        >
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-light)' }}>
                {['Tenant', 'SCIM base URL', 'Status', 'Last synced'].map((h) => (
                  <th
                    key={h}
                    className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((instance) => (
                <InstanceRowView key={instance.id} appId={appId} instance={instance} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AddInstanceForm appId={appId} availableTenants={availableTenants} />
    </div>
  );
}
