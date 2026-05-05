'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log to your error-reporting service here
    console.error('[GlobalError]', error);
  }, [error]);

  return (
    <div
      className="flex min-h-screen items-center justify-center px-6"
      style={{ background: 'var(--bg-main)' }}
    >
      <div className="w-full max-w-md text-center">
        <div
          className="mx-auto mb-8 flex h-20 w-20 items-center justify-center rounded-3xl"
          style={{ background: 'rgba(220, 38, 38, 0.08)' }}
        >
          <svg className="h-10 w-10" viewBox="0 0 24 24" fill="none">
            <path
              d="M12 9v4M12 17h.01"
              stroke="#DC2626"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"
              stroke="#DC2626"
              strokeWidth="1.5"
            />
          </svg>
        </div>

        <h1 className="mb-3 text-2xl font-extrabold" style={{ color: 'var(--text-primary)' }}>
          Something went wrong
        </h1>
        <p className="mb-2 text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          An unexpected error occurred. Our team has been notified.
        </p>
        {error.digest && (
          <p className="mb-8 font-mono text-xs" style={{ color: 'var(--text-muted)' }}>
            Error ID: {error.digest}
          </p>
        )}

        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <button
            onClick={reset}
            className="brand-gradient rounded-xl px-6 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          >
            Try again
          </button>
          <a
            href="/dashboard"
            className="hover:bg-bg-subtle rounded-xl border px-6 py-3 text-center text-sm font-semibold transition-colors"
            style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}
          >
            Go to dashboard
          </a>
        </div>

        <div className="mt-12 flex items-center justify-center gap-2">
          <div className="brand-gradient flex h-6 w-6 items-center justify-center rounded-md text-xs font-bold text-white">
            R
          </div>
          <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            riogentix
          </span>
        </div>
      </div>
    </div>
  );
}
