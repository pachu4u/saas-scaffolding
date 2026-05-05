interface TopbarProps {
  title: string;
  subtitle?: string;
  userEmail?: string;
  userName?: string | undefined;
  actions?: React.ReactNode;
  /** Breadcrumb segments shown before the title */
  breadcrumb?: string[];
}

export function Topbar({ title, subtitle, userEmail, userName, actions, breadcrumb }: TopbarProps) {
  const initials = userName
    ? userName
        .split(' ')
        .map((n) => n[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : (userEmail?.[0]?.toUpperCase() ?? 'U');

  return (
    <header
      className="sticky top-0 z-30 flex h-14 items-center justify-between gap-4 border-b px-6"
      style={{
        background: 'rgba(255,255,255,0.97)',
        backdropFilter: 'blur(12px)',
        borderColor: 'var(--border-light)',
        boxShadow: '0 1px 0 var(--border-light)',
      }}
    >
      {/* Left: breadcrumb + title */}
      <div className="min-w-0 flex-1">
        {breadcrumb && breadcrumb.length > 0 && (
          <div className="mb-0.5 flex items-center gap-1.5">
            {breadcrumb.map((crumb, i) => (
              <span key={i} className="flex items-center gap-1.5">
                {i > 0 && (
                  <svg
                    viewBox="0 0 6 10"
                    fill="none"
                    className="h-2.5 w-1.5"
                    stroke="currentColor"
                    strokeWidth={1.5}
                    style={{ color: 'var(--text-muted)' }}
                  >
                    <path d="M1 1l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
                <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                  {crumb}
                </span>
              </span>
            ))}
          </div>
        )}
        <div className="flex items-baseline gap-2.5">
          <h1
            className="truncate text-sm font-bold leading-tight"
            style={{ color: 'var(--text-primary)' }}
          >
            {title}
          </h1>
          {subtitle && (
            <span className="hidden text-xs md:block" style={{ color: 'var(--text-muted)' }}>
              {subtitle}
            </span>
          )}
        </div>
      </div>

      {/* Right: actions + notifications + user */}
      <div className="flex flex-shrink-0 items-center gap-2">
        {actions}

        {/* Notification bell */}
        <button
          className="relative flex h-8 w-8 items-center justify-center rounded-lg border transition-colors hover:bg-gray-50"
          style={{ borderColor: 'var(--border-light)', color: 'var(--text-secondary)' }}
          title="Notifications"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
            <path d="M10 2a6 6 0 0 0-6 6v3.586l-.707.707A1 1 0 0 0 4 14h12a1 1 