import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="z-10 max-w-2xl w-full text-center">
        <h1 className="text-5xl font-bold mb-4 text-gray-900">SaaS Platform</h1>
        <p className="text-xl text-gray-600 mb-8">
          Enterprise-grade multi-tenant SaaS scaffolding
        </p>
        <div className="flex gap-4 justify-center">
          <Link
            href="/api/auth/signin"
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Sign in
          </Link>
          <Link
            href="/_health"
            className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
          >
            Health Check
          </Link>
        </div>
      </div>
    </main>
  );
}
