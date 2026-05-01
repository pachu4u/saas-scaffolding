import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = { title: '404 — Page not found' };

export default function NotFound() {
  return (
    <div
      className="flex min-h-screen items-center justify-center px-6"
      style={{ background: 'var(--bg-main)' }}
    >
      <div className="w-full max-w-md text-center">
        <div className="brand-gradient-text mb-4 select-none text-8xl font-extrabold">404</div>

        <h1 className="mb-3 text-2xl font-extrabold" style={{ color: 'var(--text-primary)' }}>
          Page not found
        </h1>
        <p className="mb-8 text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>

        <div className="flex flex-col justify-center gap-3 sm:flex-row">
          <Link
            href="/dashboard"
            className="brand-gradient rounded-xl px-6 py-3 text-center text-sm font-semibold text-white transition-opacity hover:opacity-90"
          >
            Go to dashboard
          </Link>
          <Link
            href="/"
            className="hover:bg-bg-subtle rounded-xl border px-6 py-3 text-center text-sm font-semibold transition-colors"
            style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}
          >
            Back to home
          </Link>
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
