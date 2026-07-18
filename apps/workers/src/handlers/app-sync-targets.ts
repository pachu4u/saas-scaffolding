import type { ConnectedApp, ConnectedAppInstance } from '@platform/db';

export type AppInstanceWithApp = ConnectedAppInstance & { app: ConnectedApp };

/**
 * Converge one connected app instance to the tenant's current identity state
 * over its SCIM endpoint.
 *
 * Placeholder until the SCIM client lands: no instances are registered yet
 * (registration happens during provisioning in a later step), so this path
 * is unreachable today. It throws — rather than silently succeeding — so a
 * prematurely registered instance surfaces as a FAILED outbox batch instead
 * of pretending it was synced.
 */
export async function convergeAppInstance(instance: AppInstanceWithApp): Promise<void> {
  await Promise.resolve();
  throw new Error(
    `SCIM convergence for app "${instance.app.slug}" is not implemented yet — ` +
      'connected app instances should not be registered before the SCIM client ships',
  );
}
