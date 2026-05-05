'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

type EnvironmentType = 'DEV' | 'TEST' | 'PROD';
type ProvisioningStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
type EnvironmentStatus = 'PENDING' | 'PROVISIONING' | 'ACTIVE' | 'FAILED';

interface Environment {
  id: string;
  type: EnvironmentType;
  status: EnvironmentStatus;
  endpoint: string | null;
}

const STATUS_COLORS: Record<ProvisioningStatus, string> = {
  PENDING: 'var(--text-muted)',
  IN_PROGRESS: 'var(--brand-primary)',
  COMPLETED: 'var(--status-success)',
  FAILED: '#ef4444',
};

const ENV_STATUS_COLORS: Record<EnvironmentStatus, string> = {
  PENDING: 'var(--text-muted)',
  PROVISIONING: 'var(--brand-primary)',
  ACTIVE: 'var(--status-success)',
  FAILED: '#ef4444',
};

export function ProvisioningPanel({
  tenantId,
  initialStatus,
  initialEnvironments,
}: {
  tenantId: string;
  initialStatus: ProvisioningStatus;
  initialEnvironments: Environment[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selectedEnvs, setSelectedEnvs] = useState<EnvironmentType[]>(['DEV', 'TEST', 'PROD']);
  const [error, setError] = useState<string | null>(null);

  function toggleEnv(type: EnvironmentType) {
    setSelectedEnvs((prev) =>
      prev.includes(type) ? prev.filter((e) => e !== type) : [...prev, type],
    );
  }

  function handleProvision() {
    if (selectedEnvs.length === 0) return;
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/admin/tenants/${tenantId}/provision`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ environments: selectedEnvs }),
        });
        const data = (await res.json()) as { ok?: boolean; error?: string };
        if (!data.ok) {
          setError(data.error ?? 'Provisioning failed');
          return;
        }
        // Poll for updates
        const poll = setInterval(() => {
          router.refresh();
        }, 3_000);
        setTimeout(() => clearInterval(poll), 30_000);
        router.refresh();
      } catch {
        setError('Request failed');
      }
    });
  }

  const statusColor = STATUS_COLORS[initialStatus];

  return (
    <div
      className="rounded-xl border p-6"
      style={{
        background: 'var(--bg-white)',
        borderColor: 'var(--border-light)',
        boxShadow: 'var(--shadow-card)',
      }}
    >
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
          Provisioning
        </h2>
        <div className="flex items-center gap-2">
          {initialStatus === 'IN_PROGRESS' && (
            <span
              className="h-2 w-2 animate-pulse rounded-full"
              style={{ background: 'var(--brand-primary)' }}
            />
          )}
          <span
            className="rounded-full px-2.5 py-0.5 text-xs font-bold text-white"
            style={{ background: statusColor }}
          >
            {initialStatus.replace('_', ' ')}
          </span>
        </div>
      </div>

      {/* Environment selector */}
      <div className="mb-4">
        <p className="mb-2 text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
          Select environments to provision:
        </p>
        <div className="flex gap-2">
          {(['DEV', 'TEST', 'PROD'] as EnvironmentType[]).map((type) => (
            <button
              key={type}
              onClick={() => toggleEnv(type)}
              className="rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors"
              style={{
                borderColor: selectedEnvs.includes(type)
                  ? 'var(--brand-primary)'
                  : 'var(--border-light)',
                background: selectedEnvs.includes(type)
                  ? 'rgba(79,123,255,0.08)'
                  : 'var(--bg-main)',
                color: selectedEnvs.includes(type)
                  ? 'var(--brand-primary)'
                  : 'var(--text-secondary)',
              }}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      {/* Environments table */}
      {initialEnvironments.length > 0 && (
        <div
          className="mb-4 overflow-hidden rounded-xl border"
          style={{ borderColor: 'var(--border-light)' }}
        >
          <table className="w-full">
            <thead>
              <tr
                style={{
                  borderBottom: '1px solid var(--border-light)',
                  background: 'var(--bg-subtle)',
                }}
              >
                {['Environment', 'Status', 'Endpoint'].map((col) => (
                  <th
                    key={col}
                    className="px-4 py-2 text-left text-xs font-semibold"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {initialEnvironments.map((env) => (
                <tr key={env.id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                  <td className="px-4 py-2.5">
                    <span
                      className="rounded-md px-2 py-0.5 text-xs font-bold"
                      style={{ background: 'var(--bg-subtle)', color: 'var(--text-primary)' }}
                    >
                      {env.type}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-1.5">
                      {env.status === 'PROVISIONING' && (
                        <span
                          className="h-1.5 w-1.5 animate-pulse rounded-full"
                          style={{ background: ENV_STATUS_COLORS[env.status] }}
                        />
                      )}
                      <span
                        className="text-xs font-semibold"
                        style={{ color: ENV_STATUS_COLORS[env.status] }}
                      >
                        {env.status}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    {env.endpoint ? (
                      <a
                        href={env.endpoint}
                        target="_blank"
                        rel="noreferrer"
                        className="font-mono text-xs hover:underline"
                        style={{ color: 'var(--brand-primary)' }}
                      >
                        {env.endpoint}
                      </a>
                    ) : (
       