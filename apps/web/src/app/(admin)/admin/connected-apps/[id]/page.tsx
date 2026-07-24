import { auth } from '@platform/auth';
import { adminDb } from '@platform/db';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { ConnectedAppConfigForm } from '@/components/admin/connected-app-config-form';
import { ConnectedAppInstancesTable } from '@/components/admin/connected-app-instances-table';
import { ConnectedAppRolesPanel } from '@/components/admin/connected-app-roles-panel';
import { Topbar } from '@/components/layout/topbar';

export const metadata = { title: 'Connected App — Admin' };

export default async function ConnectedAppDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const session = await auth();
  if (!session) redirect('/auth/signin');

  const app = await adminDb.connectedApp.findUnique({
    where: { id },
    include: {
      instances: {
        include: { tenant: { select: { id: true, name: true, slug: true } } },
        orderBy: { createdAt: 'desc' },
      },
      roles: {
        include: {
          permissions: { include: { permission: { select: { code: true } } } },
          _count: { select: { bindings: true } },
        },
        orderBy: { name: 'asc' },
      },
    },
  });

  if (!app) notFound();

  const instanceRows = app.instances.map((instance) => ({
    id: instance.id,
    tenantName: instance.tenant.name,
    tenantSlug: instance.tenant.slug,
    scimBaseUrl: instance.scimBaseUrl,
    status: instance.status,
    lastSyncedAt: instance.lastSyncedAt?.toISOString() ?? null,
    lastSyncError: instance.lastSyncError,
  }));

  const connectedTenantIds = new Set(app.instances.map((instance) => instance.tenantId));
  const allTenants = await adminDb.tenant.findMany({
    select: { id: true, name: true, slug: true },
    orderBy: { name: 'asc' },
  });
  const availableTenants = allTenants.filter((t) => !connectedTenantIds.has(t.id));

  const roleRows = app.roles.map((role) => ({
    id: role.id,
    name: role.name,
    memberCount: role._count.bindings,
    permissions: role.permissions.map((rp) => rp.permission.code),
  }));

  return (
    <div>
      <Topbar
        title={app.name}
        subtitle={`Connected app configuration — ${app.slug}`}
        breadcrumb={['Admin', 'Connected Apps']}
        userEmail={session.user.email}
        userName={session.user.name ?? undefined}
      />

      <main className="space-y-6 p-6">
        <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
          <Link
            href="/admin/connected-apps"
            className="hover:underline"
            style={{ color: 'var(--brand-primary)' }}
          >
            ← Back to Connected Apps
          </Link>
        </div>

        <section>
          <h2 className="mb-3 text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
            App configuration
          </h2>
          <ConnectedAppConfigForm
            appId={app.id}
            name={app.name}
            description={app.description}
            iconUrl={app.iconUrl}
            docsUrl={app.docsUrl}
            status={app.status}
            config={app.config as Record<string, unknown>}
          />
        </section>

        <section>
          <h2 className="mb-3 text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
            Tenant instances ({instanceRows.length})
          </h2>
          <ConnectedAppInstancesTable
            appId={app.id}
            data={instanceRows}
            availableTenants={availableTenants}
          />
        </section>

        <section>
          <h2 className="mb-1 text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
            App-specific roles
          </h2>
          <p className="mb-3 text-xs" style={{ color: 'var(--text-muted)' }}>
            Roles defined here become assignable in every tenant that connects {app.name}, and sync
            to it as SCIM groups with the permission codes below.
          </p>
          <ConnectedAppRolesPanel appId={app.id} roles={roleRows} />
        </section>
      </main>
    </div>
  );
}
