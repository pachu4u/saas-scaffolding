'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { WorkspaceSwitcher } from './workspace-switcher';

// ─── Inline SVG icons (stroke-based) ─────────────────────────────────────────
const Icon = {
  layout: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      className="h-4 w-4"
    >
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
    </svg>
  ),
  users: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      className="h-4 w-4"
    >
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  shield: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      className="h-4 w-4"
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  ),
  creditCard: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      className="h-4 w-4"
    >
      <rect x="1" y="4" width="22" height="16" rx="2" />
      <line x1="1" y1="10" x2="23" y2="10" />
    </svg>
  ),
  fileText: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      className="h-4 w-4"
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  ),
  settings: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      className="h-4 w-4"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  ),
  palette: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      className="h-4 w-4"
    >
      <circle cx="13.5" cy="6.5" r=".5" fill="currentColor" />
      <circle cx="17.5" cy="10.5" r=".5" fill="currentColor" />
      <circle cx="8.5" cy="7.5" r=".5" fill="currentColor" />
      <circle cx="6.5" cy="12.5" r=".5" fill="currentColor" />
      <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z" />
    </svg>
  ),
  lock: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      className="h-4 w-4"
    >
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  ),
  key: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      className="h-4 w-4"
    >
      <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
    </svg>
  ),
  building: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      className="h-4 w-4"
    >
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  ),
  briefcase: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      className="h-4 w-4"
    >
      <rect x="2" y="7" width="20" height="14" rx="2" />
      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
    </svg>
  ),
  trendingUp: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      className="h-4 w-4"
    >
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
      <polyline points="17 6 23 6 23 12" />
    </svg>
  ),
  webhook: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      className="h-4 w-4"
    >
      <path d="M18 16.98h-5.99c-1.1 0-1.95.94-2.48 1.9A4 4 0 0 1 2 17c.01-.7.2-1.4.57-2" />
      <path d="m6 17 3.13-5.78c.53-.97.1-2.18-.5-3.1a4 4 0 1 1 6.89-4.06" />
      <path d="m12 6 3.13 5.73C15.66 12.7 16.9 13 18 13a4 4 0 0 1 0 8" />
    </svg>
  ),
  externalLink: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      className="h-3.5 w-3.5"
    >
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  ),
};

// ─── Navigation definitions ───────────────────────────────────────────────────

const tenantSections = [
  {
    label: 'WORKSPACE',
    items: [{ label: 'Dashboard', href: '/dashboard', icon: Icon.layout }],
  },
  {
    label: 'TEAM',
    items: [
      { label: 'Members', href: '/team', icon: Icon.users },
      { label: 'Roles & Permissions', href: '/team/roles', icon: Icon.shield },
    ],
  },
  {
    label: 'ACCOUNT',
    items: [
      { label: 'Billing', href: '/billing', icon: Icon.creditCard },
      { label: 'Audit Log', href: '/audit', icon: Icon.fileText },
    ],
  },
  {
    label: 'SETTINGS',
    items: [
      { label: 'General', href: '/settings', icon: Icon.settings },
      { label: 'Branding', href: '/settings/branding', icon: Icon.palette },
      { label: 'Security & SSO', href: '/settings/security', icon: Icon.lock },
      { label: 'API Keys', href: '/settings/api-keys', icon: Icon.key },
    ],
  },
];

const adminSections = [
  {
    label: 'PLATFORM',
    items: [
      { label: 'Overview', href: '/admin', icon: Icon.layout },
      { label: 'Tenants', href: '/admin/tenants', icon: Icon.building },
      { label: 'Users', href: '/admin/users', icon: Icon.users },
      { label: 'Jobs', href: '/admin/jobs', icon: Icon.briefcase },
    ],
  },
  {
    label: 'ANALYTICS',
    items: [{ label: 'Revenue', href: '/admin/revenue', icon: Icon.trendingUp }],
  },
  {
    label: 'SYSTEM',
    items: [{ label: 'Settings', href: '/settings', icon: Icon.settings }],
  },
];

// ─── Types ────────────────────────────────────────────────────────────────────

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
}

interface NavSection {
  label: string;
  items: NavItem[];
}

