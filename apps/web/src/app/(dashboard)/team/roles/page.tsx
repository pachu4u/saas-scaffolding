import Link from 'next/link';

import { Badge } from '@/components/ui/badge';

export const metadata = { title: 'Roles & Permissions' };

const roles = [
  {
    id: 'tenant_admin',
    name: 'Admin',
    description: 'Full control over workspace settings, members, billing, and all resources.',
    isSystem: true,
    memberCount: 2,
    color: 'purple' as const,
    permCount: 48,
  },
  {
    id: 'tenant_billing_admin',
    name: 'Billing Admin',
    description:
      'Can manage subscriptions, view invoices, and update payment methods. Cannot manage members or settings.',
    isSystem: true,
    memberCount: 1,
    color: 'blue' as const,
    permCount: 8,
  },
  {
    id: 'tenant_user',
    name: 'Member',
    description:
      'Standard access to workspace resources. Can create and edit content but cannot manage team or billing.',
    isSystem: true,
    memberCount: 38,
    color: 'default' as const,
    permCount: 22,
  },
  {
    id: 'tenant_viewer',
    name: 'Viewer',
    description: 'Read-only access across the workspace. Cannot create, edit, or delete anything.',
    isSystem: true,
    memberCount: 2,
    color: 'gray' as const,
    permCount: 10,
  },
  {
    id: 'custom_devops',
    name: 'DevOps',
    description:
      'Custom role for the engineering team. Access to deployments, API keys, and audit logs.',
    isSystem: false,
    memberCount: 5,
    color: 'success' as const,
    permCount: 15,
  },
];

// Full permission catalog grouped by resource
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

// Which permissions each role has (by code)
const rolePermissions: Record<string, Set<string>> = {
  tenant_admin: new Set([
    'member:invite',
    'member:remove',
    'member:suspend',
    'member:read',
    'role:read',
    'role:assign',
    'role:manage',
    'billing:read',
    'billing:manage',
    'settings:read',
    'settings:manage',
    'branding:manage',
    'domain:manage',
    'sso:read',
    'sso:manage',
    'scim:manage',
    'apikey:read',
    'apikey:create',
    'apikey:revoke',
    'audit:read',
    'audit:export',
    'webhook:read',
    'webhook:manage',
  ]),
  tenant_billing_admin: new Set(['member:read', 'billing:read', 'billing:manage']),
  tenant_user: new Set([
    'member:read',
    'role:read',
    'billing:read',
    'settings:read',
    'apikey:read',
    'apikey:create',
    'audit:read',
    'webhook:read',
  ]),
  tenant_viewer: new Set([
    'member:read',
    'role:read',
    'billing:read',
    'settings:read',
    'audit:read',
  ]),
  custom_devops: new Set([
    'member:read',
    'role:read',
    'settings:read',
    'apikey:read',
    'apikey:create',
    'apikey:revoke',
    'audit:read',
    'audit:export',
    'webhook:read',
    'webhook:manage',
  ]),
};

const columnRoles = [
  'tenant_admin',
  'tenant_billing_admin',
  'tenant_user',
  'tenant_viewer',
  'custom_devops',
];

export default function RolesPage() {
  return (
    <div className="space-y-6">
      {/* Role cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {roles.map((role) => (
          <Link
            key={role.id}
            href={`/team/roles/${role.id}`}
            className="hover:border-brand-secondary block rounded-2xl border p-5 transition-all hover:-translate-y-0.5"
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
              <Badge variant={role.color}>
                {role.memberCount} {role.memberCount === 1 ? 'member' : 'members'}
              </Badge>
            </div>
            <p className="mb-3 text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              {role.description}
            </p>
            <div className="flex items-center justify-between">
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {role.permCount} permissions
              </span>
              <span className="text-xs font-semibold" style={{ color: 'var(--brand-primary)' }}>
                Edit permissions →
              </span>
            </div>
          </Link>
        ))}

        {/* Create custom role */}
        <button
          className="hover:border-brand-secondary hover:bg-bg-subtle rounded-2xl border-2 border-dashed p-5 text-left transition-all"
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
      <div
        className="overflow-hidden rounded-2xl border"
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
                    <div className="flex flex-col items-center gap-1">
                      <Badge variant={role.color}>{role.name}</Badge>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {permissionGroups.map((group) => (
                <>
                  {/* Group header */}
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
                      {columnRoles.map((roleId) => {
                        const has = rolePermissions[roleId]?.has(perm.code) ?? false;
                        return (
                          <td key={roleId} className="px-4 py-3 text-center">
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
    </div>
  );
}
