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

import { syncBranding } from './riogentix-client.js';

export type AppInstanceWithApp = ConnectedAppInstance & { app: ConnectedApp };

interface TenantBranding {
  primaryColor?: string;
  accentColor?: string;
  bgColor?: string;
  logoText?: string;
  loginHeadline?: string;
  loginSubheading?: string;
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
    loginHeadline: branding.loginHeadline,
    loginSubheading: branding.loginSubheading,
  });
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
