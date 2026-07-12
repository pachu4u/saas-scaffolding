import { auth } from '@platform/auth';
import { redirect } from 'next/navigation';

import { getCurrentTenant } from '@/lib/server-tenant';

export const dynamic = 'force-dynamic';

export default async function TenantShellLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect('/auth/signin');

  const { tenant, membershipCount } = await getCurrentTenant(session.user.id);

  if (tenant?.status === 'SUSPENDED') redirect('/suspended');
  if (membershipCount === 0) redirect('/no-workspace');

  return <>{children}</>;
}
