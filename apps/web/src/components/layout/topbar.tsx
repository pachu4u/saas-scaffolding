import { signOut } from '@platform/auth';

interface TopbarProps {
  title: string;
  subtitle?: string;
  userEmail?: string;
  userName?: string | undefined;
  actions?: React.ReactNode;
}

export function Topbar({ title, subtitle, userEmail, userName, actions }: TopbarProps) {
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
      className="sticky top-0 z-30 flex h-16 items-center justify-between border-b px-6"
      style={{
        background: 'rgba(248, 246, 255, 0.9)',
        backdropFilter: 'blur(12px)',
        borderColor: 'var(--border-light)',
      }}
    >
      <div>
        <h1 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>
          {title}
        </h1>
        {subtitle && (
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {subtitle}
          </p>
        )}
      </div>

      <div className="flex items-center gap-3">
        {actions}

        {/* Notifications */}
        <button
          className="hover:bg-bg-subtle relative flex h-9 w-9 items-center justify-center rounded-xl border transition-colors"
          style={{ borderColor: 'var(--border-light)', color: 'var(--text-secondary)' }}
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="w-4.5 h-4.5">
            <path d="M10 2a6 6 0 0 0-6 6v3.586l-.707.707A1 1 0 0 0 4 14h12a1 1 0 0 0 .707-1.707L16 11.586V8a6 6 0 0 0-6-6zm0 16a2 2 0 0 1-2-2h4a2 2 0 0 1-2 2z" />
          </svg>
          <span
            className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full"
            style={{ background: 'var(--brand-accent)' }}
          />
        </button>

        {/* User menu */}
        <div className="flex items-center gap-2.5">
          <div className="brand-gradient flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white">
            {initials}
          </div>
          <div className="hidden md:block">
            <div className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
              {userName ?? userEmail}
            </div>
            {userName && userEmail && (
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {userEmail}
              </div>
            )}
          </div>
          <form
            action={async () => {
              'use server';
              await signOut({ redirectTo: '/auth/signin' });
            }}
          >
            <button
              type="submit"
              className="hover:bg-bg-subtle rounded-lg border px-2.5 py-1.5 text-xs transition-colors"
              style={{ borderColor: 'var(--border-light)', color: 'var(--text-muted)' }}
            >
              Sign out
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
