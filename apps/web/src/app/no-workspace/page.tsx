import { auth } from '@platform/auth';
import { adminDb } from '@platform/db';
import Link from 'next/link';
import { redirect } from 'next/navigation';

export const metadata = { title: 'No workspace access' };

export default async function NoWorkspacePage() {
  const session = await auth();
  if (!session) redirect('/auth/signin');

  const pending = await adminDb.tenantUser.findFirst({
    where: {
      user: { externalId: session.user.id },
      tenant: { status: 'PENDING_APPROVAL' },
    },
    select: { tenant: { select: { name: true } } },
  });

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
        {pending ? (
          <>
            <h1 className="text-lg font-extrabold" style={{ color: 'var(--text-primary)' }}>
              Awaiting approval
            </h1>
            <p className="mt-2 text-sm" style={{ color: 'var(--text-muted)' }}>
              Your request for <strong>{pending.tenant.name}</strong> is being reviewed by our team.
              We&apos;ll email {session.user.email} as soon as it&apos;s approved.
            </p>
          </>
        ) : (
          <>
            <h1 className="text-lg font-extrabold" style={{ color: 'var(--text-primary)' }}>
              No workspace yet
            </h1>
            <p className="mt-2 text-sm" style={{ color: 'var(--text-muted)' }}>
              {session.user.email} isn&apos;t a member of any tenant yet.
            </p>
            <p className="mt-2 text-sm" style={{ color: 'var(--text-muted)' }}>
              Ask your administrator to invite you, or request your own workspace.
            </p>
          </>
        )}
        <div className="mt-6 flex flex-col gap-3">
          {!pending && (
            <Link
              href="/signup"
              className="brand-gradient block rounded-xl py-2.5 text-center text-sm font-semibold text-white transition-opacity hover:opacity-90"
            >
              Request a workspace →
            </Link>
          )}
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
