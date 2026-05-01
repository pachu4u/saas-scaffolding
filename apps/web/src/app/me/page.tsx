import { auth, signOut } from '@platform/auth';
import { redirect } from 'next/navigation';

export const metadata = { title: 'My Profile' };

export default async function MePage() {
  const session = await auth();
  if (!session) redirect('/auth/signin');

  return (
    <div
      className="flex min-h-screen items-center justify-center p-6"
      style={{ background: 'var(--bg-main)' }}
    >
      <div className="w-full max-w-xl space-y-6">
        <div className="mb-8 flex items-center gap-2">
          <div className="brand-gradient flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold text-white">
            R
          </div>
          <span className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
            riogentix
          </span>
        </div>

        <div
          className="rounded-2xl border"
          style={{
            background: 'var(--bg-white)',
            borderColor: 'var(--border-light)',
            boxShadow: 'var(--shadow-card)',
          }}
        >
          <div
            className="flex items-center justify-between border-b px-6 py-5"
            style={{ borderColor: 'var(--border-light)' }}
          >
            <div className="flex items-center gap-3">
              <div className="brand-gradient flex h-10 w-10 items-center justify-center rounded-full font-bold text-white">
                {session.user.name?.[0] ?? session.user.email[0]}
              </div>
              <div>
                <h1 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>
                  My Profile
                </h1>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  Authenticated session details
                </p>
              </div>
            </div>
            <form
              action={async () => {
                'use server';
                await signOut({ redirectTo: '/' });
              }}
            >
              <button
                type="submit"
                className="hover:bg-bg-subtle rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors"
                style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}
              >
                Sign out
              </button>
            </form>
          </div>

          <dl className="divide-y px-6" style={{ borderColor: 'var(--border-light)' }}>
            <Row label="ID" value={session.user.id} mono />
            <Row label="Email" value={session.user.email} />
            <Row label="Name" value={session.user.name ?? '—'} />
            <Row label="Groups / Tenants" value={JSON.stringify(session.groups, null, 2)} mono />
          </dl>

          <div className="px-6 pb-4">
            <details className="mt-4 text-sm">
              <summary
                className="cursor-pointer text-xs font-semibold hover:underline"
                style={{ color: 'var(--text-muted)' }}
              >
                Raw session token
              </summary>
              <pre
                className="mt-3 overflow-x-auto rounded-xl p-4 font-mono text-xs"
                style={{ background: 'var(--bg-main)', color: 'var(--text-secondary)' }}
              >
                {JSON.stringify(session, null, 2)}
              </pre>
            </details>
          </div>
        </div>

        <div className="text-center">
          <a
            href="/dashboard"
            className="text-sm font-semibold hover:underline"
            style={{ color: 'var(--brand-primary)' }}
          >
            → Go to dashboard
          </a>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="grid grid-cols-3 gap-4 py-3.5">
      <dt
        className="text-xs font-semibold uppercase tracking-wide"
        style={{ color: 'var(--text-muted)' }}
      >
        {label}
      </dt>
      <dd
        className={`col-span-2 break-all text-sm ${mono ? 'font-mono text-xs' : ''}`}
        style={{ color: 'var(--text-secondary)' }}
      >
        {value}
      </dd>
    </div>
  );
}
