import { env } from '@platform/config';
import { adminDb } from '@platform/db';
import { logger } from '@platform/logger';

import { readTenantSecretEnv, tenantInternalBaseUrl } from '../provisioning/kubernetes-driver.js';

interface SaasTarget {
  url: string;
  secret: string;
}

/**
 * Resolve where plan/usage-lock sync calls go:
 *  - kubernetes driver — the tenant's own instance, authenticated with the
 *    per-tenant secret generated at provision time
 *  - shared driver     — the single shared instance from env
 * Returns null when the tenant has no reachable instance (not provisioned yet
 * or integration unconfigured); callers treat that as a skip, matching the
 * previous shared-only behavior.
 */
async function saasTarget(tenantId: string): Promise<SaasTarget | null> {
  if (env.TENANT_STACK_DRIVER === 'kubernetes') {
    const tenant = await adminDb.tenant.findUnique({
      where: { id: tenantId },
      select: { slug: true },
    });
    if (!tenant) {
      logger.warn({ tenantId }, 'Riogentix sync for missing tenant — skipping');
      return null;
    }
    const secretEnv = await readTenantSecretEnv(tenant.slug);
    const secret = secretEnv?.RIOGENTIX_SAAS_INTERNAL_SECRET;
    if (!secret) {
      logger.warn({ tenantId, slug: tenant.slug }, 'Tenant stack not provisioned — skipping sync');
      return null;
    }
    return { url: tenantInternalBaseUrl(tenant.slug), secret };
  }

  const url = env.RIOGENTIX_INTERNAL_URL;
  const secret = env.RIOGENTIX_SAAS_INTERNAL_SECRET;
  if (!url || !secret) return null;
  return { url, secret };
}

async function callSaas(
  tenantId: string,
  method: string,
  path: string,
  body?: unknown,
): Promise<void> {
  const target = await saasTarget(tenantId);
  if (!target) {
    logger.debug({ path }, 'Riogentix integration not configured — skipping sync');
    return;
  }

  const res = await fetch(`${target.url}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-Saas-Internal-Secret': target.secret,
    },
    ...(body !== undefined && { body: JSON.stringify(body) }),
    // Fail fast if Riogentix is down/hung — BullMQ retries the job; an unbounded
    // fetch would instead pin the worker on a dead connection.
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Riogentix API ${method} ${path} → ${String(res.status)}: ${text}`);
  }
}

export async function syncPlan(tenantId: string, plan: string): Promise<void> {
  await callSaas(tenantId, 'PUT', `/api/v1/internal/saas/tenant/${tenantId}/plan`, { plan });
  logger.info({ tenantId, plan }, 'Synced plan to riogentix');
}

export async function setUsageLock(tenantId: string, locked: boolean): Promise<void> {
  await callSaas(tenantId, 'PUT', `/api/v1/internal/saas/tenant/${tenantId}/usage-lock`, {
    locked,
  });
  logger.info({ tenantId, locked }, 'Synced usage-lock to riogentix');
}

export interface BrandingUpdate {
  primaryColor?: string | undefined;
  accentColor?: string | undefined;
  bgColor?: string | undefined;
  logoText?: string | undefined;
  logoUrl?: string | undefined;
  logoIconUrl?: string | undefined;
  faviconUrl?: string | undefined;
  loginHeadline?: string | undefined;
  loginSubheading?: string | undefined;
  loginTestimonial?: string | undefined;
  loginSsoLabel?: string | undefined;
}

/**
 * Push white-label branding to the tenant's Riogentix instance, so its own
 * app UI (and the Keycloak login theme, which reads the same stored value
 * back through Riogentix's public branding endpoint) reflect what's
 * configured in the SaaS admin without a manual step.
 */
export async function syncBranding(tenantId: string, branding: BrandingUpdate): Promise<void> {
  await callSaas(tenantId, 'PUT', `/api/v1/internal/saas/tenant/${tenantId}/branding`, {
    primary_color: branding.primaryColor,
    accent_color: branding.accentColor,
    bg_color: branding.bgColor,
    logo_text: branding.logoText,
    logo_url: branding.logoUrl,
    logo_icon_url: branding.logoIconUrl,
    favicon_url: branding.faviconUrl,
    login_headline: branding.loginHeadline,
    login_subheading: branding.loginSubheading,
    login_testimonial: branding.loginTestimonial,
    login_sso_label: branding.loginSsoLabel,
  });
  logger.info({ tenantId }, 'Synced branding to riogentix');
}

export interface ResourceLimitsUpdate {
  flows?: number | null | undefined;
  storageBytes?: number | null | undefined;
  apiKeys?: number | null | undefined;
  seats?: number | null | undefined;
}

/**
 * Push per-tenant quota overrides (flows/storage/api_keys/seats) to the
 * tenant's Riogentix instance. A field left `undefined` is dropped by
 * JSON.stringify and so stays untouched on the Riogentix side (still
 * inherits the plan default); a field explicitly `null` forces "unlimited"
 * — mirrors Riogentix's own exclude_unset merge semantics for this endpoint.
 */
