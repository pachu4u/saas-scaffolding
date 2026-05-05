'use client';

import {
  type ChangeEvent,
  type FormEvent,
  type MouseEvent,
  useRef,
  useState,
  useTransition,
} from 'react';

const WEBHOOK_EVENTS = [
  { id: 'tenant.updated', label: 'Tenant updated' },
  { id: 'tenant.suspended', label: 'Tenant suspended' },
  { id: 'user.invited', label: 'User invited' },
  { id: 'user.joined', label: 'User joined' },
  { id: 'user.removed', label: 'User removed' },
  { id: 'subscription.created', label: 'Subscription created' },
  { id: 'subscription.updated', label: 'Subscription updated' },
  { id: 'subscription.cancelled', label: 'Subscription cancelled' },
];

interface AddWebhookModalProps {
  onClose: () => void;
  onSuccess: (secret: string) => void;
}

export function AddWebhookModal({ onClose, onSuccess }: AddWebhookModalProps) {
  const [url, setUrl] = useState('');
  const [selectedEvents, setSelectedEvents] = useState<string[]>(['user.invited', 'user.joined']);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  function handleOverlayClick(e: MouseEvent<HTMLDivElement>) {
    if (e.target === overlayRef.current) onClose();
  }

  function toggleEvent(eventId: string) {
    setSelectedEvents((prev) =>
      prev.includes(eventId) ? prev.filter((id) => id !== eventId) : [...prev, eventId],
    );
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (selectedEvents.length === 0) {
      setError('Select at least one event type.');
      return;
    }

    startTransition(async () => {
      try {
        const res = await fetch('/api/webhooks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url, events: selectedEvents }),
        });
        const data = (await res.json()) as { secret?: string; error?: string };
        if (!res.ok) {
          setError(data.error ?? 'Failed to create webhook');
          return;
        }
        onSuccess(data.secret ?? '');
      } catch {
        setError('Something went wrong. Please try again.');
      }
    });
  }

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}
      onClick={handleOverlayClick}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-xl border"
        style={{
          background: 'var(--bg-white)',
          borderColor: 'var(--border-light)',
          boxShadow: 'var(--shadow-card)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between border-b px-6 py-5"
          style={{ borderColor: 'var(--border-light)' }}
        >
          <div>
            <h2 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>
              Add webhook endpoint
            </h2>
            <p className="mt-0.5 text-xs" style={{ color: 'var(--text-muted)' }}>
              We&apos;ll send POST requests to your URL for the selected events.
            </p>
          </div>
          <button
            onClick={onClose}
            className="hover:bg-bg-subtle flex h-8 w-8 items-center justify-center rounded-lg transition-colors"
            style={{ color: 'var(--text-muted)' }}
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 0 1 1.414 0L10 8.586l4.293-4.293a1 1 0 1 1 1.414 1.414L11.414 10l4.293 4.293a1 1 0 0 1-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 0 1-1.414-1.414L8.586 10 4.293 5.707a1 1 0 0 1 0-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="space-y-5 px-6 py-5">
            {/* URL */}
            <div>
              <label
                className="mb-1.5 block text-xs font-semibold"
                style={{ color: 'var(--text-secondary)' }}
              >
                Endpoint URL
              </label>
              <input
                type="url"
                value={url}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setUrl(e.target.value)}
                placeholder="https://example.com/webhooks"
                required
                className="focus:border-brand-primary w-full rounded-xl border px-4 py-2.5 font-mono text-sm outline-none transition-colors"
                style={{
                  borderColor: 'var(--border-light)',
                  background: 'var(--bg-main)',
                  color: 'var(--text-primary)',
                }}
              />
            </div>

            {/* Events */}
            <div>
              <label
                className="mb-2 block text-xs font-semibold"
                style={{ color: 'var(--text-secondary)' }}
              >
                Events to subscribe
              </label>
              <div className="grid grid-cols-2 gap-2">
                {WEBHOOK_EVENTS.map((event) => {
                  const checked = selectedEvents.includes(event.id);
                  return (
                    <label
                      key={event.id}
                      className="flex cursor-pointer items-center gap-2.5 rounded-xl border p-2.5 transition-all"
                      style={
                        checked
                          ? {
                              borderColor: 'var(--brand-primary)',
                              background: 'rgba(79,123,255,0.05)',
                            }
                          : { borderColor: 'var(--border-light)', background: 'var(--bg-main)' }
                      }
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleEvent(event.id)}
                        className="sr-only"
                      />
                      <div
                        className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border-2 transition-all"
                        style={
                          checked
                            ? {
                                borderColor: 'var(--brand-primary)',
                                background: 'var(--brand-primary)',
                              }
                            : { borderColor: 'var(--border-default)' }
                        }
                      >
                        {checked && (
                          <svg viewBox="0 0 12 12" fill="none" className="h-2.5 w-2.5">
                            <path
                              d="M2 6l3 3 5-5"
                              stroke="#fff"
                              strokeWidth="1.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        )}
                      </div>
                      <span
                        className="text-xs font-medium"
                        style={{ color: 'var(--text-primary)' }}
                      >
                        {event.label}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>

            {error && <p className="px-1 text-xs text-red-600">{error}</p>}
          </div>

          {/* Footer */}
          <div
            className="flex items-center justify-end gap-3 border-t px-6 py-4"
            style={{ borderColor: 'var(--border-light)' }}
          >
            <button
              type="button"
              onClick={onClose}
              className="hover:bg-bg-subtle rounded-xl border px-4 py-2 text-sm font-semibold transition-colors"
              style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="brand-gradient rounded-xl px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {isPending ? 'Creating…' : 'Add endpoint'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
