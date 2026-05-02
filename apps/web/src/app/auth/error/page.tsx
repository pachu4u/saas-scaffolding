import Link from 'next/link';

export const metadata = { title: 'Authentication Error' };

const errorMessages: Record<string, { title: string; description: string }> = {
  Configuration: {
    title: 'Server configuration error',
    description:
      'There is a problem with the server configuration. Please contact your administrator.',
  },
  AccessDenied: {
    title: 'Access denied',
    description: 'You do not have permission to sign in to this workspace.',
  },
  Verification: {
    title: 'Link expired',
    description: 'This sign-in link has expired or has already been used.',
  },
  Default: {
    title: 'Authentication failed',
    description: 'An unexpected error occurred during sign in. Please try again.',
  },
};

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error: errorParam } = await searchParams;
  const errorKey = errorParam ?? 'Default';
  const error = errorMessages[errorKey] ??
    errorMessages.Default ?? {
      title: 'Authentication failed',
      description: 'An unexpected error occurred during sign in. Please try again.',
    };

  return (
    <div
      className="flex min-h-screen items-center justify-center px-6"
      style={{ background: 'var(--bg-main)' }}
    >
      <div className="w-full max-w-sm text-center">
        <div
          className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl"
          style={{ background: 'rgba(220, 38, 38, 0.08)' }}
        >
          <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="#DC2626" strokeWidth="1.5" />
            <path d="M12 7v5M12 16v.5" stroke="#DC2626" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </div>

        <h1 className="mb-2 text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
          {error.title}
        </h1>
        <p className="mb-8 text-sm" style={{ color: 'var(--text-secondary)' }}>
          {error.description}
        </p>

        <div className="flex flex-col gap-3">
          <Link
            href="/auth/signin"
            className="brand-gradient rounded-xl py-3 text-center text-sm font-semibold text-white transition-opacity hover:opacity-90"
          >
            Try signing in again
          </Link>
          <Link
            href="/"
            className="rounded-xl border py-3 text-center text-sm font-semibold transition-colors"
            style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}
          >
            Back to home
          </Link>
        </div>

        <p className="mt-8 text-xs" style={{ color: 'var(--text-muted)' }}>
          Error code: <code className="font-mono">{errorKey}</code>
        </p>
      </div>
    </div>
  );
}
