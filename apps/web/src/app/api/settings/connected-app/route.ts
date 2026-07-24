import { Permission, withAuthz } from '@platform/authz';
import { adminDb } from '@platform/db';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

/**
 * PATCH /api/settings/connected-app
 * Updates the SCIM endpoint for the caller's own tenant's connected-app
 * instance. Body: { scimBaseUrl?: string; scimToken?: string }. An omitted
 * or blank scimToken leaves the stored token untouched — the page never
 * echoes it back, so there'd be nothing for the form to submit. Requires
 * SCIM_MANAGE (granted to tenant_admin by default).
 */
export const PATCH = withAuthz({ permission: Permission.SCIM_MANAGE }, async (req, { authz }) => {
  const body = (await req.json()) as { scimBaseUrl?: string; scimToken?: string };

  const existing = await adminDb.connectedAppInstance.findFirst({
    where: { tenantId: authz.tenantId },
  });
  if (!existing) {
    return NextResponse.json({ error: 'No connected app for this workspace' }, { status: 404 });
  }

  if (body.scimBaseUrl !== undefined && !body.scimBaseUrl.trim()) {
    return NextResponse.json({ error: 'scimBaseUrl cannot be empty' }, { status: 422 });
  }

  const instance = await adminDb.connectedAppInstance.update({
    where: { id: existing.id },
    data: {
      ...(body.scimBaseUrl !== undefined && { scimBaseUrl: body.scimBaseUrl.trim() }),
      ...(body.scimToken?.trim() && { scimToken: body.scimToken.trim() }),
    },
  });

  await adminDb.auditLog.create({
    data: {
      tenantId: authz.tenantId,
      actorUserId: authz.user.id,
      action: 'connected_app_instance.updated',
      resourceType: 'ConnectedAppInstance',
      resourceId: instance.id,
      before: { scimBaseUrl: existing.scimBaseUrl },
      after: {
        scimBaseUrl: instance.scimBaseUrl,
        scimTokenRotated: Boolean(body.scimToken?.trim()),
      },
    },
  });

  return NextResponse.json({
    id: instance.id,
    scimBaseUrl: instance.scimBaseUrl,
    status: instance.status,
    lastSyncedAt: instance.lastSyncedAt,
    lastSyncError: instance.lastSyncError,
  });
});
