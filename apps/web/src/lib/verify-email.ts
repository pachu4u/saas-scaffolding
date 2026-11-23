import { env } from '@platform/config';
import { adminDb } from '@platform/db';
import { enqueue, tenantProvisionQueue, type TenantProvisionJob } from '@platform/jobs';
import { sendEmail } from '@platform/notifications';

import { findKeycloakUserByEmail, markKeycloakEmailVerified } from '@/lib/keycloak-admin';

export type VerifyEmailResult =
  | { status: 'verified'; tenantSlug: string }
  | { status: 'awaiting-approval'; tenantSlug: string }
  | { status: 'already-verified'; tenantSlug: string }
  | { status: 'not-found' };

/**
 * Starts the tenant's stack provisioning. Idempotent per tenant via the
 * queue's idempotency key; a failed enqueue marks the tenant FAILED so an
 * admin can retry it from the tenant page.
 */
export async function startTenantProvisioning(tenantId: string): Promise<void> {
  await adminDb.tenant.update({
    where: { id: tenantId },
    data: { provisioningStatus: 'IN_PROGRESS' },
  });

  const provisionJob: TenantProvisionJob = { tenantId, environments: ['PROD'] };
  try {
    await enqueue(tenantProvisionQueue, provisionJob, {
      idempotencyKey: `tenant-provision:signup:${tenantId}`,
    });
  } catch (err) {
    console.warn('[provisioning] Failed to enqueue provisioning (non-fatal):', err);
    await adminDb.tenant.update({
      where: { id: tenantId },
      data: {
        provisioningStatus: 'FAILED',
        provisioningError: `Failed to enqueue provisioning: ${String(err)}`,
      },
    });
  }
}

/** Emails the platform admins that a verified signup is waiting for approval. */
async function notifyAdminsOfPendingSignup(tenant: {
  id: string;
  name: string;
  slug: string;
  email: string;
}): Promise<void> {
  const recipients = (env.PLATFORM_ADMIN_NOTIFY_EMAIL ?? '')
    .split(',')
    .map((e) => e.trim())
    .filter(Boolean);
  for (const to of recipients) {
    try {
      await sendEmail({
        to,
        subject: `New workspace awaiting approval: ${tenant.name}`,
        templateId: 'signup-pending-admin',
        data: {
          companyName: tenant.name,
          slug: tenant.slug,
          email: tenant.email,
          reviewUrl: `${env.AUTH_URL}/admin/tenants/${tenant.id}`,
        },
        tenantId: tenant.id,
      });
    } catch (err) {
      console.error('[verify-email] Failed to notify admins of pending signup:', err);
    }
  }
}

/**
 * Marks a signup's email as verified. For a workspace that still needs
 * platform-admin approval (status PENDING_APPROVAL) it stops there and tells
 * the admins; otherwise — only now — it kicks off tenant provisioning.
 * Idempotent: re-visiting the same link after the first successful
 * verification neither re-enqueues nor re-notifies.
 */
export async function verifyEmailAndProvision(
  userId: string,
  tenantId: string,
): Promise<VerifyEmailResult> {
  const [user, tenant] = await Promise.all([
    adminDb.user.findUnique({ where: { id: userId }, select: { email: true } }),
    adminDb.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, name: true, slug: true, status: true, provisioningStatus: true },
    }),
  ]);
  if (!user || !tenant || tenant.status === 'DELETED') return { status: 'not-found' };

  if (tenant.status === 'PENDING_APPROVAL') {
    const kcUser = await findKeycloakUserByEmail(user.email);
    if (kcUser && !kcUser.emailVerified) {
      await markKeycloakEmailVerified(kcUser.id);
      await notifyAdminsOfPendingSignup({ ...tenant, email: user.email });
    }
    return { status: 'awaiting-approval', tenantSlug: tenant.slug };
  }

  if (tenant.provisioningStatus !== 'PENDING') {
    // Already verified (or provisioning/provisioned/failed via some other
    // path) — don't re-enqueue.
    return { status: 'already-verified', tenantSlug: tenant.slug };
  }

  const kcUser = await findKeycloakUserByEmail(user.email);
  if (kcUser && !kcUser.emailVerified) {
    await markKeycloakEmailVerified(kcUser.id);
  }

  await startTenantProvisioning(tenantId);
  return { status: 'verified', tenantSlug: tenant.slug };
}
