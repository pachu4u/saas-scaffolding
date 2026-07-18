import { enqueue, roleSyncQueue } from '@platform/jobs';

/**
 * Enqueue a push of the tenant's current role bindings to its Riogentix
 * instance. Fire-and-forget: the role mutation itself already committed, so a
 * transient queue failure must not fail the request — the worker re-reads the
 * full binding set on every run, so the next successful sync converges.
 */
export async function enqueueRoleSync(tenantId: string): Promise<void> {
  try {
    await enqueue(roleSyncQueue, { tenantId });
  } catch (err) {
    console.error(`Failed to enqueue role sync for tenant ${tenantId}:`, err);
  }
}
