import type { Metadata } from 'next';
import { Inter } from 'next/font/google';

import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    template: '%s | riogentix',
    default: 'riogentix — Enterprise SaaS Platform',
  },
  description:
    'riogentix is the enterprise-grade multi-tenant SaaS platform built for scale. Manage your team, billing, and integrations in one place.',
  keywords: ['SaaS', 'enterprise', 'multi-tenant', 'platform', 'riogentix'],
  openGraph: {
    title: 'riogentix — Enterprise SaaS Platform',
    description: 'Enterprise-grade multi-tenant SaaS platform built for scale.',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="font-sans">{children}</body>
    </html>
  );
}
