import { auth } from '@platform/auth';
import { redirect } from 'next/navigation';

import { Sidebar } from '@/components/layout/sidebar';
import { SidebarProvider } from '@/components/layout/sidebar-context';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect('/auth/signin');

  const isPlatformAdmin =
    Array.isArray(session.groups) &&
    session.groups.some((g: string) => ['platform_super_admin', 'platform_support'].includes(g));

  if (!isPlatformAdmin) redirect('/dashboard');

  return (
    <SidebarProvider>
      <div className="min-h-screen" style={{ background: 'var(--bg-main)' }}>
        <Sidebar isAdmin={true} />
        <div className="lg:ml-[var(--sidebar-width)]">{children}</div>
      </div>
    </SidebarProvider>
  );
}
