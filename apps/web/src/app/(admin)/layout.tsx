import { auth } from '@platform/auth';
import { redirect } from 'next/navigation';

import { Sidebar } from '@/components/layout/sidebar';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect('/auth/signin');

  const isPlatformAdmin =
    Array.isArray(session?.groups) &&
    (session.groups as string[]).some((g: string) =>
      ['platform_super_admin', 'platform_support'].includes(g),
    );

  if (!isPlatformAdmin) redirect('/dashboard');

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-main)' }}>
      <Sidebar isAdmin={true} />
      <div className="ml-56">{children}</div>
    </div>
  );
}
