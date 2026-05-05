import type { ReactNode } from 'react';

interface StatCardProps {
  label: string;
  value: string;
  change?: string;
  positive?: boolean;
  icon: ReactNode;
  iconColor?: string;
  /** If true, show a left-border accent stripe instead of icon background */
  accent?: string;
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
      className="flex flex-col gap-2 rounded-xl border p-4"
      style={{
        background: 'var(--bg-white)',
        borderColor: 'var(--border-light)',
        boxShadow: 'var(--shadow-card)',
      }}
    >
      {/* Header row: label + icon */}
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs font-medium leading-snug" style={{ color: 'var(--text-muted)' }}>
          {label}
        </span>
        <div
          className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg"
          style={{ background: iconColor ?? 'var(--bg-subtle)' }}
        >
          {icon}
        </div>
      </div>

      {/* Value */}
      <div className="flex items-end gap-2">
        <span
          className="text-2xl font-extrabold leading-none tracking-tight"
          style={{ color: 'var(--text-primary)' }}
        >
          {value}
        </span>
      </div>

      {/* Change badge */}
      {change && (
        <div className="flex items-center gap-1">
          <span
            className="inline-flex items-center gap-0.5 rounded text-[11px] font-semibold"
            style={{ color: positive ? 'var(--status-success)' : 'var(--status-error)' }}
          >
            {positive ? (
              <svg viewBox="0 0 12 12" fill="currentColor" className="h-3 w-3">
                <path d="M6 2l4 5H2z" />
              </svg>
            ) : (
              <svg viewBox="0 0 12 12" fill="currentColor" className="h-3 w-3">
                <path d="M6 10L2 5h8z" />
              </svg>
            )}
            {change}
          </span>
        </div>
      )}
    </div>
  );
}
