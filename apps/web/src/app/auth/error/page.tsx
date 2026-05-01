'use client';

import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

export default function AuthErrorPage() {
  const params = useSearchParams();
  const error = params.get('error');

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="w-full max-w-sm space-y-4 rounded-xl border border-red-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-bold text-red-700">Authentication Error</h1>
        {error && (
          <p className="text-sm text-gray-600">
            Error: <code className="rounded bg-gray-100 px-1">{error}</code>
          </p>
        )}
        <Link
          href="/auth/signin"
          className="inline-block rounded-lg bg-blue-600 px-4 py-2 text-white font-medium hover:bg-blue-700"
        >
          Try again
        </Link>
      </div>
    </main>
  );
}
