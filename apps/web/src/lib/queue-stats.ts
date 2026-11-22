import { allQueues } from '@platform/jobs';

/**
 * Live BullMQ counts for every platform queue. This is the real source of job
 * state: the Postgres `jobs` table is never written to, so counting it always
 * returned 0.
 */

export interface QueueCounts {
  waiting: number;
  active: number;
  failed: number;
  delayed: number;
}

export interface QueueTotals extends QueueCounts {
  byQueue: ({ name: string } & QueueCounts)[];
}

export async function getQueueTotals(): Promise<QueueTotals> {
  const byQueue = await Promise.all(
    allQueues.map(async ({ name, queue }) => {
      const c = await queue.getJobCounts('waiting', 'active', 'failed', 'delayed');
      return {
        name,
        waiting: c.waiting ?? 0,
        active: c.active ?? 0,
        failed: c.failed ?? 0,
        delayed: c.delayed ?? 0,
      };
    }),
  );
  const sum = (k: keyof QueueCounts) => byQueue.reduce((s, q) => s + q[k], 0);
  return {
    waiting: sum('waiting'),
    active: sum('active'),
    failed: sum('failed'),
    delayed: sum('delayed'),
    byQueue,
  };
}
