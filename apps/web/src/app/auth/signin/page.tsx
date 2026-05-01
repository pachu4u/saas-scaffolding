import { signIn } from '@platform/auth';

export default function SignInPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="w-full max-w-sm space-y-6 rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-bold text-gray-900">Sign in</h1>
        <form
          action={async () => {
            'use server';
            await signIn('keycloak');
          }}
        >
          <button
            type="submit"
            className="w-full rounded-lg bg-blue-600 px-4 py-2 text-white font-medium hover:bg-blue-700 transition-colors"
          >
            Continue with Keycloak
          </button>
        </form>
      </div>
    </main>
  );
}
