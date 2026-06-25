import { adminDb } from '@platform/db';
import { resolveTenant } from '@platform/tenant';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { Badge } from '@/components/ui/badge';

export const metadata = { title: 'Roles & Permissions' };

// Static permission catalog — labels/descriptions are app code, not DB data
const permissionGroups = [
  {
    resource: 'Members',
    permissions: [
      { code: 'member:invite', label: 'Invite members' },
      { code: 'member:remove', label: 'Remove members' },
      { code: 'member:suspend', label: 'Suspend members' },
      { code: 'member:read', label: 'View members' },
    ],
  },
  {
    resource: 'Roles',
    permissions: [
      { code: 'role:read', label: 'View roles' },
      { code: 'role:assign', label: 'Assign roles' },
      { code: 'role:manage', label: 'Create/edit roles' },
    ],
  },
  {
    resource: 'Billing',
    permissions: [
      { code: 'billing:read', label: 'View invoices & plan' },
      { code: 'billing:manage', label: 'Change plan / payment' },
    ],
  },
  {
    resource: 'Settings',
    permissions: [
      { code: 'settings:read', label: 'View settings' },
      { code: 'settings:manage', label: 'Edit settings' },
      { code: 'branding:manage', label: 'Manage branding' },
      { code: 'domain:manage', label: 'Manage custom domains' },
    ],
  },
  {
    resource: 'SSO / SCIM',
    permissions: [
      { code: 'sso:read', label: 'View SSO config' },
      { code: 'sso:manage', label: 'Configure SSO/SAML' },
      { code: 'scim:manage', label: 'Rotate SCIM tokens' },
    ],
  },
  {
    resource: 'API Keys',
    permissions: [
      { code: 'apikey:read', label: 'View API keys' },
      { code: 'apikey:create', label: 'Create API keys' },
      { code: 'apikey:revoke', label: 'Revoke API keys' },
    ],
  },
  {
    resource: 'Audit Log',
    permissions: [
      { code: 'audit:read', label: 'View audit log' },
      { code: 'audit:export', label: 'Export audit log' },
    ],
  },
  {
    resource: 'Webhooks',
    permissions: [
      { code: 'webhook:read', label: 'View webhooks' },
      { code: 'webhook:manage', label: 'Create/edit webhooks' },
    ],
  },
];

const roleColorMap: Record<string, 'purple' | 'blue' | 'default' | 'gray' | 'success'> = {
  Admin: 'purple',
  'Billing Admin': 'blue',
  Member: 'default',
  Viewer: 'gray',
};

function getRoleColor(
  name: string,
  isSystem: boolean,
): 'purple' | 'blue' | 'default' | 'gray' | 'success' {
  if (roleColorMap[name]) return roleColorMap[name];
  return isSystem ? 'default' : 'success';
}

export default async function RolesPage() {
  const slug = process.env.NEXT_PUBLIC_DEFAULT_TENANT_SLUG ?? 'acme';
  const tenantCtx = await resolveTenant(slug);
  if (!tenantCtx) redirect('/');

  const { tenantId } = tenantCtx;

  // Fetch all roles applicable to this tenant: system roles + tenant-specific roles
  const roles = await adminDb.role.findMany({
    where: {
      OR: [{ tenantId }, { isSystem: true }],
    },
    include: {
      _count: { select: { bindings: { where: { tenantId } } } },
      permissions: { include: { permission: { select: { code: true } } } },
    },
    orderBy: { name: 'asc' },
  });

  // Build permission set per role
  const rolePermissions = new Map<string, Set<string>>();
  for (const role of roles) {
    rolePermissions.set(role.id, new Set(role.permissions.map((rp) => rp.permission.code)));
  }

  return (
    <div className="space-y-6">
      {/* Role cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {roles.map((role) => {
          const color = getRoleColor(role.name, role.isSystem);
          const memberCount = role._count.bindings;
          const permCount = role.permissions.length;
          return (
            <Link
              key={role.id}
              href={`/team/roles/${role.id}`}
              className="hover:border-brand-secondary block rounded-xl border p-5 transition-all hover:-translate-y-0.5"
              style={{
                background: 'var(--bg-white)',
                borderColor: 'var(--border-light)',
                boxShadow: 'var(--shadow-card)',
              }}
            >
              <div className="mb-2 flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>
                    {role.name}
                  </span>
                  {role.isSystem && (
                    <span
                      className="rounded px-1.5 py-0.5 text-xs font-semibold"
                      style={{ background: 'var(--bg-subtle)', color: 'var(--text-muted)' }}
                    >
                      System
                    </span>
                  )}
                </div>
                <Badge variant={color}>
                  {memberCount} {memberCount === 1 ? 'member' : 'members'}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {permCount} permission{permCount !== 1 ? 's' : ''}
                </span>
                <span className="text-xs font-semibold" style={{ color: 'var(--brand-primary)' }}>
                  Edit permissions →
                </span>
              </div>
            </Link>
          );
        })}

        {/* Create custom role */}
        <button
          className="hover:border-brand-secondary hover:bg-bg-subtle rounded-xl border-2 border-dashed p-5 text-left transition-all"
          style={{ borderColor: 'var(--border-default)' }}
        >
          <div
            className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl text-2xl"
            style={{ background: 'var(--bg-subtle)' }}
          >
            +
          </div>
          <div className="mb-1 text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
            Create custom role
          </div>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Define a role with exactly the permissions your team needs.
          </p>
        </button>
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
            <p className="mt-0.5 text-xs" style={{ color: 'var(--text-muted)' }}>
              Overview of what each role can do. Click a role card above to edit individual
              permissions.
            </p>
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
                      <Badge variant={getRoleColor(role.name, role.isSystem)}>{role.name}</Badge>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {permissionGroups.map((group) => (
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
          style={{
            background: 'var(--bg-white)',
            borderColor: 'var(--border-light)',
          }}
        >
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            No roles configured yet. System roles are created during setup.
          </p>
        </div>
      )}
    </div>
  );
}
