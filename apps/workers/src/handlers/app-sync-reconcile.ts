import { adminDb } from '@platform/db';
import { appSyncQueue, enqueue } from '@platform/jobs';
import { logger } from '@platform/logger';

/**
 * App-sync is purely outbox-event-driven (see handleAppSync) — a tenant with
 * no admin activity never gets an outbox event and drifts stale indefinitely
 * (2026-08-10 demo/globex incident: one tenant hadn't synced since before the
 * RBAC ownership reversal). Runs on a timer and re-enqueues every tenant with
 * an ACTIVE connected app instance, whether or not anything actually
 * changed — handleAppSync's convergence re-reads current state and is
 * idempotent, so a no-op tick just re-asserts it.
 */
export async function handleAppSyncReconcile(): Promise<void> {
  const tenants = await adminDb.tenant.findMany({
    where: { status: 'ACTIVE', connectedAppInstances: { some: { status: 'ACTIVE' } } },
    select: { id: true },
  });

  for (const { id: tenantId } of tenants) {
    await adminDb.syncOutboxEvent.create({
      data: { tenantId, resourceType: 'TENANT', op: 'UPSERT', payload: { reason: 'reconcile' } },
    });
    await enqueue(appSyncQueue, { tenantId });
  }

  logger.info({ tenantCount: tenants.length }, 'App sync reconcile — tick complete');
}
