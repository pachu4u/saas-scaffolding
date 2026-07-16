'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState, useTransition } from 'react';

import { useTenantBase } from '@/lib/use-tenant-base';

export function CreateRoleButton() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const overlayRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const base = useTenantBase();

  function handleOverlayClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === overlayRef.current) setOpen(false);
  }

  function handleSubmit(e: React.SyntheticEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setError(null);

    startTransition(async () => {
      try {
        const res = await fetch('/api/team/roles', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: name.trim(), permissions: [] }),
        });
        const data = (await res.json()) as { error?: string; id?: string };
        if (!res.ok || !data.id) {
          setError(data.error ?? 'Failed to create role');
          return;
        }
        setOpen(false);
        setName('');
        router.push(`${base}/admin/team/roles/${data.id}`);
      } catch {
        setError('Something went wrong. Please try again.');
      }
    });
  }

  return (
    <>
      <button
        onClick={() => {
          setOpen(true);
        }}
        className="hover:border-brand-secondary hover:bg-bg-subtle rounded-xl border-2 border-dashed p-5 text-left transition-all"
        style={{ borderColor: 'var(--border-default)' }}
      >
        <div
          className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl text-2xl"
          style={{ background: 'var(--bg-subtle)' }}
        >
          +
        </div>
        <div className="mb-1 text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
          Create custom role
        </div>
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          Define a role with exactly the permissions your team needs.
        </p>
      </button>

      {open && (
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
            <div
              className="flex items-center justify-between border-b px-6 py-5"
              style={{ borderColor: 'var(--border-light)' }}
            >
              <div>
                <h2 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>
                  Create custom role
                </h2>
                <p className="mt-0.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                  You can choose its permissions on the next screen.
                </p>
              </div>
              <button
                onClick={() => {
                  setOpen(false);
                }}
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
                    Role name
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                    }}
                    placeholder="Support Agent"
                    required
                    className="w-full rounded-xl border px-4 py-2.5 text-sm outline-none"
                    style={{
                      borderColor: 'var(--border-light)',
                      background: 'var(--bg-main)',
                      color: 'var(--text-primary)',
                    }}
                  />
                </div>
                {error && <p className="text-xs text-red-600">{error}</p>}
              </div>

              <div
                className="flex items-center justify-end gap-3 border-t px-6 py-4"
                style={{ borderColor: 'var(--border-light)' }}
              >
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                  }}
                  className="hover:bg-bg-subtle rounded-xl border px-4 py-2 text-sm font-semibold transition-colors"
                  style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending || !name.trim()}
                  className="brand-gradient rounded-xl px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  {isPending ? 'Creating…' : 'Create role'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
