import { auth } from '@platform/auth';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Riogentix App' };

export default async function TenantAppPage() {
  const session = await auth();
  if (!session) redirect('/auth/signin');

  const riogentixUrl = process.env.RIOGENTIX_PUBLIC_URL;

  if (riogentixUrl) {
    redirect(riogentixUrl);
  }

  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center gap-4 p-8"
      style={{ background: 'var(--bg-main)' }}
    >
      <div
        className="flex h-16 w-16 items-center justify-center rounded-2xl"
        style={{ background: 'rgba(176,108,255,0.12)', color: 'var(--brand-accent)' }}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.7}
          className="h-8 w-8"
        >
          <polygon points="12 2 2 7 12 12 22 7 12 2" />
          <polyline points="2 17 12 22 22 17" />
          <polyline points="2 12 12 17 22 12" />
        </svg>
      </div>
      <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
        Riogentix App
      </h1>
      <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
        The application URL is not configured. Set{' '}
        <code className="rounded bg-gray-100 px-1 py-0.5 font-mono text-xs">
          RIOGENTIX_PUBLIC_URL
        </code>{' '}
        in your environment.
      </p>
      <a
        href="/"
        className="text-sm font-semibold hover:underline"
        style={{ color: 'var(--brand-primary)' }}
      >
        ← Back to home
      </a>
    </div>
  );
}
