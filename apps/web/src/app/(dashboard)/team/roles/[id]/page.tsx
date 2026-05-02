import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { adminDb } from '@platform/db';
import { resolveTenant } from '@platform/tenant';

import { Badge } from '@/components/ui/badge';

export const metadata = { title: 'Edit Role' };

// Static permission catalog — labels/descriptions are app-level constants
const permissionGroups = [
  {
    resource: 'Members',
    icon: '👤',
    permissions: [
      {
        code: 'member:read',
        label: 'View members',
        desc: 'See the team member list and their roles',
      },
      {
        code: 'member:invite',
        label: 'Invite members',
        desc: 'Send email invitations to new members',
      },
      { code: 'member:remove', label: 'Remove members', desc: 'Remove members from the workspace' },
      {
        code: 'member:suspend',
        label: 'Suspend members',
        desc: "Temporarily revoke a member's access",
      },
    ],
  },
  {
    resource: 'Roles & Permissions',
    icon: '🛡️',
    permissions: [
      { code: 'role:read', label: 'View roles', desc: 'See all roles and their permission sets' },
      { code: 'role:assign', label: 'Assign roles', desc: "Assign or change a member's role" },
      { code: 'role:manage', label: 'Manage roles', desc: 'Create, edit, or delete custom roles' },
    ],
  },
  {
    resource: 'Billing',
    icon: '💳',
    permissions: [
      {
        code: 'billing:read',
        label: 'View billing',
        desc: 'See current plan, usage, and invoice history',
      },
      {
        code: 'billing:manage',
        label: 'Manage billing',
        desc: 'Change plan, update payment method, cancel',
      },
    ],
  },
  {
    resource: 'Settings',
    icon: '⚙️',
    permissions: [
      { code: 'settings:read', label: 'View settings', desc: 'View workspace configuration' },
      {
        code: 'settings:manage',
        label: 'Edit settings',
        desc: 'Change workspace name, timezone, etc.',
      },
      {
        code: 'branding:manage',
        label: 'Manage branding',
        desc: 'Configure logo, colors, email templates',
      },
      { code: 'domain:manage', label: 'Manage domains', desc: 'Add or remove custom domains' },
    ],
  },
  {
    resource: 'SSO & SCIM',
    icon: '🔐',
    permissions: [
      { code: 'sso:read', label: 'View SSO config', desc: 'See SSO/SAML configuration' },
      { code: 'sso:manage', label: 'Manage SSO', desc: 'Configure SAML/OIDC identity provider' },
      { code: 'scim:manage', label: 'Manage SCIM', desc: 'Rotate SCIM bearer tokens' },
    ],
  },
  {
    resource: 'API Keys',
    icon: '🔑',
    permissions: [
      { code: 'apikey:read', label: 'View API keys', desc: 'List API keys (values are masked)' },
      {
        code: 'apikey:create',
        label: 'Create API keys',
        desc: 'Generate new API keys with chosen scopes',
      },
      { code: 'apikey:revoke', label: 'Revoke API keys', desc: 'Permanently revoke an API key' },
    ],
  },
  {
    resource: 'Audit Log',
    icon: '📋',
    permissions: [
      {
        code: 'audit:read',
        label: 'View audit log',
        desc: 'Search and read workspace audit events',
      },
      { code: 'audit:export', label: 'Export audit log', desc: 'Download audit log as CSV' },
    ],
  },
  {
    resource: 'Webhooks',
    icon: '🔁',
    permissions: [
      {
        code: 'webhook:read',
        label: 'View webhooks',
        desc: 'See webhook endpoints and delivery history',
      },
      {
        code: 'webhook:manage',
        label: 'Manage webhooks',
        desc: 'Create, edit, pause, or delete webhooks',
      },
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
  if (roleColorMap[name]) return roleColorMap[name]!;
  return isSystem ? 'default' : 'success';
}

export default async function RoleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const slug = process.env.NEXT_PUBLIC_DEFAULT_TENANT_SLUG ?? 'acme';
  const tenantCtx = await resolveTenant(slug);
  if (!tenantCtx) redirect('/');

  const { tenantId } = tenantCtx;

  // Fetch role from DB (system roles have tenantId=null, custom roles have tenantId set)
  const role = await adminDb.role.findFirst({
    where: { id },
    include: {
      permissions: { include: { permission: { select: { id: true, code: true } } } },
      bindings: {
        where: { tenantId },
        include: { user: { select: { id: true, email: true } } },
        take: 10,
      },
      _count: { select: { bindings: { where: { tenantId } } } },
    },
  });

  if (!role) notFound();

  const grants = new Set(role.permissions.map((rp) => rp.permission.code));
  const memberCount = role._count.bindings;
  const totalPerms = permissionGroups.reduce((acc, g) => acc + g.permissions.length, 0);
  const grantedCount = grants.size;
  const color = getRoleColor(role.name, role.isSystem);

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
        <Link
          href="/team/roles"
          className="hover:underline"
          style={{ color: 'var(--brand-primary)' }}
        >
          Roles & Permissions
        </Link>
        <span>/</span>
        <span style={{ color: 'var(--text-secondary)' }}>{role.name}</span>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-4">
        {/* Left: permission editor */}
        <div className="space-y-4 xl:col-span-3">
          {/* Role header */}
          <div
            className="flex items-start gap-4 rounded-2xl border p-5"
            style={{
              background: 'var(--bg-white)',
              borderColor: 'var(--border-light)',
              boxShadow: 'var(--shadow-card)',
            }}
          >
            <div className="flex-1">
              <div className="mb-1 flex items-center gap-2">
                <h1 className="text-lg font-extrabold" style={{ color: 'var(--text-primary)' }}>
                  {role.name}
                </h1>
                <Badge variant={color}>{role.isSystem ? 'System role' : 'Custom role'}</Badge>
              </div>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                {role.isSystem
                  ? 'System-managed role. Permissions can be adjusted but the role cannot be deleted.'
                  : 'Custom role for your workspace.'}
              </p>
            </div>
            <div className="flex-shrink-0 text-right">
              <div className="brand-gradient-text text-2xl font-extrabold">{grantedCount}</div>
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                of {totalPerms} perms
              </div>
            </div>
          </div>

          {role.isSystem && (
            <div
              className="flex items-center gap-2 rounded-xl p-3 text-xs"
              style={{
                background: 'rgba(176, 108, 255, 0.06)',
                border: '1px solid rgba(176, 108, 255, 0.15)',
                color: 'var(--brand-accent)',
              }}
            >
              <svg viewBox="0 0 16 16" fill="currentColor" className="h-4 w-4 flex-shrink-0">
                <path
                  fillRule="evenodd"
                  d="M8 1a.5.5 0 0 1 .5.5v.793l.853-.854a.5.5 0 0 1 .707.708l-.853.853H10.5a.5.5 0 0 1 0 1H9.207l.853.853a.5.5 0 0 1-.707.708L8.5 4.707V5.5a.5.5 0 0 1-1 0v-.793l-.853.854a.5.5 0 0 1-.707-.708l.853-.853H5.5a.5.5 0 0 1 0-1h1.293l-.853-.853a.5.5 0 0 1 .707-.708l.853.854V1.5A.5.5 0 0 1 8 1z"
                  clipRule="evenodd"
                />
              </svg>
              System roles cannot be deleted, but their permissions can be adjusted. Changes apply
              immediately to all members with this role.
            </div>
          )}

          {/* Permission groups */}
          <div className="space-y-3">
            {permissionGroups.map((group) => {
              const groupGranted = group.permissions.filter((p) => grants.has(p.code)).length;
              return (
                <div
                  key={group.resource}
                  className="overflow-hidden rounded-2xl border"
                  style={{
                    background: 'var(--bg-white)',
                    borderColor: 'var(--border-light)',
                    boxShadow: 'var(--shadow-card)',
                  }}
                >
                  <div
                    className="flex items-center justify-between border-b px-5 py-3.5"
                    style={{ borderColor: 'var(--border-light)', background: 'var(--bg-main)' }}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-base">{group.icon}</span>
                      <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                        {group.resource}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        {groupGranted}/{group.permissions.length} granted
                      </span>
                    </div>
                  </div>

                  <div className="divide-y" style={{ borderColor: 'var(--border-light)' }}>
                    {group.permissions.map((perm) => {
                      const granted = grants.has(perm.code);
                      return (
                        <div
                          key={perm.code}
                          className="hover:bg-bg-main flex items-center gap-4 px-5 py-3.5 transition-colors"
                        >
                          <div
                            className="relative h-5 w-9 flex-shrink-0 rounded-full"
                            style={{
                              background: granted
                                ? 'var(--brand-primary)'
                                : 'var(--border-default)',
                            }}
                          >
                            <span
                              className="absolute top-0.5 h-4 w-4 rounded-full bg-white shadow"
                              style={{ left: granted ? '18px' : '2px' }}
                            />
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <code
                                className="rounded px-1.5 py-0.5 font-mono text-xs"
                                style={{
                                  background: granted
                                    ? 'rgba(79,123,255,0.08)'
                                    : 'var(--bg-subtle)',
                                  color: granted ? 'var(--brand-primary)' : 'var(--text-muted)',
                                }}
                              >
                                {perm.code}
                              </code>
                              <span
                                className="text-sm font-semibold"
                                style={{ color: 'var(--text-primary)' }}
                              >
                                {perm.label}
                              </span>
                            </div>
                            <p className="mt-0.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                              {perm.desc}
                            </p>
                          </div>

                          <div className="flex-shrink-0">
                            {granted ? (
                              <svg
                                viewBox="0 0 16 16"
                                fill="currentColor"
                                className="h-4 w-4"
                                style={{ color: 'var(--status-success)' }}
                              >
                                <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z" />
                                <path d="M10.97 4.97a.235.235 0 0 0-.02.022L7.477 9.417 5.384 7.323a.75.75 0 0 0-1.06 1.06L6.97 11.03a.75.75 0 0 0 1.079-.02l3.992-4.99a.75.75 0 0 0-1.071-1.05z" />
                              </svg>
                            ) : (
                              <svg
                                viewBox="0 0 16 16"
                                fill="currentColor"
                                className="h-4 w-4 opacity-25"
                                style={{ color: 'var(--text-muted)' }}
                              >
                                <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z" />
                                <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z" />
                              </svg>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Save */}
          <div className="flex items-center justify-between pt-2">
            <Link
              href="/team/roles"
              className="text-sm font-semibold hover:underline"
              style={{ color: 'var(--text-muted)' }}
            >
              ← Back to roles
            </Link>
            <div className="flex gap-3">
              {!role.isSystem && (
                <button className="rounded-xl border border-red-100 bg-red-50 px-4 py-2 text-sm font-semibold text-red-600 transition-colors hover:bg-red-100">
                  Delete role
                </button>
              )}
              <button className="brand-gradient rounded-xl px-5 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90">
                Save changes
              </button>
            </div>
          </div>
        </div>

        {/* Right: role info sidebar */}
        <div className="space-y-4">
          {/* Members with this role */}
          <div
            className="rounded-2xl border p-5"
            style={{
              background: 'var(--bg-white)',
              borderColor: 'var(--border-light)',
              boxShadow: 'var(--shadow-card)',
            }}
          >
            <h3
              className="mb-3 text-xs font-bold uppercase tracking-wide"
              style={{ color: 'var(--text-muted)' }}
            >
              Members with this role
            </h3>
            {role.bindings.length > 0 ? (
              <div className="space-y-2">
                {role.bindings.map((binding) => {
                  const initials = binding.user.email.slice(0, 2).toUpperCase();
                  return (
                    <div key={binding.userId} className="flex items-center gap-2.5">
                      <div className="brand-gradient flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold text-white">
                        {initials}
                      </div>
                      <div className="min-w-0">
                        <div
                          className="truncate text-xs font-semibold"
                          style={{ color: 'var(--text-primary)' }}
                        >
                          {binding.user.email.split('@')[0]}
                        </div>
                        <div className="truncate text-xs" style={{ color: 'var(--text-muted)' }}>
                          {binding.user.email}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {memberCount > role.bindings.length && (
                  <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    +{memberCount - role.bindings.length} more
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                No members assigned yet.
              </p>
            )}
            <Link
              href="/team"
              className="mt-3 block text-xs font-semibold hover:underline"
              style={{ color: 'var(--brand-primary)' }}
            >
              Manage assignments →
            </Link>
          </div>

          {/* Permission summary */}
          <div
            className="rounded-2xl border p-5"
            style={{
              background: 'var(--bg-white)',
              borderColor: 'var(--border-light)',
              boxShadow: 'var(--shadow-card)',
            }}
          >
            <h3
              className="mb-3 text-xs font-bold uppercase tracking-wide"
              style={{ color: 'var(--text-muted)' }}
            >
              Permission summary
            </h3>
            <div className="space-y-1.5">
              {permissionGroups.map((group) => {
                const granted = group.permissions.filter((p) => grants.has(p.code)).length;
                return (
                  <div key={group.resource} className="flex items-center justify-between text-xs">
                    <span style={{ color: 'var(--text-secondary)' }}>{group.resource}</span>
                    <span
                      className="font-semibold"
                      style={{ color: granted > 0 ? 'var(--brand-primary)' : 'var(--text-muted)' }}
                    >
                      {granted}/{group.permissions.length}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Danger: if custom role */}
          {!role.isSystem && (
            <div
              className="rounded-2xl border border-red-100 p-4"
              style={{ background: 'var(--bg-white)' }}
            >
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-red-500">
                Danger
              </h3>
              <p className="mb-3 text-xs" style={{ color: 'var(--text-secondary)' }}>
                Deleting this role will unassign it from all members. They will fall back to the
                Member role.
              </p>
              <button className="w-full rounded-xl border border-red-100 bg-red-50 py-2 text-xs font-semibold text-red-600 transition-colors hover:bg-red-100">
                Delete role
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
