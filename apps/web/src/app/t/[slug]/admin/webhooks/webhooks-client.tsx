'use client';

import { useCallback, useEffect, useState, useTransition } from 'react';

import { AddWebhookModal } from '@/components/modals/add-webhook-modal';

interface Delivery {
  id: string;
  eventId: string;
  status: 'PENDING' | 'SUCCESS' | 'FAILED' | 'DEAD';
  attempts: number;
  lastError: string | null;
  nextRetryAt: string | null;
  createdAt: string;
}

interface WebhookEndpoint {
  id: string;
  url: string;
  events: string[];
  status: 'ACTIVE' | 'PAUSED' | 'DELETED';
  secret: string;
  _count: { deliveries: number };
  deliveries: { status: string; createdAt: string }[];
}

const statusColors: Record<string, string> = {
  SUCCESS: 'var(--status-success)',
  PENDING: 'var(--status-warning)',
  FAILED: '#ef4444',
  DEAD: 'var(--text-muted)',
};

const statusBg: Record<string, string> = {
  SUCCESS: 'rgba(22,163,74,0.1)',
  PENDING: 'rgba(245,158,11,0.1)',
  FAILED: 'rgba(239,68,68,0.1)',
  DEAD: 'var(--bg-subtle)',
};

function SecretDisplay({ secret }: { secret: string }) {
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(secret);
    setCopied(true);
    setTimeout(() => {
      setCopied(false);
    }, 2000);
  }

  return (
    <div
      className="flex items-center gap-2 rounded-xl border px-3 py-2"
      style={{ background: 'var(--bg-main)', borderColor: 'var(--border-light)' }}
    >
      <code className="flex-1 truncate text-xs" style={{ color: 'var(--text-secondary)' }}>
        {revealed ? secret : '•'.repeat(Math.min(secret.length, 48))}
      </code>
      <button
        onClick={() => {
          setRevealed((v) => !v);
        }}
        className="flex-shrink-0 text-xs hover:underline"
        style={{ color: 'var(--text-muted)' }}
      >
        {revealed ? 'Hide' : 'Reveal'}
      </button>
      <button
        onClick={() => void copy()}
        className="flex-shrink-0 text-xs hover:underline"
        style={{ color: 'var(--brand-primary)' }}
      >
        {copied ? 'Copied!' : 'Copy'}
      </button>
    </div>
  );
}

function DeliveryRow({ delivery }: { delivery: Delivery }) {
  const color = statusColors[delivery.status] ?? 'var(--text-muted)';
  const bg = statusBg[delivery.status] ?? 'var(--bg-subtle)';
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <span
        className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold"
        style={{ color, background: bg }}
      >
        {delivery.status}
      </span>
      <span className="flex-1 truncate font-mono text-xs" style={{ color: 'var(--text-muted)' }}>
        {delivery.eventId}
      </span>
      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
        {delivery.attempts} attempt{delivery.attempts !== 1 ? 's' : ''}
      </span>
      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
        {new Date(delivery.createdAt).toLocaleString()}
      </span>
    </div>
  );
}

