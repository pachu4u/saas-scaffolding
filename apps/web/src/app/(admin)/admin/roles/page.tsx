import { auth } from '@platform/auth';
import { Permission, PLATFORM_ROLE_NAMES } from '@platform/authz';
import { adminDb } from '@platform/db';
import { redirect } from 'next/navigation';

import { Topbar } from '@/components/layout/topbar';
import { Badge } from '@/components/ui/badge';
import { PERMISSION_CATALOG } from '@/lib/permission-catalog';

export const metadata = { title: 'Roles & Permissions — Admin' };

const ROLE_LABELS: Record<string, { label: string; desc: string; variant: 'purple' | 'blue' }> = {
  platform_super_admin: {
    label: 'Platform Super Admin',
    desc: 'Unrestricted access to every tenant, plus platform settings, billing, and jobs.',
    variant: 'purple',
  },
  platform_support: {
    label: 'Platform Support',
    desc: 'Read-only cross-tenant access for support and troubleshooting.',
    variant: 'blue',
  },
};

// Platform roles carry PLATFORM_ADMIN in addition to the tenant-facing
// permissions in PERMISSION_CATALOG, which deliberately excludes it.
const PLATFORM_GROUP = {
  resource: 'Platform',
  icon: '🛡️',
  permissions: [
    {
      code: Permission.PLATFORM_ADMIN,
      label: 'Full platform access',
      desc: 'Unrestricted access to all tenants and platform administration',
    },
  ],
};

export default async function AdminRolesPage() {
  const session = await auth();
  if (!session) redirect('/auth/signin');

  const roles = await adminDb.role.findMany({
    where: { tenantId: null, isSystem: true, name: { in: [...PLATFORM_ROLE_NAMES] } },
    include: {
      permissions: { include: { permission: { select: { code: true } } } },
    },
    orderBy: { name: 'asc' },
  });

  const rolePermissions = new Map<string, Set<string>>();
  for (const role of roles) {
    rolePermissions.set(role.id, new Set(role.permissions.map((rp) => rp.permission.code)));
  }

  const catalog = [...PERMISSION_CATALOG, PLATFORM_GROUP];

  return (
    <div>
      <Topbar
        title="Roles & Permissions"
        subtitle="Platform-level roles — separate from each tenant's own team roles"
        userName={session.user.name ?? session.user.email.split('@')[0]}
        userEmail={session.user.email}
      />

      <main className="space-y-6 p-6">
        <div
          className="rounded-xl border px-4 py-3 text-xs"
          style={{
            background: 'var(--bg-white)',
            borderColor: 'var(--border-light)',
            color: 'var(--text-muted)',
          }}
        >
          Membership in these roles is managed via Keycloak groups (
          <code
            className="rounded px-1 py-0.5 font-mono"
            style={{ background: 'var(--bg-subtle)', color: 'var(--brand-secondary)' }}
          >
            platform_super_admin
          </code>{' '}
          /{' '}
          <code
            className="rounded px-1 py-0.5 font-mono"
            style={{ background: 'var(--bg-subtle)', color: 'var(--brand-secondary)' }}
          >
            platform_support
          </code>
          ), not from this app. This page shows what each role is permitted to do.
        </div>

        {/* Role cards */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {roles.map((role) => {
            const meta = ROLE_LABELS[role.name] ?? {
              label: role.name,
              desc: '',
              variant: 'blue' as const,
            };
            const permCount = role.permissions.length;
            return (
              <div
                key={role.id}
                className="rounded-xl border p-5"
                style={{
                  background: 'var(--bg-white)',
                  borderColor: 'var(--border-light)',
                  boxShadow: 'var(--shadow-card)',
                }}
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>
                    {meta.label}
                  </span>
                  <Badge variant={meta.variant}>
                    {permCount} permission{permCount !== 1 ? 's' : ''}
                  </Badge>
                </div>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {meta.desc}
                </p>
              </div>
            );
          })}
        </div>

        {/* Permission matrix */}
        {roles.length > 0 && (
          <div
            className="overflow-hidden rounded-xl border"
            style={{
              background: 'var(--bg-white)',
              borderColor: 'var(--border-light)',
              boxShadow: 'var(--shadow-card)',
            }}
          >
            <div className="border-b px-6 py-4" style={{ borderColor: 'var(--border-light)' }}>
              <h2 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                Permission Matrix
              </h2>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-light)' }}>
                    <th
                      className="w-64 px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      Permission
                    </th>
                    {roles.map((role) => (
                      <th
                        key={role.id}
                        className="whitespace-nowrap px-4 py-3 text-center text-xs font-semibold"
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        <Badge variant={ROLE_LABELS[role.name]?.variant ?? 'blue'}>
                          {ROLE_LABELS[role.name]?.label ?? role.name}
                        </Badge>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {catalog.map((group) => (
                    <>
                      <tr key={`group-${group.resource}`}>
                        <td
                          colSpan={roles.length + 1}
                          className="px-6 py-2 text-xs font-bold uppercase tracking-wider"
                          style={{
                            background: 'var(--bg-main)',
                            color: 'var(--text-muted)',
                            borderTop: '1px solid var(--border-light)',
                            borderBottom: '1px solid var(--border-light)',
                          }}
                        >
                          {group.resource}
                        </td>
                      </tr>
                      {group.permissions.map((perm) => (
                        <tr
                          key={perm.code}
                          className="hover:bg-bg-main transition-colors"
                          style={{ borderBottom: '1px solid var(--border-light)' }}
                        >
                          <td className="px-6 py-3">
                            <div className="flex items-center gap-2">
                              <code
                                className="rounded px-1.5 py-0.5 font-mono text-xs"
                                style={{
                                  background: 'var(--bg-subtle)',
                                  color: 'var(--brand-secondary)',
                                }}
                              >
                                {perm.code}
                              </code>
                              <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                                {perm.label}
                              </span>
                            </div>
                          </td>
                          {roles.map((role) => {
                            const has = rolePermissions.get(role.id)?.has(perm.code) ?? false;
                            return (
                              <td key={role.id} className="px-4 py-3 text-center">
                                {has ? (
                                  <svg
                                    viewBox="0 0 20 20"
                                    fill="currentColor"
                                    className="mx-auto h-4 w-4"
                                    style={{ color: 'var(--status-success)' }}
                                  >
                                    <path
                                      fillRule="evenodd"
                                      d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16zm3.707-9.293a1 1 0 0 0-1.414-1.414L9 10.586 7.707 9.293a1 1 0 0 0-1.414 1.414l2 2a1 1 0 0 0 1.414 0l4-4z"
                                      clipRule="evenodd"
                                    />
                                  </svg>
                                ) : (
                                  <svg
                                    viewBox="0 0 20 20"
                                    fill="currentColor"
                                    className="mx-auto h-4 w-4 opacity-25"
                                    style={{ color: 'var(--text-muted)' }}
                                  >
                                    <path
                                      fillRule="evenodd"
                                      d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM8.707 7.293a1 1 0 0 0-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 1 0 1.414 1.414L10 11.414l1.293 1.293a1 1 0 0 0 1.414-1.414L11.414 10l1.293-1.293a1 1 0 0 0-1.414-1.414L10 8.586 8.707 7.293z"
                                      clipRule="evenodd"
                                    />
                                  </svg>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {roles.length === 0 && (
          <div
            className="rounded-xl border p-8 text-center"
            style={{ background: 'var(--bg-white)', borderColor: 'var(--border-light)' }}
          >
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              No platform roles found. They are seeded during setup.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
