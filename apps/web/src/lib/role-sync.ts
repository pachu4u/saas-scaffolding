import { adminDb } from '@platform/db';
import { appSyncQueue, enqueue } from '@platform/jobs';

/**
 * Write an outbox event for the tenant and enqueue an app-sync job to converge
 * all registered connected app instances via SCIM. Fire-and-forget: transient
 * failures must not fail the mutation that triggered this — the next successful
 * sync converges because the worker re-reads current state on every run.
 */
export async function enqueueRoleSync(tenantId: string): Promise<void> {
  try {
    await adminDb.syncOutboxEvent.create({
      data: { tenantId, resourceType: 'TENANT', op: 'UPSERT', payload: {} },
    });
    await enqueue(appSyncQueue, { tenantId });
  } catch (err) {
    console.error(`Failed to enqueue app sync for tenant ${tenantId}:`, err);
  }
}