export function WebhooksClient() {
  const [endpoints, setEndpoints] = useState<WebhookEndpoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newSecret, setNewSecret] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deliveries, setDeliveries] = useState<Record<string, Delivery[]>>({});
  const [loadingDeliveries, setLoadingDeliveries] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{
    endpointId: string;
    ok: boolean;
    error: string | null;
  } | null>(null);
  const [isPending, startTransition] = useTransition();

  const fetchEndpoints = useCallback(async () => {
    try {
      const res = await fetch('/api/webhooks');
      if (res.ok) {
        const data = (await res.json()) as WebhookEndpoint[];
        setEndpoints(data);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchEndpoints();
  }, [fetchEndpoints]);

  async function loadDeliveries(endpointId: string) {
    if (deliveries[endpointId]) {
      setExpandedId((prev) => (prev === endpointId ? null : endpointId));
      return;
    }
    setLoadingDeliveries(endpointId);
    setExpandedId(endpointId);
    try {
      const res = await fetch(`/api/webhooks/${endpointId}/deliveries`);
      if (res.ok) {
        const data = (await res.json()) as Delivery[];
        setDeliveries((prev) => ({ ...prev, [endpointId]: data }));
      }
    } finally {
      setLoadingDeliveries(null);
    }
  }

  function toggleStatus(endpoint: WebhookEndpoint) {
    const newStatus = endpoint.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
    startTransition(async () => {
      const res = await fetch(`/api/webhooks/${endpoint.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        setEndpoints((prev) =>
          prev.map((ep) => (ep.id === endpoint.id ? { ...ep, status: newStatus } : ep)),
        );
      }
    });
  }

  function deleteEndpoint(endpointId: string) {
    startTransition(async () => {
      const res = await fetch(`/api/webhooks/${endpointId}`, { method: 'DELETE' });
      if (res.status === 204) {
        setEndpoints((prev) => prev.filter((ep) => ep.id !== endpointId));
        if (expandedId === endpointId) setExpandedId(null);
      }
    });
  }

  function handleCreated(secret: string) {
    setShowAddModal(false);
    setNewSecret(secret);
    void fetchEndpoints();
  }

  async function sendTest(endpointId: string) {
    setTestingId(endpointId);
    setTestResult(null);
    try {
      const res = await fetch(`/api/webhooks/${endpointId}/test`, {
        method: 'POST',
      });
      const json = (await res.json()) as { ok?: boolean; error?: string | null };
      setTestResult({ endpointId, ok: json.ok ?? false, error: json.error ?? null });
      // Refresh deliveries if already expanded
      if (expandedId === endpointId) {
        setDeliveries((prev) => {
          const existing = prev[endpointId] ?? [];
          return { ...prev, [endpointId]: existing }; // trigger re-fetch next expand
        });
        void loadDeliveries(endpointId);
      }
    } catch {
      setTestResult({ endpointId, ok: false, error: 'Request failed' });
    } finally {
      setTestingId(null);
    }
  }

  return (
    <main className="space-y-6 p-6">
      {/* Secret reveal banner */}
      {newSecret && (
        <div
          className="rounded-xl border p-5"
          style={{
            background: 'rgba(22,163,74,0.05)',
            borderColor: 'rgba(22,163,74,0.2)',
          }}
        >
          <div className="mb-3 flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-bold" style={{ color: 'var(--status-success)' }}>
                Endpoint created — save your signing secret
              </p>
              <p className="mt-0.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
                This secret is only shown once. Store it securely and use it to verify webhook
                signatures.
              </p>
            </div>
            <button
              onClick={() => {
                setNewSecret(null);
              }}
              className="flex-shrink-0 text-xs hover:underline"
              style={{ color: 'var(--text-muted)' }}
            >
              Dismiss
            </button>
          </div>
          <SecretDisplay secret={newSecret} />
        </div>
      )}

      {/* Header row */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
            Endpoints
          </h2>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {endpoints.length} endpoint{endpoints.length !== 1 ? 's' : ''} configured
          </p>
        </div>
        <button
          onClick={() => {
            setShowAddModal(true);
          }}
          className="brand-gradient flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
            <path d="M10.75 4.75a.75.75 0 0 0-1.5 0v4.5h-4.5a.75.75 0 0 0 0 1.5h4.5v4.5a.75.75 0 0 0 1.5 0v-4.5h4.5a.75.75 0 0 0 0-1.5h-4.5v-4.5z" />
          </svg>
          Add endpoint
        </button>
      </div>

      {/* Empty state */}
      {!isLoading && endpoints.length === 0 && (
        <div
          className="rounded-xl border py-16 text-center"
          style={{
            background: 'var(--bg-white)',
            borderColor: 'var(--border-light)',
            boxShadow: 'var(--shadow-card)',
          }}
        >
          <div
            className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl"
            style={{ background: 'var(--bg-subtle)' }}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              className="h-7 w-7"
              style={{ color: 'var(--text-muted)' }}
            >
              <path
                d="M13.5 2.5L18 7m0 0l-4.5 4.5M18 7H8a4 4 0 0 0-4 4v2"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M10.5 21.5L6 17m0 0l4.5-4.5M6 17h10a4 4 0 0 0 4-4v-2"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <h3 className="mb-1 text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
            No webhook endpoints
          </h3>
          <p className="mb-5 text-xs" style={{ color: 'var(--text-muted)' }}>
            Add an endpoint to receive real-time event notifications.
          </p>
          <button
            onClick={() => {
              setShowAddModal(true);
            }}
            className="brand-gradient rounded-xl px-5 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          >
            Add your first endpoint
          </button>
        </div>
      )}

      {/* Loading skeleton */}
      {isLoading && (
        <div
          className="rounded-xl border"
          style={{ background: 'var(--bg-white)', borderColor: 'var(--border-light)' }}
        >
          {Array.from({ length: 2 }).map((_, i) => (
            <div
              key={i}
              className="border-b px-6 py-5"
              style={{ borderColor: 'var(--border-light)' }}
            >
              <div
                className="mb-2 h-4 w-64 animate-pulse rounded"
                style={{ background: 'var(--bg-subtle)' }}
              />
              <div
                className="h-3 w-32 animate-pulse rounded"
                style={{ background: 'var(--bg-subtle)' }}
              />
            </div>
          ))}
        </div>
      )}

      {/* Endpoints list */}
      {!isLoading && endpoints.length > 0 && (
        <div
          className="overflow-hidden rounded-xl border"
          style={{
            background: 'var(--bg-white)',
            borderColor: 'var(--border-light)',
            boxShadow: 'var(--shadow-card)',
          }}
        >
          {endpoints.map((ep, idx) => {
            const isExpanded = expandedId === ep.id;
            const lastDelivery = ep.deliveries[0];
            return (
              <div
                key={ep.id}
                className={idx < endpoints.length - 1 || isExpanded ? 'border-b' : ''}
                style={{ borderColor: 'var(--border-light)' }}
              >
                {/* Endpoint row */}
                <div className="flex flex-col gap-3 px-6 py-5 sm:flex-row sm:items-start">
                  {/* Status indicator */}
                  <div className="mt-0.5 flex-shrink-0">
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full"
                      style={{
                        background:
                          ep.status === 'ACTIVE' ? 'var(--status-success)' : 'var(--text-muted)',
                      }}
                    />
                  </div>

                  {/* Main info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className="truncate font-mono text-sm font-semibold"
                        style={{ color: 'var(--text-primary)' }}
                      >
                        {ep.url}
                      </span>
                      <span
                        className="rounded-md px-1.5 py-0.5 text-xs font-semibold"
                        style={{
                          background:
                            ep.status === 'ACTIVE' ? 'rgba(22,163,74,0.1)' : 'var(--bg-subtle)',
                          color:
                            ep.status === 'ACTIVE' ? 'var(--status-success)' : 'var(--text-muted)',
                        }}
                      >
                        {ep.status}
                      </span>
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {ep.events.map((ev) => (
                        <span
                          key={ev}
                          className="rounded-md px-1.5 py-0.5 font-mono text-xs"
                          style={{
                            background: 'var(--bg-subtle)',
                            color: 'var(--text-secondary)',
                          }}
                        >
                          {ev}
                        </span>
                      ))}
                    </div>
                    {lastDelivery && (
                      <div className="mt-1.5 flex items-center gap-1.5">
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                          Last delivery:
                        </span>
                        <span
                          className="text-xs font-semibold"
                          style={{
                            color: statusColors[lastDelivery.status] ?? 'var(--text-muted)',
                          }}
                        >
                          {lastDelivery.status}
                        </span>
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                          {new Date(lastDelivery.createdAt).toLocaleString()}
                        </span>
                      </div>
                    )}
                    <div className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                      {ep._count.deliveries} total deliveries
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-shrink-0 flex-wrap items-center gap-2">
                    <button
                      onClick={() => void sendTest(ep.id)}
                      disabled={testingId === ep.id || isPending}
                      className="hover:bg-bg-subtle rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50"
                      style={{ borderColor: 'var(--border-light)', color: 'var(--brand-primary)' }}
                    >
                      {testingId === ep.id ? 'Sending…' : 'Send test'}
                    </button>
                    <button
                      onClick={() => void loadDeliveries(ep.id)}
                      className="hover:bg-bg-subtle rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors"
                      style={{ borderColor: 'var(--border-light)', color: 'var(--text-secondary)' }}
                    >
                      {isExpanded ? 'Hide history' : 'View history'}
                    </button>
                    <button
                      onClick={() => {
                        toggleStatus(ep);
                      }}
                      disabled={isPending}
                      className="hover:bg-bg-subtle rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50"
                      style={{ borderColor: 'var(--border-light)', color: 'var(--text-secondary)' }}
                    >
                      {ep.status === 'ACTIVE' ? 'Pause' : 'Activate'}
                    </button>
                    <button
                      onClick={() => {
                        deleteEndpoint(ep.id);
                      }}
                      disabled={isPending}
                      className="hover:bg-bg-subtle rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50"
                      style={{ borderColor: 'var(--border-light)', color: '#ef4444' }}
                    >
                      Delete
                    </button>
                  </div>
                  {/* Test result inline */}
                  {testResult?.endpointId === ep.id && (
                    <div
                      className="mt-2 flex items-center gap-2 rounded-lg px-3 py-2 text-xs"
                      style={{
                        background: testResult.ok ? 'rgba(22,163,74,0.08)' : 'rgba(239,68,68,0.08)',
                        border: `1px solid ${testResult.ok ? 'rgba(22,163,74,0.25)' : 'rgba(239,68,68,0.25)'}`,
                        color: testResult.ok ? 'var(--status-success)' : '#ef4444',
                      }}
                    >
                      {testResult.ok
                        ? '✓ Test delivery succeeded'
                        : `✗ Test failed: ${testResult.error ?? 'unknown error'}`}
                      <button
                        onClick={() => {
                          setTestResult(null);
                        }}
                        className="ml-auto opacity-60 hover:opacity-100"
                      >
                        ×
                      </button>
                    </div>
                  )}
                </div>

                {/* Delivery history panel */}
                {isExpanded && (
                  <div
                    className="border-t"
                    style={{ borderColor: 'var(--border-light)', background: 'var(--bg-main)' }}
                  >
                    <div
                      className="flex items-center justify-between border-b px-4 py-2.5"
                      style={{ borderColor: 'var(--border-light)' }}
                    >
                      <span
                        className="text-xs font-bold"
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        Recent deliveries (last 50)
                      </span>
                    </div>
                    {loadingDeliveries === ep.id ? (
                      <div className="px-4 py-6 text-center">
                        <div
                          className="inline-block h-5 w-5 animate-spin rounded-full border-2"
                          style={{
                            borderColor: 'var(--border-light)',
                            borderTopColor: 'var(--brand-primary)',
                          }}
                        />
                      </div>
                    ) : (deliveries[ep.id] ?? []).length === 0 ? (
                      <div className="px-4 py-6 text-center">
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                          No deliveries yet.
                        </p>
                      </div>
                    ) : (
                      <div className="divide-y" style={{ borderColor: 'var(--border-light)' }}>
                        {(deliveries[ep.id] ?? []).map((d) => (
                          <DeliveryRow key={d.id} delivery={d} />
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Event types reference */}
      <div
        className="rounded-xl border p-5"
        style={{
          background: 'var(--bg-white)',
          borderColor: 'var(--border-light)',
          boxShadow: 'var(--shadow-card)',
        }}
      >
        <h3 className="mb-3 text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
          Available event types
        </h3>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            'tenant.updated',
            'tenant.suspended',
            'user.invited',
            'user.joined',
            'user.removed',
            'subscription.created',
            'subscription.updated',
            'subscription.cancelled',
          ].map((ev) => (
            <code
              key={ev}
              className="rounded-lg px-2.5 py-1.5 text-xs"
              style={{
                background: 'var(--bg-main)',
                color: 'var(--text-secondary)',
                border: '1px solid var(--border-light)',
              }}
            >
              {ev}
            </code>
          ))}
        </div>
      </div>

      {/* Add modal */}
      {showAddModal && (
        <AddWebhookModal
          onClose={() => {
            setShowAddModal(false);
          }}
          onSuccess={handleCreated}
        />
      )}
    </main>
  );
}
