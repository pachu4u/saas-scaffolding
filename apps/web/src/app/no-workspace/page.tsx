import { auth } from '@platform/auth';
import Link from 'next/link';
import { redirect } from 'next/navigation';

export const metadata = { title: 'No workspace access' };

export default async function NoWorkspacePage() {
  const session = await auth();
  if (!session) redirect('/auth/signin');

  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center p-6 text-center"
      style={{ background: 'var(--bg-main)' }}
    >
      <div
        className="w-full max-w-md rounded-3xl border p-8"
        style={{
          background: 'var(--bg-white)',
          borderColor: 'var(--border-light)',
          boxShadow: 'var(--shadow-brand)',
        }}
      >
        <div
          className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full text-2xl"
          style={{ background: 'rgba(79,123,255,0.1)' }}
        >
          👋
        </div>
        <h1 className="text-lg font-extrabold" style={{ color: 'var(--text-primary)' }}>
          No workspace yet
        </h1>
        <p className="mt-2 text-sm" style={{ color: 'var(--text-muted)' }}>
          {session.user.email} isn&apos;t a member of any tenant yet.
        </p>
        <p className="mt-2 text-sm" style={{ color: 'var(--text-muted)' }}>
          Ask your administrator to invite you, or create your own workspace.
        </p>
        <div className="mt-6 flex flex-col gap-3">
          <Link
            href="/signup"
            className="brand-gradient block rounded-xl py-2.5 text-center text-sm font-semibold text-white transition-opacity hover:opacity-90"
          >
            Create a workspace →
          </Link>
          <a
            href="/api/auth/keycloak-logout"
            className="block text-sm font-semibold hover:underline"
            style={{ color: 'var(--text-muted)' }}
          >
            Sign out
          </a>
        </div>
      </div>
    </div>
  );
}
