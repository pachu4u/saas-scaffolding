import { auth, signIn } from '@platform/auth';
import { adminDb } from '@platform/db';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { CreateAccountForm, type CreateAccountState } from './create-account-form';

import { acceptInvite as acceptInviteMembership } from '@/lib/accept-invite';
import { decodeInviteToken } from '@/lib/invite-token';
import { createKeycloakUserWithPassword } from '@/lib/keycloak-admin';

export const metadata: Metadata = { title: 'Accept Invitation — riogentix' };

/**
 * Invited members never get a Keycloak account provisioned for them the way
 * signup's first admin does — the invite token itself is the proof of
 * eligibility to create one (registrationAllowed is false in this realm, so
 * there's no other self-service path). Only reachable while User.externalId
 * still has its placeholder "pending-" value from POST /api/team/invite.
 */
async function createAccountAndSignIn(
  token: string,
  _prevState: CreateAccountState,
  formData: FormData,
): Promise<CreateAccountState> {
  'use server';
  const { tenantId, userId } = decodeInviteToken(token);
  if (!tenantId || !userId) return { error: 'This invitation link is invalid or has expired.' };

  const nameField = formData.get('name');
  const passwordField = formData.get('password');
  const confirmPasswordField = formData.get('confirmPassword');
  const name = typeof nameField === 'string' ? nameField.trim() : '';
  const password = typeof passwordField === 'string' ? passwordField : '';
  const confirmPassword = typeof confirmPasswordField === 'string' ? confirmPasswordField : '';

  if (!name) return { error: 'Your name is required.' };
  if (password.length < 8) return { error: 'Password must be at least 8 characters.' };
  if (password !== confirmPassword) return { error: 'Passwords do not match.' };

  const user = await adminDb.user.findUnique({ where: { id: userId } });
  if (!user) return { error: 'This invitation link is invalid or has expired.' };

  if (!user.externalId.startsWith('pending-')) {
    // An account was already created for this invite since the page loaded
    // (e.g. a second tab) — sign in with it instead of creating another.
    redirect(`/auth/signin?callbackUrl=${encodeURIComponent(`/invite/${token}`)}`);
  }

  let kcUserId: string;
  try {
    kcUserId = await createKeycloakUserWithPassword(user.email, password, name);
  } catch {
    return {
      error: 'Could not create your account. Please try again or contact your administrator.',
    };
  }

  await adminDb.user.update({ where: { id: userId }, data: { externalId: kcUserId, name } });

  await signIn('keycloak', { redirectTo: `/invite/${token}` });
  return null;
}

async function signInToAccept(token: string) {
  'use server';
  await signIn('keycloak', { redirectTo: `/invite/${token}` });
}

async function acceptInvite(token: string) {
  'use server';
  const { tenantId, userId } = decodeInviteToken(token);
  if (!tenantId || !userId) return;

  const session = await auth();
  const sessionDbUser = session?.user
    ? await adminDb.user.findUnique({
        where: { externalId: session.user.id },
        select: { id: true },
      })
    : null;

  const result = await acceptInviteMembership(tenantId, userId, sessionDbUser?.id ?? null);
  if (result.success) {
    redirect(
      'tenantSlug' in result && result.tenantSlug ? `/t/${result.tenantSlug}` : '/dashboard',
    );
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
    adminDb.user.findUnique({ where: { id: userId }, select: { email: true, externalId: true } }),
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

  const session = await auth();

  // Not signed in yet. A brand-new invitee (no Keycloak account — see the
  // "pending-" externalId set by POST /api/team/invite) needs to create one
  // before anything else is possible; the invite token is their proof of
  // eligibility, since this realm has self-registration disabled. Someone
  // who already has an account (e.g. invited to a second tenant) just needs
  // to sign in — send them through Keycloak with this URL as the return
  // target instead of the default post-login tenant redirect, which would
  // lose the token.
  if (!session?.user) {
    const isPending = user.externalId.startsWith('pending-');
    return (
      <div
        className="flex min-h-screen items-center justify-center px-6"
        style={{ background: 'var(--bg-main)' }}
      >
        <div className="w-full max-w-md">
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
            <div
              className="border-b px-8 pb-6 pt-8 text-center"
              style={{ borderColor: 'var(--border-light)' }}
            >
              <div className="brand-gradient mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-xl text-2xl font-bold text-white">
                {tenant.name[0]?.toUpperCase()}
              </div>
              <h1 className="mb-1 text-xl font-extrabold" style={{ color: 'var(--text-primary)' }}>
                {isPending ? 'Create your account' : "You've been invited"}
              </h1>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                {isPending
                  ? `Set a password for ${user.email} to join ${tenant.name}`
                  : `Sign in as ${user.email} to join ${tenant.name}`}
              </p>
            </div>
            {isPending ? (
              <CreateAccountForm action={createAccountAndSignIn.bind(null, token)} />
            ) : (
              <div className="px-8 pb-8 pt-6">
                <form action={signInToAccept.bind(null, token)}>
                  <button
                    type="submit"
                    className="brand-gradient w-full rounded-xl py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                  >
                    Continue with SSO →
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // This invite is only valid for the specific account it was issued to. If the
  // browser's current session belongs to someone else (a stale login left over
  // from a previous account, or the admin who sent the invite), accepting here
  // would activate the membership for the invited user while leaving the wrong
  // person signed in. Require them to sign out and back in as the invited
  // account first.
  const sessionDbUser = await adminDb.user.findUnique({
    where: { externalId: session.user.id },
    select: { id: true, email: true },
  });
  const wrongAccount = sessionDbUser && sessionDbUser.id !== userId;

  if (wrongAccount) {
    const returnTo = `/invite/${token}`;
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
            Wrong account
          </h1>
          <p className="mb-6 text-sm" style={{ color: 'var(--text-secondary)' }}>
            This invite is for <strong>{user.email}</strong>, but you&apos;re signed in as{' '}
            <strong>{sessionDbUser.email}</strong>. Sign out and sign back in as {user.email} to
            accept it.
          </p>
          <a
            href={`/api/auth/keycloak-logout?returnTo=${encodeURIComponent(returnTo)}`}
            className="brand-gradient inline-block rounded-xl px-6 py-3 text-sm font-semibold text-white"
          >
            Sign out and continue
          </a>
        </div>
      </div>
    );
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
