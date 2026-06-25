'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState, useTransition } from 'react';

export function CreateTenantButton() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [plan, setPlan] = useState('free');
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  function handleNameChange(v: string) {
    setName(v);
    // Auto-derive slug from name
    setSlug(
      v
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, ''),
    );
  }

  function handleOverlayClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === overlayRef.current) setOpen(false);
  }

  function handleSubmit(e: React.SyntheticEvent) {
    e.preventDefault();
    if (!name || !slug) return;
    setError(null);

    startTransition(async () => {
      try {
        const res = await fetch('/api/tenants', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, slug, plan }),
        });
        const data = (await res.json()) as { error?: string; id?: string };
        if (!res.ok) {
          setError(data.error ?? 'Failed to create tenant');
          return;
        }
        setOpen(false);
        setName('');
        setSlug('');
        setPlan('free');
        router.refresh();
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
        className="brand-gradient rounded-xl px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
      >
        + Create tenant
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
            {/* Header */}
            <div
              className="flex items-center justify-between border-b px-6 py-5"
              style={{ borderColor: 'var(--border-light)' }}
            >
              <div>
                <h2 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>
                  Create tenant
                </h2>
                <p className="mt-0.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                  Set up a new workspace on the platform.
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
                {/* Name */}
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
                    onChange={(e) => {
                      handleNameChange(e.target.value);
                    }}
                    placeholder="Acme Inc."
                    required
                    className="w-full rounded-xl border px-4 py-2.5 text-sm outline-none"
                    style={{
                      borderColor: 'var(--border-light)',
                      background: 'var(--bg-main)',
                      color: 'var(--text-primary)',
                    }}
                  />
                </div>

                {/* Slug */}
                <div>
                  <label
                    className="mb-1.5 block text-xs font-semibold"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    URL slug
                  </label>
                  <div
                    className="flex items-center overflow-hidden rounded-xl border"
                    style={{ borderColor: 'var(--border-light)' }}
                  >
                    <span
                      className="border-r px-3 py-2.5 text-sm"
                      style={{
                        background: 'var(--bg-subtle)',
                        color: 'var(--text-muted)',
                        borderColor: 'var(--border-light)',
                      }}
                    >
                      app.lvh.me/
                    </span>
                    <input
                      type="text"
                      value={slug}
                      onChange={(e) => {
                        setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''));
                      }}
                      placeholder="acme"
                      required
                      pattern="[a-z0-9-]+"
                      className="flex-1 px-3 py-2.5 text-sm outline-none"
                      style={{ background: 'var(--bg-main)', color: 'var(--text-primary)' }}
                    />
                  </div>
                </div>

                {/* Plan */}
                <div>
                  <label
                    className="mb-1.5 block text-xs font-semibold"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    Plan
                  </label>
                  <select
                    value={plan}
                    onChange={(e) => {
                      setPlan(e.target.value);
                    }}
                    className="w-full rounded-xl border px-4 py-2.5 text-sm outline-none"
                    style={{
                      borderColor: 'var(--border-light)',
                      background: 'var(--bg-main)',
                      color: 'var(--text-primary)',
                    }}
                  >
                    <option value="free">Free</option>
                    <option value="pro">Pro</option>
                    <option value="enterprise">Enterprise</option>
                  </select>
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
                  disabled={isPending || !name || !slug}
                  className="brand-gradient rounded-xl px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  {isPending ? 'Creating…' : 'Create tenant'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
