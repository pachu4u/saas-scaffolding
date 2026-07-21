import { auth } from '@platform/auth';
import { adminDb } from '@platform/db';
import { redirect } from 'next/navigation';

import { ConnectedAppsTable } from '@/components/admin/connected-apps-table';
import { CreateConnectedAppButton } from '@/components/admin/create-connected-app-button';
import { Topbar } from '@/components/layout/topbar';

export const metadata = { title: 'Connected Apps — Admin' };

export default async function AdminConnectedAppsPage() {
  const session = await auth();
  if (!session) redirect('/auth/signin');

  const apps = await adminDb.connectedApp.findMany({
    include: { _count: { select: { instances: true, roles: true } } },
    orderBy: { name: 'asc' },
  });

  const tableData = apps.map((app) => ({
    id: app.id,
    slug: app.slug,
    name: app.name,
    description: app.description,
    status: app.status,
    instanceCount: app._count.instances,
    roleCount: app._count.roles,
    createdAt: app.createdAt.toISOString(),
  }));

  return (
    <div>
      <Topbar
        title="Connected Apps"
        subtitle="Apps that receive identity via SCIM — URL/config wiring and app-specific roles"
        breadcrumb={['Admin']}
        userEmail={session.user.email}
        userName={session.user.name ?? undefined}
        actions={<CreateConnectedAppButton />}
      />

      <main className="p-6">
        <ConnectedAppsTable data={tableData} />
      </main>
    </div>
  );
}
