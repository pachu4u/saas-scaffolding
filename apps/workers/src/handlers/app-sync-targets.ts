import type { ConnectedApp, ConnectedAppInstance } from '@platform/db';
import { adminDb } from '@platform/db';
import { logger } from '@platform/logger';
import {
  SCIM_ROLE_EXTENSION,
  SCIM_SCHEMAS,
  ScimClient,
  type ScimGroupWrite,
  type ScimUserWrite,
} from '@platform/scim';

import {
  createRiogentixAssignment,
  fetchRiogentixAssignments,
  fetchRiogentixRoles,
  syncBranding,
  syncResourceLimits,
} from './riogentix-client.js';

export type AppInstanceWithApp = ConnectedAppInstance & { app: ConnectedApp };

interface TenantResourceLimits {
  pipes?: number | null;
  storageBytes?: number | null;
  apiKeys?: number | null;
  seats?: number | null;
}

interface TenantBranding {
  primaryColor?: string;
  accentColor?: string;
  bgColor?: string;
  logoText?: string;
  logoUrl?: string;
  logoIconUrl?: string;
  faviconUrl?: string;
  loginHeadline?: string;
  loginSubheading?: string;
  loginTestimonial?: string;
  loginSsoLabel?: string;
}

/**
 * Push the tenant's current branding to its Riogentix instance. Runs as part
 * of every convergence pass (not just after a branding edit) — cheap and
 * idempotent, and it means a stale/failed push self-heals on the next
 * identity sync instead of needing its own retry path.
 */
async function convergeBranding(instance: AppInstanceWithApp): Promise<void> {
  if (instance.app.slug !== 'riogentix') return;

  const tenant = await adminDb.tenant.findUnique({
    where: { id: instance.tenantId },
    select: { branding: true },
  });
  if (!tenant) return;

  const branding = tenant.branding as TenantBranding;
  await syncBranding(instance.tenantId, {
    primaryColor: branding.primaryColor,
    accentColor: branding.accentColor,
    bgColor: branding.bgColor,
    logoText: branding.logoText,
    logoUrl: branding.logoUrl,
    logoIconUrl: branding.logoIconUrl,
    faviconUrl: branding.faviconUrl,
    loginHeadline: branding.loginHeadline,
    loginSubheading: branding.loginSubheading,
    loginTestimonial: branding.loginTestimonial,
    loginSsoLabel: branding.loginSsoLabel,
  });
}

/**
 * Push the tenant's current resource-limit overrides (pipes/storage/api_keys/
 * seats) to its Riogentix instance. Same rationale as convergeBranding: runs
 * on every converge pass rather than only right after an admin edit, so a
 * failed/stale push self-heals on the next identity sync.
 */
async function convergeResourceLimits(instance: AppInstanceWithApp): Promise<void> {
  if (instance.app.slug !== 'riogentix') return;

  const tenant = await adminDb.tenant.findUnique({
    where: { id: instance.tenantId },
    select: { resourceLimits: true },
  });
  if (!tenant) return;

  const limits = tenant.resourceLimits as TenantResourceLimits;
  await syncResourceLimits(instance.tenantId, {
    pipes: limits.pipes,
    storageBytes: limits.storageBytes,
    apiKeys: limits.apiKeys,
    seats: limits.seats,
  });
}

/**
 * Push the tenant's app-scoped role bindings for Riogentix as native
 * AuthzRoleAssignment grants, instead of a full-replace SCIM Group push —
 * the RBAC ownership reversal makes Riogentix's own AuthzRole catalog
 * authoritative, so the SaaS side pushes assignment *deltas* against that
 * catalog rather than pushing role *definitions* wholesale.
 *
 * Two things this deliberately does NOT do, both flagged for follow-up
 * rather than guessed here:
 *
 * 1. It does not push SCIM Groups/permissions for Riogentix at all anymore
 *    (see the branch in convergeAppInstance) — any groups from before this
 *    cutover are left exactly as last synced, not actively deleted, since
 *    enforce() already stopped reading the legacy SaasRole tables in an
 *    earlier phase and there's no live behavior tied to removing them.
 * 2. It only ever creates assignments, never deletes. Riogentix has no
 *    "origin" marker distinguishing an assignment this worker pushed from
 *    one granted via bootstrap-admin (tenant-provision.ts) or directly in
 *    Riogentix's own native Roles & Permissions UI — diffing a user's full
 *    assignment list against "currently SaaS-desired" and deleting the
 *    difference would risk silently revoking access this worker never
 *    granted, most notably the tenant's own bootstrap admin. Safe two-way
 *    sync (including role-removal propagation) needs either a dedicated
 *    domain_type/marker on the Riogentix side or SaaS-side persistence of
 *    "what did we push" — both are product decisions, not mechanical ones.
 *
 * Platform-wide bindings (Role.appId null — tenant_admin/tenant_user/
 * tenant_viewer/tenant_billing_admin) are mapped onto the native catalog by
 * capability tier rather than name, since those role names never match
 * Riogentix's own viewer/developer/admin catalog. This mirrors
 * scripts/backfill_native_role_assignments.py's tier mapping in the
 * Riogentix repo. Without this, any member who only ever holds their
 * platform-wide tenant role — i.e. everyone who wasn't the bootstrap admin
 * at provisioning time and never got an explicit app-scoped role from the
 * Roles & Permissions UI — has an empty native permission union and zero
 * functional Riogentix access (confirmed live for carol@acme.test). Only
 * applied when the user has no explicit app-scoped role for this instance,
 * so it never overrides a role assigned directly through the UI.
 */
