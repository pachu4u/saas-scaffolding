import { Badge } from '@/components/ui/badge';

interface InstanceRow {
  id: string;
  tenantName: string;
  tenantSlug: string;
  scimBaseUrl: string;
  status: string;
  lastSyncedAt: string | null;
  lastSyncError: string | null;
}

function timeAgo(iso: string) {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60) return 'just now';
  if (secs < 3600) return `${String(Math.floor(secs / 60))}m ago`;
  if (secs < 86400) return `${String(Math.floor(secs / 3600))}h ago`;
  return `${String(Math.floor(secs / 86400))}d ago`;
}

export function ConnectedAppInstancesTable({ data }: { data: InstanceRow[] }) {
  if (data.length === 0) {
    return (
      <div
        className="rounded-xl border p-6 text-center text-xs"
        style={{
          background: 'var(--bg-white)',
          borderColor: 'var(--border-light)',
          color: 'var(--text-muted)',
        }}
      >
        No tenant has connected this app yet. Instances are created automatically during tenant
        provisioning once a SCIM endpoint is available.
      </div>
    );
  }

  return (
    <div
      className="overflow-hidden rounded-xl border"
      style={{
        background: 'var(--bg-white)',
        borderColor: 'var(--border-light)',
        boxShadow: 'var(--shadow-card)',
      }}
    >
      <table className="w-full">
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border-light)' }}>
            {['Tenant', 'SCIM base URL', 'Status', 'Last synced'].map((h) => (
              <th
                key={h}
                className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide"
                style={{ color: 'var(--text-muted)' }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((instance) => (
            <tr key={instance.id} style={{ borderBottom: '1px solid var(--border-light)' }}>
              <td
                className="px-5 py-3 text-sm font-medium"
                style={{ color: 'var(--text-primary)' }}
              >
                {instance.tenantName}{' '}
                <code className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                  {instance.tenantSlug}
                </code>
              </td>
              <td
                className="px-5 py-3 font-mono text-xs"
                style={{ color: 'var(--text-secondary)' }}
              >
                {instance.scimBaseUrl}
              </td>
              <td className="px-5 py-3">
                <Badge variant={instance.status === 'ACTIVE' ? 'success' : 'gray'} dot>
                  {instance.status.charAt(0) + instance.status.slice(1).toLowerCase()}
                </Badge>
              </td>
              <td className="px-5 py-3 text-xs" style={{ color: 'var(--text-muted)' }}>
                {instance.lastSyncError ? (
                  <span style={{ color: 'var(--status-error)' }}>
                    Error: {instance.lastSyncError}
                  </span>
                ) : instance.lastSyncedAt ? (
                  timeAgo(instance.lastSyncedAt)
                ) : (
                  'Never'
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
