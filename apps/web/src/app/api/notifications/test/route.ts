import { type NextRequest, NextResponse } from 'next/server';

import { auth } from '@platform/auth';
import { adminDb } from '@platform/db';
import { sendEmail } from '@platform/notifications';
import { resolveTenant } from '@platform/tenant';

export const runtime = 'nodejs';

/**
 * POST /api/notifications/test
 * Sends a test email to the signed-in user using the workspace's current
 * branding (from name / reply-to), so admins can verify email delivery
 * without waiting for a real notification to fire.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const tenantSlug = req.headers.get('x-tenant-slug');
  if (!tenantSlug) return NextResponse.json({ error: 'No tenant context' }, { status: 400 });

  const tenantCtx = await resolveTenant(tenantSlug);
  if (!tenantCtx) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

  const tenant = await adminDb.tenant.findUnique({
    where: { id: tenantCtx.tenantId },
    select: { name: true, branding: true },
  });
  if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

  const branding = (tenant.branding ?? {}) as Record<string, unknown>;

  await sendEmail({
    to: session.user.email,
    subject: `Test email from ${tenant.name}`,
    templateId: 'test-email',
    tenantId: tenantCtx.tenantId,
    data: {
      emailFrom: (branding.emailFrom as string | undefined) ?? tenant.name,
      emailReply: (branding.emailReply as string | undefined) ?? '',
      recipient: session.user.email,
    },
  });

  await adminDb.auditLog.create({
    data: {
      tenantId: tenantCtx.tenantId,
      actorUserId: session.user.id,
      action: 'settings.branding.test_email_sent',
      resourceType: 'Tenant',
      resourceId: tenantCtx.tenantId,
    },
  });

  return NextResponse.json({ ok: true });
}
