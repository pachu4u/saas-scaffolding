import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

const variantStyles: Record<Variant, string> = {
  primary: 'text-white brand-gradient hover:opacity-90 brand-shadow',
  secondary: 'border hover:bg-bg-subtle',
  ghost: 'hover:bg-bg-subtle',
  danger: 'bg-red-50 text-red-600 border border-red-100 hover:bg-red-100',
};

const variantInlineStyles: Record<Variant, React.CSSProperties> = {
  primary: {},
  secondary: {
    borderColor: 'var(--border-default)',
    color: 'var(--text-primary)',
    background: 'var(--bg-white)',
  },
  ghost: { color: 'var(--text-secondary)' },
  danger: {},
};

const sizeStyles: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-xs rounded-lg',
  md: 'px-4 py-2 text-sm rounded-xl',
  lg: 'px-6 py-3 text-base rounded-xl',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
  loading?: boolean;
}

export function Button({
  variant = 'primary',
  size = 'md',
  children,
  loading,
  className = '',
  style,
  ...props
}: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-50 ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
      style={{ ...variantInlineStyles[variant], ...style }}
      disabled={(loading ?? false) || props.disabled}
      {...props}
    >
      {loading && (
        <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
          <circle
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="3"
            strokeOpacity="0.25"
          />
          <path
            d="M12 2a10 10 0 0 1 10 10"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
          />
        </svg>
      )}
      {children}
    </button>
  );
}
