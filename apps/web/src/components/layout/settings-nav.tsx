'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { useTenantBase } from '@/lib/use-tenant-base';

interface SettingsNavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  description?: string;
}

export function SettingsNav({ items }: { items: SettingsNavItem[] }) {
  const pathname = usePathname();
  const base = useTenantBase();

  return (
    <nav className="w-full space-y-0.5 lg:w-56">
      {items.map((item) => {
        const href = `${base}${item.href}`;
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            className="group flex items-start gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors"
            style={{
              background: active ? 'var(--bg-subtle)' : 'transparent',
              color: active ? 'var(--brand-primary)' : 'var(--text-secondary)',
            }}
          >
            <span
              className="mt-0.5 flex-shrink-0"
              style={{ color: active ? 'var(--brand-primary)' : 'var(--text-muted)' }}
            >
              {item.icon}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate">{item.label}</span>
              {item.description && (
                <span
                  className="mt-0.5 block truncate text-[11px] font-normal"
                  style={{ color: 'var(--text-muted)' }}
                >
                  {item.description}
                </span>
              )}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
