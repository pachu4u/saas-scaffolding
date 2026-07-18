import { adminDb } from '@platform/db';
import type { AppSyncJob } from '@platform/jobs';
import { logger } from '@platform/logger';
import type { Job } from 'bullmq';

import { convergeAppInstance } from './app-sync-targets.js';

/**
 * Drain the identity-sync outbox for a tenant: claim its pending events, then
 * converge every ACTIVE connected app instance to the tenant's current
 * identity state (users + role assignments) via SCIM.
 *
 * Events are dirty-markers — convergence re-reads the DB, so one run settles
 * any number of pending events, and a replay after a crash is harmless.
 * Failure leaves the claimed events FAILED with the error recorded; the next
 * successful run for the tenant picks them up again alongside new events.
 */
export async function handleAppSync(job: Job<AppSyncJob>): Promise<void> {
  const { tenantId } = job.data;

  // Claim pending (and previously failed) events for this tenant.
  const pending = await adminDb.syncOutboxEvent.findMany({
    where: { tenantId, status: { in: ['PENDING', 'FAILED'] } },
    select: { id: true },
    orderBy: { id: 'asc' },
  });
  if (pending.length === 0) {
    logger.debug({ tenantId, jobId: job.id }, 'App sync — no pending outbox events');
    return;
  }
  const eventIds = pending.map((event) => event.id);
  await adminDb.syncOutboxEvent.updateMany({
    where: { id: { in: eventIds } },
    data: { status: 'PROCESSING', attempts: { increment: 1 } },
  });

  const instances = await adminDb.connectedAppInstance.findMany({
    where: { tenantId, status: 'ACTIVE' },
    include: { app: true },
  });

  try {
    for (const instance of instances) {
      await convergeAppInstance(instance);
      await adminDb.connectedAppInstance.update({
        where: { id: instance.id },
        data: { lastSyncedAt: new Date(), lastSyncError: null },
      });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await adminDb.syncOutboxEvent.updateMany({
      where: { id: { in: eventIds } },
      data: { status: 'FAILED', lastError: message },
    });
    throw err;
  }

  await adminDb.syncOutboxEvent.updateMany({
    where: { id: { in: eventIds } },
    data: { status: 'DONE', processedAt: new Date(), lastError: null },
  });

  logger.info(
    { tenantId, eventCount: eventIds.length, instanceCount: instances.length },
    'App sync — outbox drained and connected apps converged',
  );
}
