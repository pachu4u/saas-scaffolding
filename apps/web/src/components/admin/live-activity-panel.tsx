'use client';

import { useEffect, useRef, useState } from 'react';

import { Badge } from '@/components/ui/badge';

const MAX_ENTRIES = 50;

interface LiveEvent {
  id: number;
  kind: string;
  quantity: number;
  occurredAt: string;
}

interface UsageStreamPayload {
  tenantId?: string;
  at?: string;
  totals?: Record<string, number>;
  events?: { kind: string; quantity: number; occurredAt: string }[];
}

type ConnectionStatus = 'connecting' | 'live' | 'reconnecting';

function relativeTime(iso: string): string {
  const secs = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (secs < 5) return 'just now';
  if (secs < 60) return `${String(secs)}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${String(mins)}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${String(hours)}h ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const kindVariants: Record<
  string,
  'blue' | 'success' | 'error' | 'warning' | 'purple' | 'default'
> = {
  'flow.created': 'success',
  'flow.deleted': 'error',
  'flow.executed': 'blue',
  'storage.updated': 'warning',
  'apikey.created': 'purple',
  'seat.added': 'default',
};

const statusConfig: Record<ConnectionStatus, { label: string; color: string }> = {
  connecting: { label: 'Connecting…', color: 'var(--text-muted)' },
  live: { label: 'Live', color: '#16A34A' },
  reconnecting: { label: 'Reconnecting…', color: '#D97706' },
};

export interface KindTotal {
  kind: string;
  total: number;
}

/**
 * Live Activity panel: subscribes to /api/usage/stream (SSE) and renders a
 * newest-first feed of usage events as they arrive, plus per-kind totals
 * that update in place. `initialTotals` seeds the totals from the server
 * render so the panel is useful before the first event arrives.
 */
export function LiveActivityPanel({ initialTotals }: { initialTotals: KindTotal[] }) {
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [totals, setTotals] = useState<Record<string, number>>(() =>
    Object.fromEntries(initialTotals.map((t) => [t.kind, t.total])),
  );
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const nextId = useRef(1);
  // Re-render once a second so relative timestamps stay fresh.
  const [, setTick] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setTick((t) => t + 1);
    }, 1000);
    return () => {
      clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    const source = new EventSource('/api/usage/stream');

    source.onopen = () => {
      setStatus('live');
    };

    source.onmessage = (msg) => {
      let payload: UsageStreamPayload;
      try {
        payload = JSON.parse(msg.data as string) as UsageStreamPayload;
      } catch {
        return;
      }

      const incoming: LiveEvent[] = (
        payload.events ?? [
          // Aggregate-only fallback (large batches): synthesize one row per kind.
          ...Object.entries(payload.totals ?? {}).map(([kind, quantity]) => ({
            kind,
            quantity,
            occurredAt: payload.at ?? new Date().toISOString(),
          })),
        ]
      ).map((ev) => ({
        id: nextId.current++,
        kind: ev.kind,
        quantity: ev.quantity,
        occurredAt: ev.occurredAt,
      }));

      if (incoming.length === 0) return;

      setEvents((prev) => [...incoming.reverse(), ...prev].slice(0, MAX_ENTRIES));
      setTotals((prev) => {
        const next = { ...prev };
        for (const ev of incoming) {
          next[ev.kind] = (next[ev.kind] ?? 0) + ev.quantity;
        }
        return next;
      });
    };

    source.onerror = () => {
      // EventSource auto-reconnects; reflect that in the indicator.
      setStatus('reconnecting');
    };

    return () => {
      source.close();
      setStatus('connecting');
    };
  }, []);

  const sortedTotals = Object.entries(totals).sort((a, b) => b[1] - a[1]);
  const statusCfg = statusConfig[status];

  return (
    <div
      className="rounded-xl border"
      style={{
        background: 'var(--bg-white)',
        borderColor: 'var(--border-light)',
        boxShadow: 'var(--shadow-card)',
      }}
    >
      <div
        className="flex items-center justify-between border-b px-5 py-3.5"
        style={{ borderColor: 'var(--border-light)' }}
      >
        <h2 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
          Live Activity
        </h2>
        <span
          className="flex items-center gap-1.5 text-xs font-semibold"
          style={{ color: statusCfg.color }}
        >
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{
              background: statusCfg.color,
              animation: status === 'live' ? 'pulse-dot 2s infinite' : undefined,
            }}
          />
          {statusCfg.label}
        </span>
      </div>

      {/* Per-kind totals */}
      {sortedTotals.length > 0 && (
        <div
          className="flex flex-wrap gap-2 border-b px-5 py-3"
          style={{ borderColor: 'var(--border-light)' }}
        >
          {sortedTotals.map(([kind, total]) => (
            <span
              key={kind}
              className="rounded-lg px-2.5 py-1 text-xs font-semibold"
              style={{ background: 'var(--bg-subtle)', color: 'var(--text-secondary)' }}
            >
              {kind} <span style={{ color: 'var(--text-primary)' }}>{total.toLocaleString()}</span>
            </span>
          ))}
        </div>
      )}

      {/* Event feed */}
      <div className="max-h-80 overflow-y-auto">
        {events.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
            Waiting for usage events…
          </div>
        ) : (
          events.map((ev, i) => (
            <div
              key={ev.id}
              className="flex items-center gap-3 px-5 py-2.5"
              style={{
                borderBottom: i < events.length - 1 ? '1px solid var(--border-light)' : 'none',
              }}
            >
              <Badge variant={kindVariants[ev.kind] ?? 'default'}>{ev.kind}</Badge>
              <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
                ×{ev.quantity.toLocaleString()}
              </span>
              <span
                className="ml-auto flex-shrink-0 text-xs"
                style={{ color: 'var(--text-muted)' }}
              >
                {relativeTime(ev.occurredAt)}
              </span>
            </div>
          ))
        )}
      </div>

      <style>{`@keyframes pulse-dot { 0%, 100% { opacity: 1; } 50% { opacity: 0.35; } }`}</style>
    </div>
  );
}
