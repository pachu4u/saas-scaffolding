import { type NextRequest, NextResponse } from 'next/server';

import { auth } from '@platform/auth';
import {
  emailQueue,
  planChangedQueue,
  usageRollupQueue,
  webhookInboundQueue,
  webhookOutboundQueue,
} from '@platform/jobs';

export const runtime = 'nodejs';

function isPlatformAdmin(session: { groups?: unknown }): boolean {
  return (
    Array.isArray(session.groups) &&
    (session.groups as string[]).some((g) =>
      ['platform_super_admin', 'platform_support'].includes(g),
    )
  );
}

const QUEUES = [
  { name: 'email', queue: emailQueue },
  { name: 'webhook-inbound', queue: webhookInboundQueue },
  { name: 'webhook-outbound', queue: webhookOutboundQueue },
  { name: 'usage-rollup', queue: usageRollupQueue },
  { name: 'plan-changed', queue: planChangedQueue },
] as const;

/**
 * GET /api/admin/jobs
 * Returns queue depths and recent failed jobs.
 * Requires platform-admin session.
 */
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isPlatformAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const stats = await Promise.all(
    QUEUES.map(async ({ name, queue }) => {
      const [waiting, active, failed, delayed, completed] = await Promise.all([
        queue.getWaitingCount(),
        queue.getActiveCount(),
        queue.getFailedCount(),
        queue.getDelayedCount(),
        queue.getCompletedCount(),
      ]);

      // Get up to 20 most recent failed jobs
      const failedJobs = await queue.getFailed(0, 19);

      return {
        name,
        counts: { waiting, active, failed, delayed, completed },
        failedJobs: failedJobs.map((job) => ({
          id: job.id,
          name: job.name,
          data: job.data,
          failedReason: job.failedReason,
          attemptsMade: job.attemptsMade,
          processedOn: job.processedOn,
          timestamp: job.timestamp,
        })),
      };
    }),
  );

  return NextResponse.json({ queues: stats });
}

/**
 * POST /api/admin/jobs
 * Body: { queueName: string; jobId: string; action: 'retry' | 'discard' }
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isPlatformAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = (await req.json()) as { queueName?: string; jobId?: string; action?: string };
  const { queueName, jobId, action } = body;

  if (!queueName || !jobId || !action) {
    return NextResponse.json(
      { error: 'queueName, jobId, and action are required' },
      { status: 422 },
    );
  }

  const entry = QUEUES.find((q) => q.name === queueName);
  if (!entry) return NextResponse.json({ error: `Unknown queue: ${queueName}` }, { status: 404 });

  const job = await entry.queue.getJob(jobId);
  if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });

  if (action === 'retry') {
    await job.retry();
    return NextResponse.json({ ok: true, action: 'retry', jobId });
  }

  if (action === 'discard') {
    await job.remove();
    return NextResponse.json({ ok: true, action: 'discard', jobId });
  }

  return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 422 });
}
