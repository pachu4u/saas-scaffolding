import { auth } from '@platform/auth';
import { adminDb } from '@platform/db';
import { redirect } from 'next/navigation';

import { AdminTenantsTable } from '@/components/admin/admin-tenants-table';
import { CreateTenantButton } from '@/components/admin/create-tenant-button';
import { Topbar } from '@/components/layout/topbar';

export const metadata = { title: 'Tenants — Admin' };

export default async function AdminTenantsPage() {
  const session = await auth();
  if (!session) redirect('/auth/signin');

  const tenants = await adminDb.tenant.findMany({
    where: { status: { not: 'DELETED' } },
    orderBy: { createdAt: 'desc' },
    include: {
      _count: { select: { tenantUsers: true } },
      subscription: { include: { plan: { select: { id: true, name: true, code: true } } } },
      auditLogs: { orderBy: { occurredAt: 'desc' }, take: 1, select: { occurredAt: true } },
    },
  });

  // Pending approvals first so they're the first thing an admin sees.
  tenants.sort(
    (a, b) => Number(b.status === 'PENDING_APPROVAL') - Number(a.status === 'PENDING_APPROVAL'),
  );
  const pendingCount = tenants.filter((t) => t.status === 'PENDING_APPROVAL').length;

  const tableData = tenants.map((t) => ({
    id: t.id,
    name: t.name,
    slug: t.slug,
    plan: t.subscription?.plan.name ?? t.plan.charAt(0).toUpperCase() + t.plan.slice(1),
    users: t._count.tenantUsers,
    status: t.status,
    createdAt: t.createdAt.toISOString(),
    lastActivity: t.auditLogs[0]?.occurredAt.toISOString() ?? null,
    customDomains: t.customDomains,
  }));

  return (
    <div>
      <Topbar
        title="Tenants"
        subtitle={
          pendingCount > 0
            ? `${String(pendingCount)} workspace request${pendingCount === 1 ? '' : 's'} awaiting approval`
            : 'All workspaces across the platform'
        }
        breadcrumb={['Admin']}
        userEmail={session.user.email}
        userName={session.user.name ?? undefined}
        actions={<CreateTenantButton />}
      />

      <main className="p-6">
        <AdminTenantsTable data={tableData} />
      </main>
    </div>
  );
}
