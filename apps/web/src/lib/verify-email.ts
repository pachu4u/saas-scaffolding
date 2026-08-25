import { adminDb } from '@platform/db';
import { enqueue, tenantProvisionQueue, type TenantProvisionJob } from '@platform/jobs';

import { findUserIdByEmail, markKeycloakEmailVerified } from '@/lib/keycloak-admin';

export type VerifyEmailResult =
  | { status: 'verified'; tenantSlug: string }
  | { status: 'already-verified'; tenantSlug: string }
  | { status: 'not-found' };

/**
 * Marks a signup's email as verified and — only now — kicks off tenant
 * provisioning. Idempotent: re-visiting the same link (or a slow double
 * click) after the first successful verification is a no-op, not a second
 * provisioning job.
 */
export async function verifyEmailAndProvision(
  userId: string,
  tenantId: string,
): Promise<VerifyEmailResult> {
  const [user, tenant] = await Promise.all([
    adminDb.user.findUnique({ where: { id: userId }, select: { email: true } }),
    adminDb.tenant.findUnique({
      where: { id: tenantId },
      select: { slug: true, provisioningStatus: true },
    }),
  ]);
  if (!user || !tenant) return { status: 'not-found' };

  if (tenant.provisioningStatus !== 'PENDING') {
    // Already verified (or provisioning/provisioned/failed via some other
    // path) — don't re-enqueue.
    return { status: 'already-verified', tenantSlug: tenant.slug };
  }

  const kcUserId = await findUserIdByEmail(user.email);
  if (kcUserId) {
    await markKeycloakEmailVerified(kcUserId);
  }

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
    console.warn('[verify-email] Failed to enqueue provisioning (non-fatal):', err);
    await adminDb.tenant.update({
      where: { id: tenantId },
      data: {
        provisioningStatus: 'FAILED',
        provisioningError: `Failed to enqueue provisioning: ${String(err)}`,
      },
    });
  }

  return { status: 'verified', tenantSlug: tenant.slug };
}
