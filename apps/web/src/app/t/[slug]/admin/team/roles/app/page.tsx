import { auth } from '@platform/auth';
import { adminDb } from '@platform/db';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { AppRoleAssignments } from '../app-role-assignments';

import { Badge } from '@/components/ui/badge';
import { getCurrentTenant } from '@/lib/server-tenant';

export const metadata = { title: 'App Roles' };

export default async function AppRolesPage() {
  const session = await auth();
  if (!session) redirect('/auth/signin');

  const { tenant: tenantCtx } = await getCurrentTenant(session.user.id);
  if (!tenantCtx) redirect('/');

  const { tenantId } = tenantCtx;

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

  if (!riogentixInstance) redirect('/team/roles');

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

  const appRoles = nativeRoles.map((r) => ({
    id: r.id,
    name: r.name,
    memberCount: r._count.bindings,
  }));

  const currentRoleIdByUser = new Map(appBindings.map((b) => [b.userId, b.roleId]));
  const appRoleMembers = tenantUsers.map((tu) => ({
    userId: tu.user.id,
    email: tu.user.email,
    currentRoleId: currentRoleIdByUser.get(tu.user.id) ?? null,
  }));

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/team/roles"
          className="text-xs font-semibold"
          style={{ color: 'var(--brand-primary)' }}
        >
          ← Roles & Permissions
        </Link>
        <h2 className="mt-2 text-base font-bold" style={{ color: 'var(--text-primary)' }}>
          App Roles ({riogentixInstance.app.name})
        </h2>
        <p className="mt-0.5 text-xs" style={{ color: 'var(--text-muted)' }}>
          Native roles from your {riogentixInstance.app.name} workspace — owned and managed by{' '}
          {riogentixInstance.app.name} itself, not this admin console. Assign one per member to
          control what they can do inside {riogentixInstance.app.name}.
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
    </div>
  );
}
