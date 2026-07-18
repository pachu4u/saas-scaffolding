import { appSyncQueue, enqueue, roleSyncQueue } from '@platform/jobs';

/**
 * Enqueue propagation of the tenant's current identity state (members + role
 * bindings) to its downstream app instances. Fire-and-forget: the mutation
 * itself already committed, so a transient queue failure must not fail the
 * request — both workers re-read current state on every run, so the next
 * successful sync converges.
 *
 * Two queues run in parallel during the SCIM migration:
 * - `role-sync`: legacy bespoke push to the Riogentix internal API
 * - `app-sync`: generic outbox drain that converges registered connected
 *   apps via SCIM (no-op for tenants with no registered app instances)
 */
export async function enqueueRoleSync(tenantId: string): Promise<void> {
  try {
    await enqueue(roleSyncQueue, { tenantId });
  } catch (err) {
    console.error(`Failed to enqueue role sync for tenant ${tenantId}:`, err);
  }
  try {
    await enqueue(appSyncQueue, { tenantId });
  } catch (err) {
    console.error(`Failed to enqueue app sync for tenant ${tenantId}:`, err);
  }
}