function mapPlatformRoleToNativeTier(permissionCodes: string[]): string {
  const perms = new Set(permissionCodes);
  if (perms.has('platform:admin') || perms.has('notes:delete')) return 'admin';
  if (perms.has('notes:update') || perms.has('notes:create')) return 'developer';
  return 'viewer';
}

async function convergeRiogentixRoleAssignments(
  instance: AppInstanceWithApp,
  bindings: {
    userId: string;
    role: {
      appId: string | null;
      name: string;
      permissions: { permission: { code: string } }[];
    };
  }[],
  appUserIdBySaasId: Map<string, string>,
): Promise<{ assignedCount: number }> {
  const { tenantId, appId } = instance;

  // Materialize the native catalog as app-scoped Role rows (tenantId: null,
  // appId: this instance's app) — the exact shape POST
  // /api/admin/connected-apps/[id]/roles already creates manually, so the
  // existing team/roles picker and RoleBinding flow work for native
  // Riogentix roles with zero new UI.
  const nativeRoles = await fetchRiogentixRoles(tenantId);
  const nativeRoleIdByName = new Map(nativeRoles.map((r) => [r.name, r.id]));

  for (const native of nativeRoles) {
    const existing = await adminDb.role.findFirst({
      where: { tenantId: null, appId, name: native.name },
    });
    if (!existing) {
      await adminDb.role.create({
        data: { tenantId: null, appId, name: native.name, isSystem: true },
      });
    }
  }

  // Desired native-role bindings, grouped by Riogentix (not SaaS) user id.
  // App-scoped bindings (explicit roles assigned via the Roles & Permissions
  // UI) are resolved first, by exact name match. Platform-wide bindings are
  // only consulted for users with no app-scoped binding, so an explicit UI
  // assignment always wins over the tier-mapped fallback.
  const usersWithAppScopedRole = new Set(
    bindings.filter((b) => b.role.appId === appId).map((b) => b.userId),
  );

  const desiredByRiogentixUser = new Map<string, Set<string>>();
  for (const binding of bindings) {
    let nativeRoleId: string | undefined;
    if (binding.role.appId === appId) {
      nativeRoleId = nativeRoleIdByName.get(binding.role.name);
    } else if (binding.role.appId === null && !usersWithAppScopedRole.has(binding.userId)) {
      const tier = mapPlatformRoleToNativeTier(
        binding.role.permissions.map((rp) => rp.permission.code),
      );
      nativeRoleId = nativeRoleIdByName.get(tier);
    } else {
      continue;
    }
    if (!nativeRoleId) {
      logger.warn(
        { tenantId, role: binding.role.name },
        'SaaS role has no matching native Riogentix role — catalog drift, skipping',
      );
      continue;
    }
    const riogentixUserId = appUserIdBySaasId.get(binding.userId);
    if (!riogentixUserId) {
      logger.warn(
        { tenantId, userId: binding.userId },
        'Role binding for user with no Riogentix identity — skipping',
      );
      continue;
    }
    let roleIds = desiredByRiogentixUser.get(riogentixUserId);
    if (!roleIds) {
      roleIds = new Set();
      desiredByRiogentixUser.set(riogentixUserId, roleIds);
    }
    roleIds.add(nativeRoleId);
  }

  let assignedCount = 0;
  for (const [riogentixUserId, roleIds] of desiredByRiogentixUser) {
    const current = await fetchRiogentixAssignments(tenantId, riogentixUserId);
    const currentRoleIds = new Set(
      current.filter((a) => a.domainType === 'global').map((a) => a.roleId),
    );
    for (const roleId of roleIds) {
      if (currentRoleIds.has(roleId)) continue;
      const result = await createRiogentixAssignment(tenantId, riogentixUserId, roleId);
      if (result !== 'already-exists') assignedCount += 1;
    }
  }
  return { assignedCount };
}

/**
 * Converge one connected app instance to the tenant's current identity state
 * over its SCIM 2.0 endpoint. Declarative full-state sync:
 *
 * 1. Users — every tenant member exists on the app side (created via SCIM
 *    when missing, matched by userName = email) with the right active flag.
 * 2. Groups — one SCIM Group per role that has bindings in the tenant
 *    (externalId = platform role id, members = app-side user ids, permission
 *    codes in the role extension), replaced wholesale each run.
 * 3. Stale groups — platform-managed groups (those with an externalId) that
 *    no longer correspond to a bound role are deleted, so role removals in
 *    the console propagate.
 *
 * Re-reads the DB every run, so any number of coalesced outbox events — or a
 * replay after a crash — converge to the same result.
 */
