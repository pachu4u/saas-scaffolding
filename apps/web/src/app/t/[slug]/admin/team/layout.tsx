import { auth } from '@platform/auth';
import { can, Permission } from '@platform/authz';
import { adminDb } from '@platform/db';
import { redirect } from 'next/navigation';

import { InnerNav } from '@/components/layout/inner-nav';
import { Topbar } from '@/components/layout/topbar';
import { InviteButton } from '@/components/team/invite-button';
import { getCurrentTenant } from '@/lib/server-tenant';

export default async function TeamLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect('/auth/signin');

  const { tenant } = await getCurrentTenant(session.user.id);
  const tenantSlug = tenant?.slug ?? 'workspace';

  // "Roles & Permissions" management requires USERS_UPDATE, same as the page
  // itself and its write APIs — hide the link for members who can only view
  // (e.g. tenant_viewer) rather than send them to a page that redirects away.
  let canManageRoles = false;
  if (tenant) {
    const userRecord = await adminDb.user.findUnique({
      where: { externalId: session.user.id },
      select: { id: true, email: true },
    });
    if (userRecord) {
      canManageRoles = await can(
        {
          user: { id: userRecord.id, externalId: session.user.id, email: userRecord.email },
          tenantId: tenant.tenantId,
          plan: tenant.plan,
        },
        Permission.USERS_UPDATE,
      );
    }
  }

  const teamNav = [
    { label: 'Members', href: '/admin/team' },
    ...(canManageRoles ? [{ label: 'Roles & Permissions', href: '/admin/team/roles' }] : []),
  ];

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
