import type { ReactNode } from 'react';

interface StatCardProps {
  label: string;
  value: string;
  change?: string;
  positive?: boolean;
  icon: ReactNode;
  iconColor?: string;
}

export function StatCard({
  label,
  value,
  change,
  positive = true,
  icon,
  iconColor,
}: StatCardProps) {
  return (
    <div
      className="flex flex-col gap-3 rounded-2xl border p-5"
      style={{
        background: 'var(--bg-white)',
        borderColor: 'var(--border-light)',
        boxShadow: 'var(--shadow-card)',
      }}
    >
      <div className="flex items-center justify-between">
        <span
          className="text-xs font-semibold uppercase tracking-wide"
          style={{ color: 'var(--text-muted)' }}
        >
          {label}
        </span>
        <div
          className="flex h-9 w-9 items-center justify-center rounded-xl"
          style={{ background: iconColor ?? 'var(--bg-subtle)' }}
        >
          {icon}
        </div>
      </div>
      <div className="flex items-end gap-2">
        <span className="text-3xl font-extrabold" style={{ color: 'var(--text-primary)' }}>
          {value}
        </span>
        {change && (
          <span
            className="mb-1 text-xs font-semibold"
            style={{ color: positive ? 'var(--status-success)' : 'var(--status-error)' }}
          >
            {positive ? '↑' : '↓'} {change}
          </span>
        )}
      </div>
    </div>
  );
}
