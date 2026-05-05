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
      className="flex items-center gap-0.5 overflow-x-auto px-4"
      style={{ background: 'var(--bg-white)', borderBottom: '1px solid var(--border-light)' }}
    >
      {items.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className="relative -mb-px flex items-center gap-1.5 whitespace-nowrap px-3 py-3 text-xs font-semibold transition-colors"
            style={{
              color: active ? 'var(--brand-primary)' : 'var(--text-secondary)',
            }}
          >
            {item.icon}
            {item.label}
            {active && (
              <span
                className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t"
                style={