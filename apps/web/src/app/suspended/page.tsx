import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = { title: 'Workspace Suspended — riogentix' };

export default function SuspendedPage() {
  return (
    <div
      className="flex min-h-screen items-center justify-center px-6"
      style={{ background: 'var(--bg-main)' }}
    >
      <div className="w-full max-w-md text-center">
        {/* Lock icon */}
        <div
          className="mx-auto mb-8 flex h-20 w-20 items-center justify-center rounded-3xl"
          style={{ background: 'rgba(220, 38, 38, 0.08)' }}
        >
          <svg className="h-10 w-10" viewBox="0 0 24 24" fill="none">
            <path
              d="M17 11V7a5 5 0 0 0-10 0v4"
              stroke="#DC2626"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
            <rect x="3" y="11" width="18" height="11" rx="2" stroke="#DC2626" strokeWidth="1.5" />
            <circle cx="12" cy="16" r="1.5" fill="#DC2626" />
          </svg>
        </div>

        <div
          className="mb-6 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold"
          style={{ background: 'rgba(220, 38, 38, 0.1)', color: '#DC2626' }}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
          Workspace suspended
        </div>

        <h1 className="mb-3 text-2xl font-extrabold" style={{ color: 'var(--text-primary)' }}>
          This workspace has been suspended
        </h1>
        <p className="mb-8 text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          Access to this workspace has been temporarily suspended. This may be due to a billing
          issue, a policy violation, or a request by your administrator.
        </p>

        <div
          className="mb-8 rounded-2xl border p-5 text-left"
          style={{ background: 'var(--bg-white)', borderColor: 'var(--border-light)' }}
        >
          <h2 className="mb-3 text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
            What to do next
          </h2>
          <ul className="space-y-2">
            {[
              'Contact your workspace administrator',
              'Check your billing status and update payment methods',
              'Review any policy notices sent to your email',
            ].map((step) => (
              <li
                key={step}
                className="flex items-start gap-2 text-sm"
                style={{ color: 'var(--text-secondary)' }}
              >
                <svg
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className="mt-0.5 h-4 w-4 flex-shrink-0"
                  style={{ color: 'var(--text-muted)' }}
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16zm.75-11.25a.75.75 0 0 0-1.5 0v4.59L7.3 9.24a.75.75 0 0 0-1.1 1.02l3.25 3.5a.75.75 0 0 0 1.1 0l3.25-3.5a.75.75 0 1 0-1.1-1.02l-1.95 2.1V6.75z"
                    clipRule="evenodd"
                  />
                </svg>
                {step}
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-col gap-3">
          <a
            href="mailto:support@riogentix.io"
            className="brand-gradient rounded-xl py-3 text-center text-sm font-semibold text-white transition-opacity hover:opacity-90"
          >
            Contact support
          </a>
          <Link
            href="/auth/signin"
            className="hover:bg-bg-subtle rounded-xl border py-3 text-center text-sm font-semibold transition-colors"
            style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}
          >
            Sign in with a different account
          </Link>
        </div>

        <p className="mt-8 text-xs" style={{ color: 'var(--text-muted)' }}>
          Need urgent help?{' '}
          <a href="mailto:support@riogentix.io" className="underline">
            support@riogentix.io
          </a>
        </p>
      </div>
    </div>
  );
}
