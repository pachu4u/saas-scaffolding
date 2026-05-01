import { auth } from '@platform/auth';
import { redirect } from 'next/navigation';

import { Sidebar } from '@/components/layout/sidebar';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect('/auth/signin');

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-main)' }}>
      <Sidebar tenantName="Platform Admin" isAdmin={true} />
      <div className="ml-60">{children}</div>
    </div>
  );
}
