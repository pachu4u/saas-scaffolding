import { auth } from '@platform/auth';
import { redirect } from 'next/navigation';

import { STATUS_BADGE, STATUS_DOT, STATUS_LABEL } from '@/components/admin/health-status';
import { Topbar } from '@/components/layout/topbar';
import { Badge } from '@/components/ui/badge';
import { CHECK_TIMEOUT_MS, getSystemHealth } from '@/lib/system-health';

export const dynamic = 'force-dynamic';

export default async function AdminHealthPage() {
  const session = await auth();
  if (!session) redirect('/auth/signin');

  const report = await getSystemHealth();
  const checkedAt = new Date(report.checkedAt);

  return (
    <div>
      <Topbar
        title="System Health"
        subtitle={`Checked ${checkedAt.toUTCString()} · ${String(CHECK_TIMEOUT_MS / 1000)}s timeout per check`}
        userEmail={session.user.email}
        userName={session.user.name ?? undefined}
        actions={
          <Badge variant={STATUS_BADGE[report.status]} dot>
            {report.status === 'healthy' ? 'All systems operational' : STATUS_LABEL[report.status]}
          </Badge>
        }
      />

      <main className="space-y-5 p-6">
        <div
          className="overflow-x-auto rounded-xl border"
          style={{
            background: 'var(--bg-white)',
            borderColor: 'var(--border-light)',
            boxShadow: 'var(--shadow-card)',
          }}
        >
          <table className="w-full text-left text-xs">
            <thead>
              <tr style={{ color: 'var(--text-muted)' }}>
                <th className="px-4 py-3 font-semibold">Service</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 text-right font-semibold">Latency</th>
                <th className="px-4 py-3 font-semibold">Detail</th>
              </tr>
            </thead>
            <tbody>
              {report.checks.map((c) => (
                <tr key={c.key} className="border-t" style={{ borderColor: 'var(--border-light)' }}>
                  <td className="px-4 py-3 font-medium" style={{ color: 'var(--text-primary)' }}>
                    <span className="flex items-center gap-2">
                      <span
                        className="h-2 w-2 flex-shrink-0 rounded-full"
                        style={{ background: STATUS_DOT[c.status] }}
                      />
                      {c.service}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={STATUS_BADGE[c.status]}>{STATUS_LABEL[c.status]}</Badge>
                  </td>
                  <td
                    className="px-4 py-3 text-right tabular-nums"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    {c.key === 'web' ? '—' : `${String(c.latencyMs)} ms`}
                  </td>
                  <td className="px-4 py-3 font-mono" style={{ color: 'var(--text-secondary)' }}>
                    {c.detail}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between text-xs">
          <a
            href="/admin"
            className="font-semibold hover:underline"
            style={{ color: 'var(--brand-primary)' }}
          >
            ← Back to overview
          </a>
          <a
            href="/api/admin/health"
            className="font-semibold hover:underline"
            style={{ color: 'var(--brand-primary)' }}
          >
            View as JSON
          </a>
        </div>
      </main>
    </div>
  );
}
