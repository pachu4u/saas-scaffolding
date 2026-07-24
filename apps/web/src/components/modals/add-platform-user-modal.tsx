'use client';

import {
  type ChangeEvent,
  type MouseEvent,
  type SyntheticEvent,
  useRef,
  useState,
  useTransition,
} from 'react';

interface AddPlatformUserModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export function AddPlatformUserModal({ onClose, onSuccess }: AddPlatformUserModalProps) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  function handleOverlayClick(e: MouseEvent<HTMLDivElement>) {
    if (e.target === overlayRef.current) onClose();
  }

  function handleSubmit(e: SyntheticEvent) {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      try {
        const res = await fetch('/api/admin/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, name: name || undefined }),
        });
        const data = (await res.json()) as { user?: unknown; error?: string };
        if (!res.ok) {
          setError(data.error ?? 'Failed to create user');
          return;
        }
        onSuccess();
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
        className="w-full max-w-md overflow-hidden rounded-xl border"
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
              Add user
            </h2>
            <p className="mt-0.5 text-xs" style={{ color: 'var(--text-muted)' }}>
              Creates an account with no workspace membership and no tenant role. Add them to a
              workspace separately when needed.
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
          <div className="space-y-4 px-6 py-5">
            <div>
              <label
                className="mb-1.5 block text-xs font-semibold"
                style={{ color: 'var(--text-secondary)' }}
              >
                Email address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e: ChangeEvent<HTMLInputElement>) => {
                  setEmail(e.target.value);
                }}
                placeholder="person@example.com"
                required
                className="focus:border-brand-primary w-full rounded-xl border px-4 py-2.5 text-sm outline-none transition-colors"
                style={{
                  borderColor: 'var(--border-light)',
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
                Name (optional)
              </label>
              <input
                type="text"
                value={name}
                onChange={(e: ChangeEvent<HTMLInputElement>) => {
                  setName(e.target.value);
                }}
                placeholder="Jane Doe"
                className="focus:border-brand-primary w-full rounded-xl border px-4 py-2.5 text-sm outline-none transition-colors"
                style={{
                  borderColor: 'var(--border-light)',
                  background: 'var(--bg-main)',
                  color: 'var(--text-primary)',
                }}
              />
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
              disabled={isPending || !email}
              className="brand-gradient rounded-xl px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {isPending ? 'Creating…' : 'Add user'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
