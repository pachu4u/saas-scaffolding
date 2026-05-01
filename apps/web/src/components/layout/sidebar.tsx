'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
  {
    label: 'Dashboard',
    href: '/dashboard',
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
        <path d="M2 11a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-5zm6-4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V7zm6-3a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1V4z" />
      </svg>
    ),
    sub: [],
  },
  {
    label: 'Team',
    href: '/team',
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
        <path d="M9 6a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM17 6a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 0 0-1.5-4.33A5 5 0 0 1 19 16v1h-6.07zM6 11a5 5 0 0 1 5 5v1H1v-1a5 5 0 0 1 5-5z" />
      </svg>
    ),
    sub: [
      { label: 'Members', href: '/team' },
      { label: 'Roles & Permissions', href: '/team/roles' },
    ],
  },
  {
    label: 'Billing',
    href: '/billing',
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
        <path d="M4 4a2 2 0 0 0-2 2v1h16V6a2 2 0 0 0-2-2H4zM18 9H2v5a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9zM4 13a1 1 0 0 1 1-1h1a1 1 0 1 1 0 2H5a1 1 0 0 1-1-1zm5-1a1 1 0 1 0 0 2h1a1 1 0 1 0 0-2H9z" />
      </svg>
    ),
    sub: [],
  },
  {
    label: 'Audit Log',
    href: '/audit',
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
        <path
          fillRule="evenodd"
          d="M3 4a1 1 0 0 1 1-1h12a1 1 0 1 1 0 2H4a1 1 0 0 1-1-1zm0 4a1 1 0 0 1 1-1h12a1 1 0 1 1 0 2H4a1 1 0 0 1-1-1zm0 4a1 1 0 0 1 1-1h12a1 1 0 1 1 0 2H4a1 1 0 0 1-1-1zm0 4a1 1 0 0 1 1-1h12a1 1 0 1 1 0 2H4a1 1 0 0 1-1-1z"
          clipRule="evenodd"
        />
      </svg>
    ),
    sub: [],
  },
  {
    label: 'Settings',
    href: '/settings',
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
        <path
          fillRule="evenodd"
          d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 0 1-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 0 1 .947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 0 1 2.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 0 1 2.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 0 1 .947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 0 1-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 0 1-2.287-.947zM10 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"
          clipRule="evenodd"
        />
      </svg>
    ),
    sub: [
      { label: 'General', href: '/settings' },
      { label: 'Branding', href: '/settings/branding' },
      { label: 'Security & SSO', href: '/settings/security' },
      { label: 'API Keys', href: '/settings/api-keys' },
    ],
  },
];

const adminItems = [
  {
    label: 'Platform Admin',
    href: '/admin',
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
        <path
          fillRule="evenodd"
          d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0zm-6-3a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm-2 4a5 5 0 0 0-4.546 2.916A5.986 5.986 0 0 0 10 16a5.986 5.986 0 0 0 4.546-2.084A5 5 0 0 0 10 11z"
          clipRule="evenodd"
        />
      </svg>
    ),
    sub: [
      { label: 'Overview', href: '/admin' },
      { label: 'Tenants', href: '/admin/tenants' },
    ],
  },
];

interface SidebarProps {
  tenantName?: string;
  tenantSlug?: string;
  isAdmin?: boolean;
}

