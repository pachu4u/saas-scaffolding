import { auth } from '@platform/auth';
import { PLATFORM_ROLE_NAMES } from '@platform/authz';
import { adminDb } from '@platform/db';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { AppRoleAssignments } from './app-role-assignments';
import { CreateRoleButton } from './create-role-button';

import { Badge } from '@/components/ui/badge';
import { PERMISSION_CATALOG } from '@/lib/permission-catalog';
import { getCurrentTenant } from '@/lib/server-tenant';
import { getRoleLabel } from '@/lib/system-roles';

export const metadata = { title: 'Roles & Permissions' };

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
  const session = await auth();
  if (!session) redirect('/auth/signin');

  const { tenant: tenantCtx } = await getCurrentTenant(session.user.id);
  if (!tenantCtx) redirect('/');

  const { tenantId } = tenantCtx;

  // Fetch all workspace-level roles applicable to this tenant: its own
  // custom roles + tenant-level system roles. Platform-level system roles
  // (platform_super_admin, platform_support) are excluded — they have
  // tenantId: null but are not relevant to a single tenant's role management.
  // App-scoped roles (Role.appId set) are managed from Connected Apps, not
  // shown in this workspace-level list.
  const roles = await adminDb.role.findMany({
    where: {
      OR: [
        { tenantId },
        { isSystem: true, appId: null, name: { notIn: [...PLATFORM_ROLE_NAMES] } },
      ],
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

  // Riogentix's native role catalog (viewer/developer/admin, plus any custom
  // roles a tenant admin has created directly in Riogentix) is a separate
  // catalog Riogentix owns — permissions for these roles are configured
  // inside Riogentix, not here. This platform only mirrors the role names
  // (materialized into app-scoped Role rows by the app-sync worker on every
  // convergence pass) and owns *assignment*: which member has which native
  // role. See apps/workers/src/handlers/app-sync-targets.ts.
  const riogentixInstance = await adminDb.connectedAppInstance.findFirst({
    where: { tenantId, status: 'ACTIVE', app: { slug: 'riogentix' } },
    select: { appId: true, app: { select: { name: true } } },
  });

  let appRoles: { id: string; name: string; memberCount: number }[] = [];
  let appRoleMembers: { userId: string; email: string; currentRoleId: string | null }[] = [];

  if (riogentixInstance) {
    const [nativeRoles, tenantUsers, appBindings] = await Promise.all([
      adminDb.role.findMany({
        where: { tenantId: null, appId: riogentixInstance.appId, isSystem: true },
        include: { _count: { select: { bindings: { where: { tenantId } } } } },
        orderBy: { name: 'asc' },
      }),
      adminDb.tenantUser.findMany({
        where: { tenantId, status: 'ACTIVE' },
        include: { user: { select: { id: true, email: true } } },
        orderBy: { joinedAt: 'asc' },
      }),
      adminDb.roleBinding.findMany({
        where: {
          tenantId,
          role: { tenantId: null, appId: riogentixInstance.appId, isSystem: true },
        },
        select: { userId: true, roleId: true },
      }),
    ]);

    appRoles = nativeRoles.map((r) => ({ id: r.id, name: r.name, memberCount: r._count.bindings }));

    const currentRoleIdByUser = new Map(appBindings.map((b) => [b.userId, b.roleId]));
    appRoleMembers = tenantUsers.map((tu) => ({
      userId: tu.user.id,
      email: tu.user.email,
      currentRoleId: currentRoleIdByUser.get(tu.user.id) ?? null,
    }));
  }

  return (
    <div className="space-y-8">
      <section className="space-y-6">
        <div>
          <h2 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>
            Platform Roles
          </h2>
          <p className="mt-0.5 text-xs" style={{ color: 'var(--text-muted)' }}>
            Roles that control access to this workspace's admin console, billing, and settings.
          </p>
        </div>

        {/* Role cards */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {roles.map((role) => {
            const label = getRoleLabel(role.name);
            const color = getRoleColor(label, role.isSystem);
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
                      {label}
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
          <CreateRoleButton />
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
                    {roles.map((role) => {
                      const label = getRoleLabel(role.name);
                      return (
                        <th
                          key={role.id}
                          className="whitespace-nowrap px-4 py-3 text-center text-xs font-semibold"
                          style={{ color: 'var(--text-secondary)' }}
                        >
                          <Badge variant={getRoleColor(label, role.isSystem)}>{label}</Badge>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {PERMISSION_CATALOG.map((group) => (
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
      </section>

      {/* App Roles (Riogentix) — a separate, Riogentix-owned catalog */}
      {riogentixInstance && (
        <section className="space-y-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>
                App Roles ({riogentixInstance.app.name})
              </h2>
              <span
                className="rounded px-1.5 py-0.5 text-xs font-semibold"
                style={{ background: 'var(--bg-subtle)', color: 'var(--text-muted)' }}
              >
                Separate catalog
              </span>
            </div>
            <p className="mt-0.5 text-xs" style={{ color: 'var(--text-muted)' }}>
              Native roles from your {riogentixInstance.app.name} workspace — owned and managed by{' '}
              {riogentixInstance.app.name} itself, not this admin console. Assign one on top of a
              member's platform role above to control what they can do inside{' '}
              {riogentixInstance.app.name}.
            </p>
          </div>

          {/* Read-only role catalog */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {appRoles.map((role) => (
              <div
                key={role.id}
                className="rounded-xl border p-5"
                style={{
                  background: 'var(--bg-white)',
                  borderColor: 'var(--border-light)',
                  boxShadow: 'var(--shadow-card)',
                }}
              >
                <div className="mb-2 flex items-start justify-between gap-2">
                  <span className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>
                    {role.name}
                  </span>
                  <Badge variant="purple">
                    {role.memberCount} {role.memberCount === 1 ? 'member' : 'members'}
                  </Badge>
                </div>
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  Read-only here — permissions are configured in {riogentixInstance.app.name}.
                </span>
              </div>
            ))}
            {appRoles.length === 0 && (
              <div
                className="rounded-xl border p-5 text-xs md:col-span-2 xl:col-span-3"
                style={{
                  background: 'var(--bg-white)',
                  borderColor: 'var(--border-light)',
                  color: 'var(--text-muted)',
                }}
              >
                No {riogentixInstance.app.name} roles synced yet. They appear here after the next
                identity sync.
              </div>
            )}
          </div>

          {/* Per-member assignment */}
          {appRoles.length > 0 && (
            <div>
              <h3
                className="mb-2 text-xs font-bold uppercase tracking-wide"
                style={{ color: 'var(--text-muted)' }}
              >
                Member assignments
              </h3>
              <AppRoleAssignments
                appName={riogentixInstance.app.name}
                roles={appRoles}
                members={appRoleMembers}
              />
            </div>
          )}
        </section>
      )}
    </div>
  );
}
