import type { Prisma, SyncOp, SyncResourceType } from '@prisma/client';

export interface SyncOutboxAppend {
  resourceType: SyncResourceType;
  resourceId?: string;
  op?: SyncOp;
  payload?: Prisma.InputJsonValue;
}

/**
 * Append identity-sync outbox events inside the caller's transaction.
 *
 * Call this from the same transaction that mutates users, memberships, or
 * roles — the transactional-outbox guarantee (no identity change can commit
 * without a sync record) only holds when both writes share a transaction.
 *
 * Events are dirty-markers, not deltas: the dispatcher re-reads current state
 * and converges every connected app instance for the tenant, so duplicate or
 * out-of-order events are harmless.
 */
export async function appendSyncOutbox(
  tx: Prisma.TransactionClient,
  tenantId: string,
  events: SyncOutboxAppend[],
): Promise<void> {
  if (events.length === 0) return;
  await tx.syncOutboxEvent.createMany({
    data: events.map((event) => ({
      tenantId,
      resourceType: event.resourceType,
      resourceId: event.resourceId ?? null,
      op: event.op ?? 'UPSERT',
      payload: event.payload ?? {},
    })),
  });
}