export function Sidebar({ tenantName = 'Workspace', tenantSlug, isAdmin }: SidebarProps) {
  const pathname = usePathname();

  const isParentActive = (href: string, sub: { href: string }[]) => {
    if (href === '/dashboard') return pathname === '/dashboard';
    return (
      pathname === href ||
      sub.some((s) => pathname === s.href || pathname.startsWith(s.href + '/')) ||
      pathname.startsWith(href + '/')
    );
  };

  const isSubActive = (href: string) =>
    pathname === href ||
    (href !== '/team' &&
      href !== '/settings' &&
      href !== '/admin' &&
      pathname.startsWith(href + '/'));

  return (
    <aside
      className="fixed bottom-0 left-0 top-0 z-40 flex w-60 flex-col overflow-y-auto border-r"
      style={{ background: 'var(--bg-white)', borderColor: 'var(--border-light)' }}
    >
      {/* Logo + workspace */}
      <div className="flex-shrink-0 border-b p-4" style={{ borderColor: 'var(--border-light)' }}>
        <div className="mb-3 flex items-center gap-2.5">
          <div className="brand-gradient flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white">
            R
          </div>
          <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
            riogentix
          </span>
        </div>
        <div
          className="hover:bg-bg-subtle flex cursor-pointer items-center gap-2 rounded-xl px-2.5 py-2 transition-colors"
          style={{ background: 'var(--bg-main)' }}
        >
          <div
            className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md text-xs font-bold text-white"
            style={{ background: 'var(--brand-secondary)' }}
          >
            {tenantName[0]?.toUpperCase()}
          </div>
          <div className="min-w-0">
            <div
              className="truncate text-xs font-semibold"
              style={{ color: 'var(--text-primary)' }}
            >
              {tenantName}
            </div>
            {tenantSlug && (
              <div className="truncate text-xs" style={{ color: 'var(--text-muted)' }}>
                {tenantSlug}.app
              </div>
            )}
          </div>
          <svg
            viewBox="0 0 20 20"
            fill="currentColor"
            className="ml-auto h-4 w-4 flex-shrink-0"
            style={{ color: 'var(--text-muted)' }}
          >
            <path
              fillRule="evenodd"
              d="M5.293 7.293a1 1 0 0 1 1.414 0L10 10.586l3.293-3.293a1 1 0 1 1 1.414 1.414l-4 4a1 1 0 0 1-1.414 0l-4-4a1 1 0 0 1 0-1.414z"
              clipRule="evenodd"
            />
          </svg>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-0.5 p-3">
        <div className="mb-1 px-2 py-1.5">
          <span
            className="text-xs font-semibold uppercase tracking-wider"
            style={{ color: 'var(--text-muted)' }}
          >
            Main
          </span>
        </div>

        {navItems.map((item) => {
          const parentActive = isParentActive(item.href, item.sub);
          const hasSub = item.sub.length > 0;
          const expanded = hasSub && parentActive;

          return (
            <div key={item.href}>
              <Link
                href={item.href}
                className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${parentActive && !hasSub ? 'text-white' : 'hover:bg-bg-main'}`}
                style={
                  parentActive && !hasSub
                    ? { background: 'var(--brand-primary)' }
                    : parentActive && hasSub
                      ? { background: 'var(--bg-subtle)', color: 'var(--brand-primary)' }
                      : { color: 'var(--text-secondary)' }
                }
              >
                <span
                  style={
                    parentActive
                      ? { color: !hasSub ? '#fff' : 'var(--brand-primary)' }
                      : { color: 'var(--text-muted)' }
                  }
                >
                  {item.icon}
                </span>
                <span className="flex-1">{item.label}</span>
                {hasSub && (
                  <svg
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    className={`h-3.5 w-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`}
                    style={{ color: 'var(--text-muted)' }}
                  >
                    <path
                      fillRule="evenodd"
                      d="M5.293 7.293a1 1 0 0 1 1.414 0L10 10.586l3.293-3.293a1 1 0 1 1 1.414 1.414l-4 4a1 1 0 0 1-1.414 0l-4-4a1 1 0 0 1 0-1.414z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
              </Link>

              {/* Sub-items */}
              {expanded && (
                <div
                  className="ml-4 mt-0.5 space-y-0.5 border-l pl-3"
                  style={{ borderColor: 'var(--border-light)' }}
                >
                  {item.sub.map((sub) => {
                    const subActive = isSubActive(sub.href);
                    return (
                      <Link
                        key={sub.href}
                        href={sub.href}
                        className="hover:bg-bg-main flex items-center rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
                        style={
                          subActive
                            ? { color: 'var(--brand-primary)', fontWeight: 600 }
                            : { color: 'var(--text-secondary)' }
                        }
                      >
                        {sub.label}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {/* Admin section */}
        {isAdmin && (
          <>
            <div className="mb-1 mt-4 px-2 py-1.5">
              <span
                className="text-xs font-semibold uppercase tracking-wider"
                style={{ color: 'var(--text-muted)' }}
              >
                Admin
              </span>
            </div>
            {adminItems.map((item) => {
              const parentActive = isParentActive(item.href, item.sub);
              const expanded = parentActive;
              return (
                <div key={item.href}>
                  <Link
                    href={item.href}
                    className="hover:bg-bg-main flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium transition-all"
                    style={
                      parentActive
                        ? { background: 'rgba(176,108,255,0.1)', color: 'var(--brand-accent)' }
                        : { color: 'var(--text-secondary)' }
                    }
                  >
                    <span
                      style={
                        parentActive
                          ? { color: 'var(--brand-accent)' }
                          : { color: 'var(--text-muted)' }
                      }
                    >
                      {item.icon}
                    </span>
                    <span className="flex-1">{item.label}</span>
                    <svg
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      className={`h-3.5 w-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`}
                      style={{ color: 'var(--text-muted)' }}
                    >
                      <path
                        fillRule="evenodd"
                        d="M5.293 7.293a1 1 0 0 1 1.414 0L10 10.586l3.293-3.293a1 1 0 1 1 1.414 1.414l-4 4a1 1 0 0 1-1.414 0l-4-4a1 1 0 0 1 0-1.414z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </Link>
                  {expanded && (
                    <div
                      className="ml-4 mt-0.5 space-y-0.5 border-l pl-3"
                      style={{ borderColor: 'var(--border-light)' }}
                    >
                      {item.sub.map((sub) => {
                        const subActive = isSubActive(sub.href);
                        return (
                          <Link
                            key={sub.href}
                            href={sub.href}
                            className="hover:bg-bg-main flex items-center rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
                            style={
                              subActive
                                ? { color: 'var(--brand-accent)', fontWeight: 600 }
                                : { color: 'var(--text-secondary)' }
                            }
                          >
                            {sub.label}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </>
        )}
      </nav>

      {/* User footer */}
      <div className="flex-shrink-0 border-t p-3" style={{ borderColor: 'var(--border-light)' }}>
        <div className="hover:bg-bg-main flex cursor-pointer items-center gap-2.5 rounded-xl px-2 py-2 transition-colors">
          <div className="brand-gradient flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold text-white">
            U
          </div>
          <div className="min-w-0 flex-1">
            <div
              className="truncate text-xs font-semibold"
              style={{ color: 'var(--text-primary)' }}
            >
              My Account
            </div>
            <div className="truncate text-xs" style={{ color: 'var(--text-muted)' }}>
              View profile
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
