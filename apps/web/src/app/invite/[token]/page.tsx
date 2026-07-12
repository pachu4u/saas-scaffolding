import { adminDb } from '@platform/db';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { decodeInviteToken } from '@/app/api/team/invite/route';

export const metadata: Metadata = { title: 'Accept Invitation — riogentix' };

async function acceptInvite(token: string) {
  'use server';
  const res = await fetch(
    `${process.env.NEXTAUTH_URL ?? 'http://localhost:3000'}/api/team/invite/${token}/accept`,
    { method: 'POST', cache: 'no-store' },
  );
  const data = (await res.json()) as { success?: boolean; tenantSlug?: string | null };
  if (data.success) {
    redirect(data.tenantSlug ? `/dashboard` : '/dashboard');
  }
}

// Next.js requires Server Actions to be async even with no real await.
// eslint-disable-next-line @typescript-eslint/require-await
async function declineInvite(_token: string) {
  'use server';
  redirect('/');
}

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const { tenantId, userId } = decodeInviteToken(token);

  if (!tenantId || !userId) {
    return (
      <div
        className="flex min-h-screen items-center justify-center px-6"
        style={{ background: 'var(--bg-main)' }}
      >
        <div className="w-full max-w-sm text-center">
          <div
            className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-xl"
            style={{ background: 'rgba(220, 38, 38, 0.08)' }}
          >
            <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="#DC2626" strokeWidth="1.5" />
              <path d="M12 7v5M12 16v.5" stroke="#DC2626" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>
          <h1 className="mb-2 text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
            Invalid invite link
          </h1>
          <p className="mb-6 text-sm" style={{ color: 'var(--text-secondary)' }}>
            This invitation link has expired or is invalid. Please ask your administrator to send a
            new invite.
          </p>
          <Link
            href="/"
            className="brand-gradient inline-block rounded-xl px-6 py-3 text-sm font-semibold text-white"
          >
            Back to home
          </Link>
        </div>
      </div>
    );
  }

  // Fetch invite details
  const [tenant, user] = await Promise.all([
    adminDb.tenant.findUnique({ where: { id: tenantId }, select: { name: true, slug: true } }),
    adminDb.user.findUnique({ where: { id: userId }, select: { email: true } }),
  ]);

  const tenantUser = await adminDb.tenantUser.findUnique({
    where: { tenantId_userId: { tenantId, userId } },
  });

  if (!tenant || !user || !tenantUser) {
    redirect('/');
  }

  if (tenantUser.status === 'ACTIVE') {
    redirect('/dashboard');
  }

  const acceptWithToken = acceptInvite.bind(null, token);
  const declineWithToken = declineInvite.bind(null, token);

  return (
    <div
      className="flex min-h-screen items-center justify-center px-6"
      style={{ background: 'var(--bg-main)' }}
    >
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="mb-10 flex items-center justify-center gap-2">
          <div className="brand-gradient flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold text-white">
            R
          </div>
          <span className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
            riogentix
          </span>
        </div>

        <div
          className="overflow-hidden rounded-xl border"
          style={{
            background: 'var(--bg-white)',
            borderColor: 'var(--border-light)',
            boxShadow: 'var(--shadow-card)',
          }}
        >
          {/* Header */}
          <div
            className="border-b px-8 pb-6 pt-8 text-center"
            style={{ borderColor: 'var(--border-light)' }}
          >
            <div className="brand-gradient mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-xl text-2xl font-bold text-white">
              {tenant.name[0]?.toUpperCase()}
            </div>
            <h1 className="mb-1 text-xl font-extrabold" style={{ color: 'var(--text-primary)' }}>
              You&apos;ve been invited
            </h1>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              Join <strong>{tenant.name}</strong> on riogentix
            </p>
          </div>

          {/* Details */}
          <div className="space-y-4 px-8 py-6">
            <div
              className="flex items-center gap-3 rounded-xl p-4"
              style={{ background: 'var(--bg-main)' }}
            >
              <div className="brand-gradient flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold text-white">
                {user.email[0]?.toUpperCase()}
              </div>
              <div>
                <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                  {user.email}
                </div>
                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  Invited to {tenant.name}
                </div>
              </div>
            </div>

            <div className="space-y-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
              {[
                'Access to all workspace resources',
                'Collaborate with your team',
                'Role-based permissions applied',
              ].map((item) => (
                <div key={item} className="flex items-center gap-2">
                  <svg
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    className="h-4 w-4 flex-shrink-0"
                    style={{ color: 'var(--status-success)' }}
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16zm3.707-9.293a1 1 0 0 0-1.414-1.414L9 10.586 7.707 9.293a1 1 0 0 0-1.414 1.414l2 2a1 1 0 0 0 1.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                  {item}
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-3 px-8 pb-8">
            <form action={acceptWithToken}>
              <button
                type="submit"
                className="brand-gradient w-full rounded-xl py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
              >
                Accept invitation →
              </button>
            </form>
            <form action={declineWithToken}>
              <button
                type="submit"
                className="hover:bg-bg-subtle w-full rounded-xl border py-3 text-sm font-semibold transition-colors"
                style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}
              >
                Decline
              </button>
            </form>
          </div>
        </div>

        <p className="mt-6 text-center text-xs" style={{ color: 'var(--text-muted)' }}>
          By accepting you agree to riogentix&apos;s{' '}
          <a href="/terms" className="underline">
            Terms of Service
          </a>
          .
        </p>
      </div>
    </div>
  );
}
