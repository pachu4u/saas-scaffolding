'use client';

import { useRouter } from 'next/navigation';
import {
  type ChangeEvent,
  type MouseEvent,
  type SyntheticEvent,
  useRef,
  useState,
  useTransition,
} from 'react';

interface CreateConnectedAppModalProps {
  onClose: () => void;
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function CreateConnectedAppModal({ onClose }: CreateConnectedAppModalProps) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [description, setDescription] = useState('');
  const [docsUrl, setDocsUrl] = useState('');
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  function handleOverlayClick(e: MouseEvent<HTMLDivElement>) {
    if (e.target === overlayRef.current) onClose();
  }

  function handleNameChange(e: ChangeEvent<HTMLInputElement>) {
    setName(e.target.value);
    if (!slugTouched) setSlug(slugify(e.target.value));
  }

  function handleSubmit(e: SyntheticEvent) {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      try {
        const res = await fetch('/api/admin/connected-apps', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name,
            slug,
            description: description || undefined,
            docsUrl: docsUrl || undefined,
          }),
        });
        const data = (await res.json()) as { id?: string; error?: string };
        if (!res.ok) {
          setError(data.error ?? 'Failed to create app');
          return;
        }
        router.refresh();
        onClose();
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
        <div
          className="flex items-center justify-between border-b px-6 py-5"
          style={{ borderColor: 'var(--border-light)' }}
        >
          <div>
            <h2 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>
              Connect an app
            </h2>
            <p className="mt-0.5 text-xs" style={{ color: 'var(--text-muted)' }}>
              Registers the app in the SCIM identity registry. Per-tenant SCIM URL, token, and
              app-specific roles are configured on the app&apos;s detail page next.
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
            <div>
              <label
                className="mb-1.5 block text-xs font-semibold"
                style={{ color: 'var(--text-secondary)' }}
              >
                App name
              </label>
              <input
                type="text"
                value={name}
                onChange={handleNameChange}
                placeholder="Riogentix"
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
                Slug
              </label>
              <input
                type="text"
                value={slug}
                onChange={(e: ChangeEvent<HTMLInputElement>) => {
                  setSlugTouched(true);
                  setSlug(slugify(e.target.value));
                }}
                placeholder="riogentix"
                required
                className="focus:border-brand-primary w-full rounded-xl border px-4 py-2.5 font-mono text-sm outline-none transition-colors"
                style={{
                  borderColor: 'var(--border-light)',
                  background: 'var(--bg-main)',
                  color: 'var(--text-primary)',
                }}
              />
              <p className="mt-1 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                Used to identify the app internally (e.g. in ConnectedAppInstance rows). Cannot be
                changed later.
              </p>
            </div>

            <div>
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
                placeholder="What this app is for"
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
                Docs URL
              </label>
              <input
                type="url"
                value={docsUrl}
                onChange={(e: ChangeEvent<HTMLInputElement>) => {
                  setDocsUrl(e.target.value);
                }}
                placeholder="https://docs.example.com"
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
              {isPending ? 'Creating…' : 'Connect app'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
