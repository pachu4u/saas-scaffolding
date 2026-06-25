interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
      <div
        className="flex h-12 w-12 items-center justify-center rounded-full"
        style={{ background: 'var(--bg-subtle)', color: 'var(--text-muted)' }}
      >
        {icon}
      </div>
      <div>
        <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
          {title}
        </p>
        {description && (
          <p className="mt-1 max-w-xs text-xs" style={{ color: 'var(--text-muted)' }}>
            {description}
          </p>
        )}
      </div>
      {action}
    </div>
  );
}
