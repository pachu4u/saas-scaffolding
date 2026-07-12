import { auth } from '@platform/auth';
import { env } from '@platform/config';
import { adminDb } from '@platform/db';
import { redirect } from 'next/navigation';

import { Topbar } from '@/components/layout/topbar';

export const metadata = { title: 'Settings — Platform Admin' };

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-5 py-3">
      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
        {label}
      </span>
      <code className="text-xs" style={{ color: 'var(--text-primary)' }}>
        {value}
      </code>
    </div>
  );
}

function LinkCard({
  title,
  description,
  href,
}: {
  title: string;
  description: string;
  href: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="hover:border-brand-secondary block rounded-xl border p-4 transition-colors"
      style={{
        background: 'var(--bg-white)',
        borderColor: 'var(--border-light)',
        boxShadow: 'var(--shadow-card)',
      }}
    >
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
          {title}
        </h3>
        <span style={{ color: 'var(--text-muted)' }}>↗</span>
      </div>
      <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
        {description}
      </p>
    </a>
  );
}

export default async function AdminSettingsPage() {
  const session = await auth();
  if (!session) redirect('/auth/signin');

  const [tenantCount, userCount, jobCount] = await Promise.all([
    adminDb.tenant.count(),
    adminDb.user.count(),
    adminDb.job.count(),
  ]);

  return (
    <div>
      <Topbar
        title="Platform Settings"
        subtitle="Environment, deployment, and operational shortcuts"
        userEmail={session.user.email}
        userName={session.user.name ?? undefined}
      />
      <main className="space-y-5 p-6">
        {/* Environment */}
        <div
          className="overflow-hidden rounded-xl border"
          style={{
            background: 'var(--bg-white)',
            borderColor: 'var(--border-light)',
            boxShadow: 'var(--shadow-card)',
          }}
        >
          <div className="border-b px-5 py-3" style={{ borderColor: 'var(--border-light)' }}>
            <h2 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
              Environment
            </h2>
          </div>
          <div className="divide-y" style={{ borderColor: 'var(--border-light)' }}>
            <InfoRow label="Environment" value={env.NODE_ENV} />
            <InfoRow label="Build SHA" value={env.GIT_SHA} />
            <InfoRow label="App URL" value={env.NEXT_PUBLIC_APP_URL} />
            <InfoRow label="Keycloak issuer" value={env.KEYCLOAK_ISSUER} />
            <InfoRow label="Total tenants" value={String(tenantCount)} />
            <InfoRow label="Total users" value={String(userCount)} />
            <InfoRow label="Total jobs processed" value={String(jobCount)} />
          </div>
        </div>

        {/* Operational shortcuts */}
        <div>
          <h2 className="mb-3 text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
            Operational consoles
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <LinkCard
              title="Keycloak admin console"
              description="Manage realms, users, and identity providers."
              href="https://auth.lvh.me/admin"
            />
            <LinkCard
              title="Grafana"
              description="Metrics, logs, and traces (Prometheus + Loki + Tempo)."
              href="https://grafana.lvh.me"
            />
            <LinkCard
              title="Traefik dashboard"
              description="Reverse proxy routing and TLS status."
              href="https://traefik.lvh.me"
            />
            <LinkCard
              title="Jobs & DLQ"
              description="Inspect queue depths and dead-letter jobs."
              href="/admin/jobs"
            />
          </div>
        </div>

        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          There is no platform-wide settings table yet — this page surfaces live environment and
          deployment info rather than editable values that wouldn&apos;t actually persist anywhere.
        </p>
      </main>
    </div>
  );
}
