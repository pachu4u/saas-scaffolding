'use client';

import { useCallback, useEffect, useState, useTransition } from 'react';

interface FailedJob {
  id: string;
  name: string;
  data: unknown;
  failedReason: string;
  attemptsMade: number;
  processedOn: number | null;
  timestamp: number;
}

interface QueueStats {
  name: string;
  counts: {
    waiting: number;
    active: number;
    failed: number;
    delayed: number;
    completed: number;
  };
  failedJobs: FailedJob[];
}

interface JobsData {
  queues: QueueStats[];
}

const COUNT_COLORS: Record<string, string> = {
  active: 'var(--brand-primary)',
  waiting: 'var(--status-warning)',
  failed: '#ef4444',
  delayed: 'var(--text-muted)',
  completed: 'var(--status-success)',
};

export default function AdminJobsPage() {
  const [data, setData] = useState<JobsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedQueue, setExpandedQueue] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [actionResult, setActionResult] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/jobs');
      if (!res.ok) {
        setError('Access denied');
        return;
      }
      const json = (await res.json()) as JobsData;
      setData(json);
    } catch {
      setError('Failed to load queue data');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
    const interval = setInterval(() => void fetchData(), 10_000);
    return () => {
      clearInterval(interval);
    };
  }, [fetchData]);

  function handleJobAction(queueName: string, jobId: string, action: 'retry' | 'discard') {
    setActionResult(null);
    startTransition(async () => {
      try {
        const res = await fetch('/api/admin/jobs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ queueName, jobId, action }),
        });
        const json = (await res.json()) as { ok?: boolean; error?: string };
        if (json.ok) {
          setActionResult(`Job ${jobId} ${action === 'retry' ? 'retried' : 'discarded'}`);
          void fetchData();
        } else {
          setActionResult(`Error: ${json.error ?? 'Unknown'}`);
        }
      } catch {
        setActionResult('Request failed');
      }
    });
  }

  const totalFailed = data?.queues.reduce((a, q) => a + q.counts.failed, 0) ?? 0;

  return (
    <div>
      {/* Topbar */}
      <div
        className="flex items-center justify-between border-b px-6 py-4"
        style={{ background: 'var(--bg-white)', borderColor: 'var(--border-light)' }}
      >
        <div>
          <h1 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>
            Job Queues
          </h1>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            BullMQ queue depths and DLQ management · auto-refreshes every 10s
          </p>
        </div>
        <div className="flex items-center gap-2">
          {totalFailed > 0 && (
            <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-bold text-red-600">
              {totalFailed} failed
            </span>
          )}
          <button
            onClick={() => void fetchData()}
            className="hover:bg-bg-subtle rounded-xl border px-3 py-1.5 text-xs font-semibold transition-colors"
            style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}
          >
            Refresh
          </button>
        </div>
      </div>

      <main className="space-y-4 p-6">
        {actionResult && (
          <div
            className="rounded-xl border px-4 py-3 text-sm"
            style={{
              background: 'var(--bg-white)',
              borderColor: 'var(--border-light)',
              color: 'var(--text-secondary)',
            }}
          >
            {actionResult}
          </div>
        )}

        {isLoading && (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="h-20 animate-pulse rounded-xl"
                style={{ background: 'var(--bg-white)', border: '1px solid var(--border-light)' }}
              />
            ))}
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-red-100 bg-red-50 px-5 py-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {data?.queues.map((queue) => {
          const isExpanded = expandedQueue === queue.name;
          const hasFailed = queue.counts.failed > 0;
          return (
            <div
              key={queue.name}
              className="overflow-hidden rounded-xl border"
              style={{
                background: 'var(--bg-white)',
                borderColor: hasFailed ? 'rgba(239,68,68,0.3)' : 'var(--border-light)',
                boxShadow: 'var(--shadow-card)',
              }}
            >
              <div className="flex items-center gap-4 px-5 py-4">
                {/* Queue name */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span
                      className="font-mono text-sm font-bold"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      {queue.name}
                    </span>
                    {queue.counts.active > 0 && (
                      <span
                        className="h-2 w-2 animate-pulse rounded-full"
                        style={{ background: 'var(--brand-primary)' }}
                      />
                    )}
                  </div>
                </div>

                {/* Count badges */}
                <div className="flex flex-wrap items-center gap-2">
                  {Object.entries(queue.counts).map(([key, val]) => (
                    <div key={key} className="text-center">
                      <div
                        className="text-lg font-extrabold leading-none"
                        style={{ color: val > 0 ? COUNT_COLORS[key] : 'var(--text-muted)' }}
                      >
                        {val}
                      </div>
                      <div className="text-xs capitalize" style={{ color: 'var(--text-muted)' }}>
                        {key}
                      </div>
                    </div>
                  ))}
                </div>

                {/* DLQ button */}
                {hasFailed && (
                  <button
                    onClick={() => {
                      setExpandedQueue(isExpanded ? null : queue.name);
                    }}
                    className="flex-shrink-0 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors hover:bg-red-50"
                    style={{ borderColor: 'rgba(239,68,68,0.3)', color: '#ef4444' }}
                  >
                    {isExpanded ? 'Hide DLQ' : `View DLQ (${String(queue.counts.failed)})`}
                  </button>
                )}
              </div>

              {/* DLQ panel */}
              {isExpanded && queue.failedJobs.length > 0 && (
                <div className="border-t" style={{ borderColor: 'var(--border-light)' }}>
                  <div
                    className="border-b px-4 py-2"
                    style={{ borderColor: 'var(--border-light)', background: 'var(--bg-main)' }}
                  >
                    <span className="text-xs font-bold" style={{ color: 'var(--text-secondary)' }}>
                      Failed jobs (most recent first)
                    </span>
                  </div>
                  <div className="divide-y" style={{ borderColor: 'var(--border-light)' }}>
                    {queue.failedJobs.map((job) => (
                      <div key={job.id} className="px-4 py-3">
                        <div className="mb-1 flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span
                                className="font-mono text-xs font-semibold"
                                style={{ color: 'var(--text-primary)' }}
                              >
                                {job.id}
                              </span>
                              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                                {job.attemptsMade} attempts
                              </span>
                              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                                {new Date(job.timestamp).toLocaleString()}
                              </span>
                            </div>
                            <p className="mt-0.5 truncate text-xs text-red-600">
                              {job.failedReason}
                            </p>
                          </div>
                          <div className="flex flex-shrink-0 gap-1.5">
                            <button
                              onClick={() => {
                                handleJobAction(queue.name, job.id, 'retry');
                              }}
                              disabled={isPending}
                              className="rounded-lg border px-2.5 py-1 text-xs font-semibold transition-colors hover:bg-blue-50 disabled:opacity-50"
                              style={{
                                borderColor: 'var(--border-default)',
                                color: 'var(--brand-primary)',
                              }}
                            >
                              Retry
                            </button>
                            <button
                              onClick={() => {
                                handleJobAction(queue.name, job.id, 'discard');
                              }}
                              disabled={isPending}
                              className="rounded-lg border px-2.5 py-1 text-xs font-semibold transition-colors hover:bg-red-50 disabled:opacity-50"
                              style={{ borderColor: 'rgba(239,68,68,0.3)', color: '#ef4444' }}
                            >
                              Discard
                            </button>
                          </div>
                        </div>
                        <details className="mt-1">
                          <summary
                            className="cursor-pointer text-xs hover:underline"
                            style={{ color: 'var(--text-muted)' }}
                          >
                            Job payload
                          </summary>
                          <pre
                            className="mt-1 overflow-x-auto rounded-lg p-2 text-xs"
                            style={{ background: 'var(--bg-subtle)', color: 'var(--text-muted)' }}
                          >
                            {JSON.stringify(job.data, null, 2)}
                          </pre>
                        </details>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </main>
    </div>
  );
}
