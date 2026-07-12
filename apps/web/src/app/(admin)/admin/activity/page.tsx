import { auth } from '@platform/auth';
import { adminDb } from '@platform/db';
import { redirect } from 'next/navigation';

import { ActivityTable, type ActivityRow } from './activity-table';

import { Topbar } from '@/components/layout/topbar';

export const metadata = { title: 'Activity — Platform Admin' };

export default async function AdminActivityPage() {
  const session = await auth();
  if (!session) redirect('/auth/signin');

  const logs = await adminDb.auditLog.findMany({
    orderBy: { occurredAt: 'desc' },
    take: 500,
    include: {
      actor: { select: { email: true } },
      tenant: { select: { slug: true, name: true } },
    },
  });

  const rows: ActivityRow[] = logs.map((log) => ({
    id: String(log.id),
    occurredAt: log.occurredAt.toISOString(),
    action: log.action,
    tenantSlug: log.tenant.slug,
    tenantName: log.tenant.name,
    actorEmail: log.actor?.email ?? null,
    resourceType: log.resourceType,
  }));

  return (
    <div>
      <Topbar
        title="Platform Activity"
        subtitle="Cross-tenant audit log — last 500 events"
        userEmail={session.user.email}
        userName={session.user.name ?? undefined}
      />
      <main className="p-6">
        <ActivityTable data={rows} />
      </main>
    </div>
  );
}