export async function syncResourceLimits(
  tenantId: string,
  limits: ResourceLimitsUpdate,
): Promise<void> {
  await callSaas(tenantId, 'PUT', `/api/v1/internal/saas/tenant/${tenantId}/resource-limits`, {
    flows: limits.flows,
    storage_bytes: limits.storageBytes,
    api_keys: limits.apiKeys,
    seats: limits.seats,
  });
  logger.info({ tenantId, limits }, 'Synced resource limits to riogentix');
}

// ─── Native RBAC (role catalog pull / assignment push) ────────────────────
//
// Unlike syncPlan/setUsageLock/syncBranding above (fire-and-forget PUTs),
// these read a response body, so they go through fetch directly rather than
// the void-returning callSaas() — same target resolution and auth header,
// just needs the parsed JSON back.

export interface RiogentixRole {
  id: string;
  name: string;
  isSystem: boolean;
  permissions: string[];
}

export interface RiogentixAssignment {
  id: string;
  userId: string;
  roleId: string;
  domainType: string;
  domainId: string | null;
}

async function callSaasJson<T>(
  tenantId: string,
  method: string,
  path: string,
  body?: unknown,
): Promise<T | null> {
  const target = await saasTarget(tenantId);
  if (!target) {
    logger.debug({ path }, 'Riogentix integration not configured — skipping');
    return null;
  }

  const res = await fetch(`${target.url}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-Saas-Internal-Secret': target.secret,
    },
    ...(body !== undefined && { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Riogentix API ${method} ${path} → ${String(res.status)}: ${text}`);
  }
  if (res.status === 204) return null;
  return (await res.json()) as T;
}

/** Pull Riogentix's native role catalog, for materializing into app-scoped Role rows. */
export async function fetchRiogentixRoles(tenantId: string): Promise<RiogentixRole[]> {
  const roles = await callSaasJson<
    { id: string; name: string; is_system: boolean; permissions: string[] }[]
  >(tenantId, 'GET', `/api/v1/internal/saas/tenant/${tenantId}/authz/roles`);
  if (!roles) return [];
  return roles.map((r) => ({
    id: r.id,
    name: r.name,
    isSystem: r.is_system,
    permissions: r.permissions,
  }));
}

/** List a Riogentix user's current native role assignments, to diff against desired state. */
export async function fetchRiogentixAssignments(
  tenantId: string,
  riogentixUserId: string,
): Promise<RiogentixAssignment[]> {
  const assignments = await callSaasJson<
    {
      id: string;
      user_id: string;
      role_id: string;
      domain_type: string;
      domain_id: string | null;
    }[]
  >(
    tenantId,
    'GET',
    `/api/v1/internal/saas/tenant/${tenantId}/authz/assignments?user_id=${encodeURIComponent(riogentixUserId)}`,
  );
  if (!assignments) return [];
  return assignments.map((a) => ({
    id: a.id,
    userId: a.user_id,
    roleId: a.role_id,
    domainType: a.domain_type,
    domainId: a.domain_id,
  }));
}

/**
 * Grant a native role to a Riogentix user. Additive — the caller must treat a
 * 409 (already assigned) as success, not an error, since this is called on
 * every convergence pass for every currently-desired binding.
 */
export async function createRiogentixAssignment(
  tenantId: string,
  riogentixUserId: string,
  roleId: string,
): Promise<{ id: string } | 'already-exists'> {
  const target = await saasTarget(tenantId);
  if (!target) return 'already-exists'; // integration not configured — nothing to do, don't error the caller

  const res = await fetch(
    `${target.url}/api/v1/internal/saas/tenant/${tenantId}/authz/assignments`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Saas-Internal-Secret': target.secret },
      body: JSON.stringify({ user_id: riogentixUserId, role_id: roleId }),
      signal: AbortSignal.timeout(15_000),
    },
  );
  if (res.status === 409) return 'already-exists';
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Riogentix API POST authz/assignments → ${String(res.status)}: ${text}`);
  }
  const body = (await res.json()) as { id: string };
  return { id: body.id };
}

export async function deleteRiogentixAssignment(
  tenantId: string,
  assignmentId: string,
): Promise<void> {
  await callSaas(
    tenantId,
    'DELETE',
    `/api/v1/internal/saas/tenant/${tenantId}/authz/assignments/${assignmentId}`,
  );
}

/**
 * Seed the tenant's first admin with a real native role assignment at
 * provision time, instead of relying on SCIM group push to eventually land
 * one. Safe to retry (Riogentix resolves-or-creates the user and treats an
 * existing assignment as success).
 */
export async function bootstrapTenantAdmin(
  tenantId: string,
  email: string,
  username: string | null,
  roleName: string,
): Promise<{ userId: string; roleId: string; assignmentId: string } | null> {
  const body = await callSaasJson<{ user_id: string; role_id: string; assignment_id: string }>(
    tenantId,
    'POST',
    `/api/v1/internal/saas/tenant/${tenantId}/authz/bootstrap-admin`,
    { email, username, role_name: roleName },
  );
  if (!body) return null;
  logger.info(
    { tenantId, email, roleName },
    'Bootstrapped tenant admin with native riogentix role',
  );
  return { userId: body.user_id, roleId: body.role_id, assignmentId: body.assignment_id };
}
