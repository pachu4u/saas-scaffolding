import { auth } from '@platform/auth';
import { redirect } from 'next/navigation';

import { InnerNav } from '@/components/layout/inner-nav';
import { Topbar } from '@/components/layout/topbar';
import { InviteButton } from '@/components/team/invite-button';

const teamNav = [
  { label: 'Members', href: '/team' },
  { label: 'Roles & Permissions', href: '/team/roles' },
];

export default async function TeamLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect('/auth/signin');

  const tenantSlug = process.env.NEXT_PUBLIC_DEFAULT_TENANT_SLUG ?? 'acme';

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
