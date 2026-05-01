import { type NextRequest } from 'next/server';
import { resolveTenant } from '@platform/tenant';

export async function getTenantFromRequest(req: NextRequest) {
  const slug = req.headers.get('x-tenant-slug');
  if (!slug) return null;
  return resolveTenant(slug);
}