interface SidebarProps {
  tenantName?: string;
  tenantSlug?: string;
  /** When true, show platform admin navigation instead of tenant navigation */
  isAdmin?: boolean;
  /** Current user email/name for footer */
  userEmail?: string;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <Link
      href={item.href}
      className="flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors"
      style={
        active
          ? {
              background: 'var(--brand-primary)',
              color: '#fff',
            }
          : {
              color: 'var(--text-secondary)',
            }
      }
    >
      <span style={{ color: active ? '#fff' : 'var(--text-muted)', flexShrink: 0 }}>
        {item.icon}
      </span>
      {item.label}
    </Link>
  );
}

function SectionGroup({
  section,
  isActive,
}: {
  section: NavSection;
  isActive: (href: string) => boolean;
}) {
  return (
    <div className="mb-4">
      <div className="mb-1 px-2.5 py-1">
        <span
          className="text-[10px] font-semibold uppercase tracking-widest"
          style={{ color: 'var(--text-muted)' }}
        >
          {section.label}
        </span>
      </div>
      <div className="space-y-0.5">
        {section.items.map((item) => (
          <NavLink key={item.href} item={item} active={isActive(item.href)} />
        ))}
      </div>
    </div>
  );
}

// ─── Main Sidebar ─────────────────────────────────────────────────────────────

export function Sidebar({
  tenantName = 'Workspace',
  tenantSlug,
  isAdmin,
  userEmail,
}: SidebarProps) {
  const pathname = usePathname();

  // Active state: exact match, or starts-with for non-root paths (avoid /team matching /team/roles)
  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard';
    if (href === '/team') return pathname === '/team';
    if (href === '/settings') return pathname === '/settings';
    if (href === '/admin') return pathname === '/admin';
    return pathname === href || pathname.startsWith(href + '/');
  };

  const sections: NavSection[] = isAdmin ? adminSections : tenantSections;
  const logoLabel = isAdmin ? 'Platform Admin' : 'riogentix';

  return (
    <aside
      className="fixed bottom-0 left-0 top-0 z-40 flex w-56 flex-col overflow-y-auto border-r"
      style={{ background: 'var(--bg-white)', borderColor: 'var(--border-light)' }}
    >
      {/* ── Logo ──────────────────────────────────────────────────────────── */}
      <div
        className="flex-shrink-0 border-b px-4 py-4"
        style={{ borderColor: 'var(--border-light)' }}
      >
        <div className="flex items-center gap-2.5">
          <div className="brand-gradient flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white">
            {isAdmin ? 'P' : 'R'}
          </div>
          <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
            {logoLabel}
          </span>
        </div>
        {!isAdmin && (
          <div className="mt-3">
            <WorkspaceSwitcher
              currentName={tenantName}
              {...(tenantSlug ? { currentSlug: tenantSlug } : {})}
            />
          </div>
        )}
      </div>

      {/* ── Nav ───────────────────────────────────────────────────────────── */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {sections.map((section) => (
          <SectionGroup key={section.label} section={section} isActive={isActive} />
        ))}
      </nav>

      {/* ── Footer ────────────────────────────────────────────────────────── */}
      <div
        className="flex-shrink-0 border-t px-3 py-3"
        style={{ borderColor: 'var(--border-light)' }}
      >
        <Link
          href={isAdmin ? 'https://auth.lvh.me/admin' : '/profile'}
          target={isAdmin ? '_blank' : undefined}
          rel={isAdmin ? 'noopener noreferrer' : undefined}
          className="flex items-center gap-2.5 rounded-lg px-2 py-2 transition-colors hover:bg-gray-50"
        >
          <div className="brand-gradient flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold text-white">
            {isAdmin ? 'A' : 'U'}
          </div>
          <div className="min-w-0 flex-1">
            <div
              className="truncate text-xs font-semibold"
              style={{ color: 'var(--text-primary)' }}
            >
              {isAdmin ? 'Admin Console' : 'My Account'}
            </div>
            <div className="truncate text-xs" style={{ color: 'var(--text-muted)' }}>
              {isAdmin ? 'Keycloak →' : 'View profile'}
            </div>
          </div>
          {isAdmin && (
            <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>{Icon.externalLink}</span>
          )}
        </Link>
      </div>
    </aside>
  );
}
