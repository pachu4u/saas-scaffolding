import { auth } from '@platform/auth';
import { adminDb } from '@platform/db';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { redirect } from 'next/navigation';

import { ProvisioningPanel } from '@/components/admin/provisioning-panel';
import { Topbar } from '@/components/layout/topbar';
import { Badge } from '@/components/ui/badge';
import { formatDate, timeAgo } from '@/lib/time';

export const metadata = { title: 'Tenant Detail — Admin' };

export default async function AdminTenantDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session) redirect('/auth/signin');

  const tenant = await adminDb.tenant.findUnique({
    where: { id },
    include: {
      _count: { select: { tenantUsers: true, auditLogs: true } },
      subscription: {
        include: { plan: true },
      },
      environments: { orderBy: { createdAt: 'asc' } },
      tenantUsers: {
        include: { user: { select: { email: true } } },
        orderBy: { joinedAt: 'asc' },
        take: 10,
      },
      auditLogs: {
        orderBy: { occurredAt: 'desc' },
        take: 5,
        select: { id: true, action: true, occurredAt: true, resourceType: true },
      },
    },
  });

  if (!tenant) notFound();

  const planName =
    tenant.subscription?.plan.name ?? tenant.plan.charAt(0).toUpperCase() + tenant.plan.slice(1);

  return (
    <div>
      <Topbar
        title={tenant.name}
        subtitle={`/${tenant.slug}`}
        breadcrumb={['Admin', 'Tenants']}
        userEmail={session.user.email}
        userName={session.user.name ?? undefined}
        actions={
          <Link
            href="/admin/tenants"
            className="rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-gray-50"
            style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}
          >
            ← Back to tenants
          </Link>
        }
      />

      <main className="space-y-6 p-6">
        {/* Overview cards */}
        <div className="grid grid-cols-4 gap-4">
          {[
            {
              label: 'Status',
              value: tenant.status.charAt(0) + tenant.status.slice(1).toLowerCase(),
            },
            { label: 'Plan', value: planName },
            { label: 'Members', value: String(tenant._count.tenantUsers) },
            { label: 'Audit Events', value: String(tenant._count.auditLogs) },
          ].map((card) => (
            <div
              key={card.label}
              className="rounded-xl border p-5"
              style={{
                background: 'var(--bg-white)',
                borderColor: 'var(--border-light)',
                boxShadow: 'var(--shadow-card)',
              }}
            >
              <div
                className="mb-1 text-xs font-semibold uppercase tracking-wide"
                style={{ color: 'var(--text-muted)' }}
              >
                {card.label}
              </div>
              <div className="text-xl font-extrabold" style={{ color: 'var(--text-primary)' }}>
                {card.value}
              </div>
            </div>
          ))}
        </div>

        <ProvisioningPanel
          tenantId={id}
          initialStatus={tenant.provisioningStatus}
          initialEnvironments={tenant.environments}
        />

        <div className="grid grid-cols-2 gap-6">
          {/* Tenant info */}
          <div
            className="rounded-xl border p-6"
            style={{
              background: 'var(--bg-white)',
              borderColor: 'var(--border-light)',
              boxShadow: 'var(--shadow-card)',
            }}
          >
            <h2 className="mb-4 text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
              Tenant Details
            </h2>
            <dl className="space-y-3">
              {[
                { label: 'ID', value: tenant.id },
                { label: 'Slug', value: tenant.slug },
                { label: 'Plan', value: planName },
                { label: 'Created', value: formatDate(tenant.createdAt) },
                {
                  label: 'Custom Domains',
                  value: tenant.customDomains.length > 0 ? tenant.customDomains.join(', ') : '—',
                },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-start gap-4">
                  <dt
                    className="w-28 flex-shrink-0 text-xs font-semibold"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    {label}
                  </dt>
                  <dd
                    className="flex-1 break-all font-mono text-xs"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {value}
                  </dd>
                </div>
              ))}
            </dl>

            <div className="mt-6 flex gap-2">
              {tenant.status === 'ACTIVE' ? (
                <form
                  action={async () => {
                    'use server';
                    await adminDb.tenant.update({ where: { id }, data: { status: 'SUSPENDED' } });
                    redirect('/admin/tenants');
                  }}
                >
                  <button
                    type="submit"
                    className="rounded-lg border border-red-100 bg-red-50 px-3 py-1.5 text-xs text-red-600 transition-colors hover:bg-red-100"
                  >
                    Suspend tenant
                  </button>
                </form>
              ) : (
                <form
                  action={async () => {
                    'use server';
                    await adminDb.tenant.update({ where: { id }, data: { status: 'ACTIVE' } });
                    redirect('/admin/tenants');
                  }}
                >
                  <button
                    type="submit"
                    className="rounded-lg border px-3 py-1.5 text-xs transition-colors"
                    style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}
                  >
                    Reinstate tenant
                  </button>
                </form>
              )}
            </div>
          </div>

          {/* Members */}
          <div
            className="rounded-xl border"
            style={{
              background: 'var(--bg-white)',
              borderColor: 'var(--border-light)',
              boxShadow: 'var(--shadow-card)',
            }}
          >
            <div className="border-b px-6 py-4" style={{ borderColor: 'var(--border-light)' }}>
              <h2 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                Members ({tenant._count.tenantUsers})
              </h2>
            </div>
            {tenant.tenantUsers.length === 0 ? (
              <div className="px-6 py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
                No members yet.
              </div>
            ) : (
              <ul className="divide-y" style={{ '--tw-divide-opacity': 1 } as React.CSSProperties}>
                {tenant.tenantUsers.map((tu) => (
                  <li key={tu.userId} className="flex items-center gap-3 px-6 py-3">
                    <div className="brand-gradient flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold text-white">
                      {tu.user.email[0]?.toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div
                        className="truncate text-sm font-medium"
                        style={{ color: 'var(--text-primary)' }}
                      >
                        {tu.user.email}
                      </div>
                      <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        {tu.status === 'INVITED' ? 'Invited' : `Joined ${formatDate(tu.joinedAt)}`}
                      </div>
                    </div>
                    <Badge
                      variant={
                        tu.status === 'ACTIVE'
                          ? 'success'
                          : tu.status === 'INVITED'
                            ? 'warning'
                            : 'error'
                      }
                      dot
                    >
                      {tu.status.charAt(0) + tu.status.slice(1).toLowerCase()}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Recent audit logs */}
        <div
          className="rounded-xl border"
          style={{
            background: 'var(--bg-white)',
            borderColor: 'var(--border-light)',
            boxShadow: 'var(--shadow-card)',
          }}
        >
          <div className="border-b px-6 py-4" style={{ borderColor: 'var(--border-light)' }}>
            <h2 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
              Recent Activity
            </h2>
          </div>
          {tenant.auditLogs.length === 0 ? (
            <div className="px-6 py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
              No activity recorded.
            </div>
          ) : (
            <ul className="divide-y" style={{ '--tw-divide-opacity': 1 } as React.CSSProperties}>
              {tenant.auditLogs.map((log) => (
                <li key={log.id} className="flex items-center gap-4 px-6 py-3">
                  <div
                    className="h-1.5 w-1.5 flex-shrink-0 rounded-full"
                    style={{ background: 'var(--brand-accent)' }}
                  />
                  <div className="flex-1">
                    <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                      {log.action}
                    </span>
                    <span className="ml-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                      {log.resourceType}
                    </span>
                  </div>
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {timeAgo(log.occurredAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </div>
  );
}
