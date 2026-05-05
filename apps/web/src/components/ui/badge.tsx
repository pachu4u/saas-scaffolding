import type { ReactNode } from 'react';

type Variant = 'default' | 'success' | 'warning' | 'error' | 'purple' | 'blue' | 'gray';

const variants: Record<Variant, { bg: string; color: string; border: string }> = {
  default: {
    bg: 'var(--bg-subtle)',
    color: 'var(--brand-secondary)',
    border: 'var(--border-default)',
  },
  success: { bg: 'rgba(22, 163, 74, 0.08)', color: '#16A34A', border: 'rgba(22, 163, 74, 0.2)' },
  warning: { bg: 'rgba(217, 119, 6, 0.08)', color: '#D97706', border: 'rgba(217, 119, 6, 0.2)' },
  error: { bg: 'rgba(220, 38, 38, 0.08)', color: '#DC2626', border: 'rgba(220, 38, 38, 0.2)' },
  purple: {
    bg: 'rgba(176, 108, 255, 0.1)',
    color: 'var(--brand-accent)',
    border: 'rgba(176, 108, 255, 0.25)',
  },
  blue: {
    bg: 'rgba(79, 123, 255, 0.08)',
    color: 'var(--brand-primary)',
    border: 'rgba(79, 123, 255, 0.2)',
  },
  gray: {
    bg: 'rgba(82, 82, 82, 0.06)',
    color: 'var(--text-secondary)',
    border: 'rgba(82, 82, 82, 0.12)',
  },
};

interface BadgeProps {
  children: ReactNode;
  variant?: Variant;
  dot?: boolean;
  className?: string;
}

export function Badge({ children, variant = 'default', dot = false, className = '' }: BadgeProps) {
  const v = variants[variant];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${className}`}
      style={{ background: v.bg, color: v.color, borderColor: v.border }}
    >
      {dot && (
        <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full" style={{ background: v.color }} />
      )}
      {children}
    </span>
  );
}
