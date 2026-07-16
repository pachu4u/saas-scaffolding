import { auth } from '@platform/auth';
import { PLATFORM_ROLE_NAMES } from '@platform/authz';
import { adminDb } from '@platform/db';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { RolePermissionEditor } from './role-permission-editor';

import { Badge } from '@/components/ui/badge';
import { PERMISSION_CATALOG } from '@/lib/permission-catalog';
import { getCurrentTenant } from '@/lib/server-tenant';

export const metadata = { title: 'Edit Role' };

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

export default async function RoleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const session = await auth();
  if (!session) redirect('/auth/signin');

  const { tenant: tenantCtx } = await getCurrentTenant(session.user.id);
  if (!tenantCtx) redirect('/');

  const { tenantId } = tenantCtx;
  const base = `/t/${tenantCtx.slug}`;

  // Fetch role from DB, scoped to what this tenant is allowed to see: its own
  // custom roles, or tenant-level system roles. Platform-level system roles
  // (platform_super_admin, platform_support) are deliberately excluded so a
  // tenant admin can't view/reach platform role details via this page.
  const role = await adminDb.role.findFirst({
    where: {
      id,
      OR: [{ tenantId }, { isSystem: true, name: { notIn: [...PLATFORM_ROLE_NAMES] } }],
    },
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
  const totalPerms = PERMISSION_CATALOG.reduce((acc, g) => acc + g.permissions.length, 0);
  const grantedCount = grants.size;
  const color = getRoleColor(role.name, role.isSystem);

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
        <Link
          href={`${base}/admin/team/roles`}
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
            className="flex items-start gap-4 rounded-xl border p-5"
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
                  : 'Custom role for your tenant.'}
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

          <RolePermissionEditor
            roleId={role.id}
            isSystem={role.isSystem}
            initialGrants={[...grants]}
            permissionGroups={PERMISSION_CATALOG}
          />
        </div>

        {/* Right: role info sidebar */}
        <div className="space-y-4">
          {/* Members with this role */}
          <div
            className="rounded-xl border p-5"
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
              href={`${base}/admin/team`}
              className="mt-3 block text-xs font-semibold hover:underline"
              style={{ color: 'var(--brand-primary)' }}
            >
              Manage assignments →
            </Link>
          </div>

          {/* Permission summary */}
          <div
            className="rounded-xl border p-5"
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
              {PERMISSION_CATALOG.map((group) => {
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
              className="rounded-xl border border-red-100 p-4"
              style={{ background: 'var(--bg-white)' }}
            >
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-red-500">
                Danger
              </h3>
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                Deleting this role will unassign it from all members — use the "Delete role" button
                below the permission editor.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
