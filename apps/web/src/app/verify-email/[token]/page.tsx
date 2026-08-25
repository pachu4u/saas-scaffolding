import type { Metadata } from 'next';
import Link from 'next/link';

import { decodeEmailVerificationToken } from '@/lib/email-verification-token';
import { verifyEmailAndProvision } from '@/lib/verify-email';

export const metadata: Metadata = { title: 'Verify Email — riogentix' };

function ErrorCard({ title, body }: { title: string; body: string }) {
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
          {title}
        </h1>
        <p className="mb-6 text-sm" style={{ color: 'var(--text-secondary)' }}>
          {body}
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

export default async function VerifyEmailPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const { userId, tenantId } = decodeEmailVerificationToken(token);

  if (!userId || !tenantId) {
    return (
      <ErrorCard
        title="Invalid or expired link"
        body="This verification link has expired or is invalid. Sign up again to get a fresh one."
      />
    );
  }

  const result = await verifyEmailAndProvision(userId, tenantId);

  if (result.status === 'not-found') {
    return (
      <ErrorCard
        title="Account not found"
        body="We couldn't find the account for this link. It may have been removed."
      />
    );
  }

  return (
    <div
      className="flex min-h-screen items-center justify-center px-6"
      style={{ background: 'var(--bg-main)' }}
    >
      <div className="w-full max-w-sm text-center">
        <div
          className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-xl text-3xl"
          style={{ background: 'rgba(79,123,255,0.1)' }}
        >
          ✓
        </div>
        <h1 className="mb-2 text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
          Email verified
        </h1>
        <p className="mb-6 text-sm" style={{ color: 'var(--text-secondary)' }}>
          {result.status === 'verified'
            ? "We're setting up your workspace now — this usually takes a couple of minutes. If it's not ready the moment you sign in, give it a bit longer and try again."
            : 'Your workspace is already set up.'}
        </p>
        <Link
          href="/auth/signin"
          className="brand-gradient inline-block rounded-xl px-6 py-3 text-sm font-semibold text-white"
        >
          Sign in →
        </Link>
      </div>
    </div>
  );
}
