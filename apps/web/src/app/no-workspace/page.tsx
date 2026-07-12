import { auth } from '@platform/auth';
import { redirect } from 'next/navigation';

export const metadata = { title: 'No workspace access' };

// Landing spot for authenticated users who aren't a member of any tenant yet.
// Tenants are provisioned by platform admins (via /onboarding) — there is no
// self-serve tenant creation, so this page just points the user at their admin
// rather than offering a "create workspace" action.
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
          {session.user.email} isn&apos;t a member of any tenant yet. Ask your administrator to
          invite you, or contact them to have a tenant set up.
        </p>
        <a
          href="/api/auth/keycloak-logout"
          className="mt-6 inline-block text-sm font-semibold hover:underline"
          style={{ color: 'var(--brand-primary)' }}
        >
          Sign out
        </a>
      </div>
    </div>
  );
}