export async function convergeAppInstance(instance: AppInstanceWithApp): Promise<void> {
  const { tenantId } = instance;
  await convergeBranding(instance);
  await convergeResourceLimits(instance);
  const client = new ScimClient(instance.scimBaseUrl, instance.scimToken);

  const [memberships, bindings] = await Promise.all([
    adminDb.tenantUser.findMany({ where: { tenantId }, include: { user: true } }),
    // A role only syncs to this instance if it's app-agnostic (appId null,
    // e.g. platform-wide tenant_admin/tenant_user) or scoped to this specific
    // connected app. Roles scoped to a different app never leak into this
    // instance's SCIM groups.
    adminDb.roleBinding.findMany({
      where: { tenantId, role: { OR: [{ appId: null }, { appId: instance.appId }] } },
      include: { role: { include: { permissions: { include: { permission: true } } } } },
    }),
  ]);

  // ── 1. Users ───────────────────────────────────────────────────────────────
  const appUserIdBySaasId = new Map<string, string>();
  for (const membership of memberships) {
    const { user } = membership;
    if (user.status === 'DELETED') continue;

    const desired: ScimUserWrite = {
      schemas: [SCIM_SCHEMAS.USER],
      externalId: user.id,
      userName: user.email,
      ...(user.name && { name: { formatted: user.name } }),
      emails: [{ value: user.email, primary: true, type: 'work' }],
      active: user.status === 'ACTIVE' && membership.status !== 'SUSPENDED',
    };

    let appUser = await client.findUserByUserName(user.email);
    if (!appUser) {
      appUser = await client.createUser(desired);
    } else if (appUser.active !== desired.active || appUser.externalId !== user.id) {
      await client.replaceUser(appUser.id, desired);
    }
    appUserIdBySaasId.set(user.id, appUser.id);
  }

  // Riogentix owns its own native role/permission catalog now (the RBAC
  // ownership reversal) — push assignment deltas against that catalog
  // instead of full-replace SCIM Groups, and leave any pre-cutover groups
  // untouched rather than deleting them (see convergeRiogentixRoleAssignments
  // docstring). Users (step 1, above) still sync via SCIM unchanged — that
  // part is identity, not roles, and is unrelated to this cutover.
  if (instance.app.slug === 'riogentix') {
    const { assignedCount } = await convergeRiogentixRoleAssignments(
      instance,
      bindings,
      appUserIdBySaasId,
    );
    logger.info(
      { tenantId, app: instance.app.slug, userCount: appUserIdBySaasId.size, assignedCount },
      'Connected app instance converged (native role assignments, no SCIM group push)',
    );
    return;
  }

  // ── 2. Groups (roles with bindings) ────────────────────────────────────────
  const desiredGroups = new Map<
    string,
    { name: string; isSystem: boolean; permissions: string[]; memberIds: string[] }
  >();
  for (const binding of bindings) {
    const appUserId = appUserIdBySaasId.get(binding.userId);
    if (!appUserId) {
      logger.warn(
        { tenantId, userId: binding.userId, app: instance.app.slug },
        'Role binding for user with no app-side identity — skipping membership',
      );
      continue;
    }
    let group = desiredGroups.get(binding.roleId);
    if (!group) {
      group = {
        name: binding.role.name,
        isSystem: binding.role.isSystem,
        permissions: binding.role.permissions.map((rp) => rp.permission.code),
        memberIds: [],
      };
      desiredGroups.set(binding.roleId, group);
    }
    group.memberIds.push(appUserId);
  }

  const existingGroups = await client.listGroups();
  const existingByExternalId = new Map(
    existingGroups.filter((g) => g.externalId).map((g) => [g.externalId, g]),
  );

  for (const [roleId, group] of desiredGroups) {
    const payload: ScimGroupWrite = {
      schemas: [SCIM_SCHEMAS.GROUP, SCIM_ROLE_EXTENSION],
      externalId: roleId,
      displayName: group.name,
      members: group.memberIds.map((value) => ({ value })),
      [SCIM_ROLE_EXTENSION]: { permissions: group.permissions, isSystem: group.isSystem },
    };
    const existing = existingByExternalId.get(roleId);
    if (existing) {
      await client.replaceGroup(existing.id, payload);
    } else {
      await client.createGroup(payload);
    }
  }

  // ── 3. Stale platform-managed groups ───────────────────────────────────────
  for (const group of existingGroups) {
    if (group.externalId && !desiredGroups.has(group.externalId)) {
      await client.deleteGroup(group.id);
    }
  }

  logger.info(
    {
      tenantId,
      app: instance.app.slug,
      userCount: appUserIdBySaasId.size,
      groupCount: desiredGroups.size,
    },
    'Connected app instance converged via SCIM',
  );
}
