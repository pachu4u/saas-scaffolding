import Link from 'next/link';
import type { ReactNode } from 'react';

import { LEGAL, isPlaceholder } from '@/lib/legal';

/** Renders a legal detail; placeholders get a loud highlight so they get filled in. */
export function V({ children }: { children: string | null }) {
  if (children === null) return null;
  if (isPlaceholder(children)) {
    return (
      <mark
        className="rounded px-1 font-mono text-[0.85em]"
        style={{ background: '#FFF3BF', color: '#8A5A00' }}
      >
        {children}
      </mark>
    );
  }
  return <>{children}</>;
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="mb-3 text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
        {title}
      </h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

export function LegalFooterLinks({ className = '' }: { className?: string }) {
  return (
    <nav
      className={`flex flex-wrap items-center gap-x-4 gap-y-2 md:gap-x-6 ${className}`}
      aria-label="Legal"
    >
      {[
        { href: '/impressum', label: 'Impressum' },
        { href: '/privacy', label: 'Privacy' },
        { href: '/terms', label: 'Terms' },
      ].map((l) => (
        <Link
          key={l.href}
          href={l.href}
          className="hover:text-brand-primary text-sm transition-colors"
          style={{ color: 'var(--text-muted)' }}
        >
          {l.label}
        </Link>
      ))}
    </nav>
  );
}

export function LegalPage({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-main)' }}>
      <header
        className="border-b px-6 py-4"
        style={{ borderColor: 'var(--border-light)', background: 'var(--bg-white)' }}
      >
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="brand-gradient flex h-6 w-6 items-center justify-center rounded-md text-xs font-bold text-white">
              R
            </div>
            <span className="font-bold" style={{ color: 'var(--text-primary)' }}>
              {LEGAL.productName}
            </span>
          </Link>
          <LegalFooterLinks />
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-12">
        <article
          className="rounded-2xl border p-8 text-sm leading-relaxed md:p-12"
          style={{
            borderColor: 'var(--border-light)',
            background: 'var(--bg-white)',
            color: 'var(--text-secondary)',
          }}
        >
          <h1 className="text-3xl font-extrabold" style={{ color: 'var(--text-primary)' }}>
            {title}
          </h1>
          {subtitle && <p className="mt-2 text-base">{subtitle}</p>}
          <p className="mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>
            Last updated: {LEGAL.lastUpdated}
          </p>
          {children}
        </article>
      </main>

      <footer className="px-6 pb-12">
        <div
          className="mx-auto flex max-w-3xl flex-col items-center justify-between gap-4 md:flex-row"
          style={{ color: 'var(--text-muted)' }}
        >
          <p className="text-sm">
            © {new Date().getFullYear()} <V>{LEGAL.companyName}</V>
          </p>
          <LegalFooterLinks />
        </div>
      </footer>
    </div>
  );
}
