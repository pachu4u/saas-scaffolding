import { NextResponse, type NextRequest } from 'next/server';

import { acceptInvite } from '@/lib/accept-invite';
import { decodeInviteToken } from '@/lib/invite-token';

/**
 * POST /api/team/invite/[token]/accept
 *
 * Validates the invite token and activates the TenantUser membership.
 */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const { tenantId, userId } = decodeInviteToken(token);

  if (!tenantId || !userId) {
    return NextResponse.json({ error: 'Invalid or expired invite link' }, { status: 400 });
  }

  const result = await acceptInvite(tenantId, userId);
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json(result);
}
