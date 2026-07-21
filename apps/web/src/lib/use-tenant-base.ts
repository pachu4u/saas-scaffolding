'use client';

import { usePathname } from 'next/navigation';

// Internal /t tree segments that are never tenant slugs (mirrors the RESERVED
// set in middleware.ts for the labels that can appear right after /t/).
const INTERNAL_SEGMENTS = new Set(['admin', 'app']);

/**
 * Base path of the tenant dashboard the user is currently on, e.g. "/t/acme"
 * when the browser URL is /t/acme/admin/notes. Returns '' outside a tenant
 * path (e.g. the platform admin console), so `base + '/admin'` degrades to
 * the plain path.
 */
export function useTenantBase(): string {
  const pathname = usePathname();
  const m = /^\/t\/([a-z0-9-]+)(?=\/|$)/.exec(pathname);
  if (!m?.[1] || INTERNAL_SEGMENTS.has(m[1])) return '';
  return `/t/${m[1]}`;
}
