import { auth } from '@platform/auth';
import { PLAN_CODES } from '@platform/billing';
import { adminDb, withPlatformAdmin } from '@platform/db';
import { enqueue, planChangedQueue, tenantDeprovisionQueue } from '@platform/jobs';
import { type NextRequest, NextResponse } from 'next/server';

import { enqueueRoleSync } from '@/lib/role-sync';

const RESOURCE_LIMIT_FIELDS = ['pipes', 'storageBytes', 'apiKeys', 'seats'] as const;
type ResourceLimitField = (typeof RESOURCE_LIMIT_FIELDS)[number];
type ResourceLimitsPayload = Partial<Record<ResourceLimitField, number | null>>;

function parseResourceLimits(input: unknown): ResourceLimitsPayload | null {
  if (typeof input !== 'object' || input === null) return null;
  const result: ResourceLimitsPayload = {};
  for (const field of RESOURCE_LIMIT_FIELDS) {
    const value = (input as Record<string, unknown>)[field];
    if (value === undefined) continue;
    if (value !== null && (typeof value !== 'number' || !Number.isFinite(value) || value < 0)) {
      return null;
    }
    result[field] = value;
  }
  return result;
}

async function resolveActorUserId(externalId: string): Promise<string | null> {
  const user = await adminDb.user.findUnique({ where: { externalId }, select: { id: true } });
  return user?.id ?? null;
}

export const runtime = 'nodejs';

function isPlatformAdmin(session: { groups?: unknown }): boolean {
  return (
    Array.isArray(session.groups) &&
    (session.groups as string[]).some((g) =>
      ['platform_super_admin', 'platform_support'].includes(g),
    )
  );
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isPlatformAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  const body = (await req.json()) as {
    action?: string;
    plan?: string;
    resourceLimits?: unknown;
  };
  const { action } = body;

  if (!action) return NextResponse.json({ error: 'action is required' }, { status: 422 });

  const tenant = await adminDb.tenant.findUnique({ where: { id } });
  if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

  const actorUserId = await resolveActorUserId(session.user.id);

  if (action === 'suspend') {
    await adminDb.tenant.update({ where: { id }, data: { status: 'SUSPENDED' } });
    await withPlatformAdmin(async (tx) => {
      await tx.auditLog.create({
        data: {
          tenantId: id,
          actorUserId,
          action: 'tenant.suspended',
          resourceType: 'Tenant',
          resourceId: id,
          before: { status: tenant.status },
          after: { status: 'SUSPENDED' },
        },
      });
    });
    return NextResponse.json({ ok: true, status: 'SUSPENDED' });
  }
  if (action === 'reinstate') {
    await adminDb.tenant.update({ where: { id }, data: { status: 'ACTIVE' } });
    await withPlatformAdmin(async (tx) => {
      await tx.auditLog.create({
        data: {
          tenantId: id,
          actorUserId,
          action: 'tenant.reinstated',
          resourceType: 'Tenant',
          resourceId: id,
          before: { status: tenant.status },
          after: { status: 'ACTIVE' },
        },
      });
    });
    return NextResponse.json({ ok: true, status: 'ACTIVE' });
  }
  if (action === 'delete') {
    if (tenant.status === 'DELETED') {
      return NextResponse.json({ error: 'Tenant already deleted' }, { status: 422 });
    }
    // Soft delete — tenant rows are kept for audit/usage history (see
    // TenantStatus.DELETED). The worker tears the tenant's app/infra down
    // (kubernetes driver: deletes its namespace; shared driver: no-op) —
    // same job the "Deprovision" flow already used, just triggered here too.
    await adminDb.tenant.update({ where: { id }, data: { status: 'DELETED' } });
    await withPlatformAdmin(async (tx) => {
      await tx.auditLog.create({
        data: {
          tenantId: id,
          actorUserId,
          action: 'tenant.deleted',
          resourceType: 'Tenant',
          resourceId: id,
          before: { status: tenant.status },
          after: { status: 'DELETED' },
        },
      });
    });
    await enqueue(tenantDeprovisionQueue, { tenantId: id });
    return NextResponse.json({ ok: true, status: 'DELETED' });
  }

  if (action === 'update-plan') {
    const newPlan = body.plan?.toLowerCase().trim();
    if (!newPlan || !PLAN_CODES.includes(newPlan as (typeof PLAN_CODES)[number])) {
      return NextResponse.json(
        { error: `plan must be one of: ${PLAN_CODES.join(', ')}` },
        { status: 422 },
      );
    }
    const oldPlan = tenant.plan;
    const planRow = await adminDb.plan.findUnique({ where: { code: newPlan } });
    if (!planRow) {
      return NextResponse.json({ error: `Unknown plan code: ${newPlan}` }, { status: 500 });
    }
    await adminDb.tenant.update({ where: { id }, data: { plan: newPlan } });
    // Keep the billing subscription's plan in sync — entitlement checks
    // (hasEntitlement) and seat-limit enforcement read subscription.plan.features,
    // not tenants.plan, so without this the admin override has no effect on
    // in-app enforcement even though tenants.plan (and the Riogentix sync below)
    // both reflect the new tier.
    await adminDb.subscription.upsert({
      where: { tenantId: id },
      create: { tenantId: id, planId: planRow.id },
      update: { planId: planRow.id },
    });
    await withPlatformAdmin(async (tx) => {
      await tx.auditLog.create({
        data: {
          tenantId: id,
          actorUserId,
          action: 'tenant.plan_changed',
          resourceType: 'Tenant',
          resourceId: id,
          before: { plan: oldPlan },
          after: { plan: newPlan },
        },
      });
    });
    // Pushes the new plan to the tenant's Riogentix instance and lifts any
    // stale usage-lock — same handler Stripe subscription webhooks trigger.
    await enqueue(planChangedQueue, { tenantId: id, oldPlan, newPlan });
    return NextResponse.json({ ok: true, plan: newPlan });
  }

  if (action === 'update-resource-limits') {
    const limits = parseResourceLimits(body.resourceLimits);
    if (!limits) {
      return NextResponse.json(
        {
          error:
            'resourceLimits must be an object of pipes/storageBytes/apiKeys/seats, each a non-negative number or null',
        },
        { status: 422 },
      );
    }
    const before = tenant.resourceLimits;
    await adminDb.tenant.update({ where: { id }, data: { resourceLimits: limits } });
    await withPlatformAdmin(async (tx) => {
      await tx.auditLog.create({
        data: {
          tenantId: id,
          actorUserId,
          action: 'tenant.resource_limits_changed',
          resourceType: 'Tenant',
          resourceId: id,
          before: { resourceLimits: before },
          after: { resourceLimits: limits },
        },
      });
    });
    // Riogentix instance re-reads resourceLimits on every converge pass
    // (see convergeResourceLimits) — this just triggers the next one now.
    await enqueueRoleSync(id);
    return NextResponse.json({ ok: true, resourceLimits: limits });
  }

  return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 422 });
}
