import { resolveTenant } from '@platform/tenant';
import type { NextRequest } from 'next/server';

export async function getTenantFromRequest(req: NextRequest) {
  const slug = req.headers.get('x-tenant-slug');
  if (!slug) return null;
  return resolveTenant(slug);
}
