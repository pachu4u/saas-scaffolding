import { redirect } from 'next/navigation';

import { auth, signOut } from '@platform/auth';

export default async function MePage() {
  const session = await auth();
  if (!session) redirect('/auth/signin');

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="w-full max-w-2xl space-y-6 rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">My Profile</h1>
          <form
            action={async () => {
              'use server';
              await signOut({ redirectTo: '/' });
            }}
          >
            <button
              type="submit"
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Sign out
            </button>
          </form>
        </div>

        <dl className="divide-y divide-gray-100">
          <Row label="ID" value={session.user.id} />
          <Row label="Email" value={session.user.email} />
          <Row label="Name" value={session.user.name ?? '—'} />
          <Row label="Groups / Tenants" value={JSON.stringify(session.groups ?? [], null, 2)} mono />
        </dl>

        <details className="text-sm">
          <summary className="cursor-pointer text-gray-500 hover:text-gray-700">Raw session</summary>
          <pre className="mt-2 overflow-x-auto rounded bg-gray-50 p-4 text-xs">
            {JSON.stringify(session, null, 2)}
          </pre>
        </details>
      </div>
    </main>
  );
}

function Row({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="py-3 grid grid-cols-3 gap-4">
      <dt className="text-sm font-medium text-gray-500">{label}</dt>
      <dd className={`col-span-2 text-sm text-gray-900 ${mono ? 'font-mono' : ''}`}>{value}</dd>
    </div>
  );
}
