'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface InnerNavItem {
  label: string;
  href: string;
  icon?: React.ReactNode;
}

interface InnerNavProps {
  items: InnerNavItem[];
}

export function InnerNav({ items }: InnerNavProps) {
  const pathname = usePathname();

  return (
    <div
      className="flex items-center gap-1 overflow-x-auto border-b px-6"
      style={{ borderColor: 'var(--border-light)' }}
    >
      {items.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`-mb-px flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-3 text-sm font-semibold transition-colors`}
            style={{
              borderColor: active ? 'var(--brand-primary)' : 'transparent',
              color: active ? 'var(--brand-primary)' : 'var(--text-secondary)',
            }}
          >
            {item.icon}
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}
