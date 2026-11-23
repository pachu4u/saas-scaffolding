import { env } from '@platform/config';
import { adminDb, withPlatformAdmin } from '@platform/db';
import { sendEmail } from '@platform/notifications';

import { deleteKeycloakUser, findKeycloakUserByEmail } from '@/lib/keycloak-admin';
import { startTenantProvisioning } from '@/lib/verify-email';

export type ApprovalOutcome =
  | { ok: true; status: 'ACTIVE'; provisioning: boolean }
  | { ok: true; status: 'DELETED' }
  | { ok: false; error: string; httpStatus: number };

/** The signup's applicant: the tenant's first member (its tenant_admin). */
async function applicantEmail(tenantId: string): Promise<string | null> {
  const tu = await adminDb.tenantUser.findFirst({
    where: { tenantId },
    orderBy: { joinedAt: 'asc' },
    select: { user: { select: { email: true } } },
  });
  return tu?.user.email ?? null;
}

async function audit(
  tenantId: string,
  actorUserId: string | null,
  action: string,
  before: unknown,
  after: unknown,
): Promise<void> {
  await withPlatformAdmin(async (tx) => {
    await tx.auditLog.create({
      data: {
        tenantId,
        actorUserId,
        action,
        resourceType: 'Tenant',
        resourceId: tenantId,
        before: before as object,
        after: after as object,
      },
    });
  });
}

/**
 * Approve a pending self-service signup. If the applicant has already
 * verified their email, provisioning starts now; otherwise it starts when
 * they click the verification link (the normal ACTIVE-tenant path).
 */
export async function approveTenant(
  tenantId: string,
  actorUserId: string | null,
): Promise<ApprovalOutcome> {
  const tenant = await adminDb.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) return { ok: false, error: 'Tenant not found', httpStatus: 404 };
  if (tenant.status !== 'PENDING_APPROVAL') {
    return {
      ok: false,
      error: `Tenant is ${tenant.status}, not pending approval`,
      httpStatus: 422,
    };
  }

  await adminDb.tenant.update({ where: { id: tenantId }, data: { status: 'ACTIVE' } });
  await audit(
    tenantId,
    actorUserId,
    'tenant.approved',
    { status: tenant.status },
    { status: 'ACTIVE' },
  );

  const email = await applicantEmail(tenantId);
  const kcUser = email ? await findKeycloakUserByEmail(email) : null;
  const verified = kcUser?.emailVerified === true;
  if (verified && tenant.provisioningStatus === 'PENDING') {
    await startTenantProvisioning(tenantId);
  }

  if (email) {
    try {
      await sendEmail({
        to: email,
        subject: `Your riogentix workspace ${tenant.name} is approved`,
        templateId: 'tenant-approved',
        data: {
          companyName: tenant.name,
          signInUrl: `${env.AUTH_URL}/auth/signin`,
          nextStep: verified
            ? "We're setting it up now; it's usually ready within a few minutes."
            : 'Verify your email with the link we sent you earlier, and we will set it up right away.',
        },
        tenantId,
      });
    } catch (err) {
      console.error('[tenant-approval] Failed to send approval email:', err);
    }
  }
  return { ok: true, status: 'ACTIVE', provisioning: verified };
}

/**
 * Reject a pending signup: the tenant is soft-deleted (kept for audit), the
 * applicant is told, and their login is removed unless they belong to
 * another live workspace.
 */
export async function rejectTenant(
  tenantId: string,
  actorUserId: string | null,
): Promise<ApprovalOutcome> {
  const tenant = await adminDb.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) return { ok: false, error: 'Tenant not found', httpStatus: 404 };
  if (tenant.status !== 'PENDING_APPROVAL') {
    return {
      ok: false,
      error: `Tenant is ${tenant.status}, not pending approval`,
      httpStatus: 422,
    };
  }

  await adminDb.tenant.update({ where: { id: tenantId }, data: { status: 'DELETED' } });
  await audit(
    tenantId,
    actorUserId,
    'tenant.rejected',
    { status: tenant.status },
    { status: 'DELETED' },
  );

  const email = await applicantEmail(tenantId);
  if (email) {
    const otherLive = await adminDb.tenantUser.count({
      where: {
        user: { email },
        tenantId: { not: tenantId },
        tenant: { status: { in: ['ACTIVE', 'SUSPENDED', 'PENDING_APPROVAL'] } },
      },
    });
    if (otherLive === 0) {
      const kcUser = await findKeycloakUserByEmail(email).catch(() => null);
      if (kcUser) await deleteKeycloakUser(kcUser.id);
    }
    try {
      await sendEmail({
        to: email,
        subject: `Your riogentix workspace request`,
        templateId: 'tenant-rejected',
        data: { companyName: tenant.name },
        tenantId,
      });
    } catch (err) {
      console.error('[tenant-approval] Failed to send rejection email:', err);
    }
  }
  return { ok: true, status: 'DELETED' };
}
