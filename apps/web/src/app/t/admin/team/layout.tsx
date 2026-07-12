import { auth } from '@platform/auth';
import { redirect } from 'next/navigation';

import { InnerNav } from '@/components/layout/inner-nav';
import { Topbar } from '@/components/layout/topbar';
import { InviteButton } from '@/components/team/invite-button';
import { getCurrentTenant } from '@/lib/server-tenant';

const teamNav = [
  { label: 'Members', href: '/admin/team' },
  { label: 'Roles & Permissions', href: '/admin/team/roles' },
];

export default async function TeamLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect('/auth/signin');

  const { tenant } = await getCurrentTenant(session.user.id);
  const tenantSlug = tenant?.slug ?? 'workspace';

  return (
    <div>
      <Topbar
        title="Team"
        subtitle="Manage members, roles, and permissions"
        userEmail={session.user.email}
        userName={session.user.name ?? undefined}
        actions={<InviteButton tenantSlug={tenantSlug} />}
      />
      <div
        className="border-b"
        style={{ background: 'var(--bg-white)', borderColor: 'var(--border-light)' }}
      >
        <InnerNav items={teamNav} />
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}
