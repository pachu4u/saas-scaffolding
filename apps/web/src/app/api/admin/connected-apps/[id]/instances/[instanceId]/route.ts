import { auth } from '@platform/auth';
import { adminDb } from '@platform/db';
import { type NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

function isPlatformAdmin(session: { groups?: unknown }): boolean {
  return (
    Array.isArray(session.groups) &&
    (session.groups as string[]).some((g) =>
      ['platform_super_admin', 'platform_support'].includes(g),
    )
  );
}

async function loadInstance(appId: string, instanceId: string) {
  const instance = await adminDb.connectedAppInstance.findUnique({ where: { id: instanceId } });
  if (instance?.appId !== appId) return null;
  return instance;
}

/**
 * PATCH /api/admin/connected-apps/[id]/instances/[instanceId]
 * Body: partial { scimBaseUrl, scimToken, status }
 * An omitted or blank scimToken leaves the stored token untouched — the
 * table never echoes it back, so there'd be nothing for the form to submit.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; instanceId: string }> },
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isPlatformAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id: appId, instanceId } = await params;
  const existing = await loadInstance(appId, instanceId);
  if (!existing) return NextResponse.json({ error: 'Instance not found' }, { status: 404 });

  const body = (await req.json()) as {
    scimBaseUrl?: string;
    scimToken?: string;
    status?: 'ACTIVE' | 'PAUSED' | 'DISABLED';
  };

  if (body.scimBaseUrl !== undefined && !body.scimBaseUrl.trim()) {
    return NextResponse.json({ error: 'scimBaseUrl cannot be empty' }, { status: 422 });
  }

  const instance = await adminDb.connectedAppInstance.update({
    where: { id: instanceId },
    data: {
      ...(body.scimBaseUrl !== undefined && { scimBaseUrl: body.scimBaseUrl.trim() }),
      ...(body.scimToken?.trim() && { scimToken: body.scimToken.trim() }),
      ...(body.status !== undefined && { status: body.status }),
    },
  });

  return NextResponse.json({
    id: instance.id,
    tenantId: instance.tenantId,
    scimBaseUrl: instance.scimBaseUrl,
    status: instance.status,
    lastSyncedAt: instance.lastSyncedAt,
    lastSyncError: instance.lastSyncError,
  });
}

/**
 * DELETE /api/admin/connected-apps/[id]/instances/[instanceId]
 * Disconnects a tenant from this app. Stops sync going forward but does not
 * touch anything already pushed to the app itself.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; instanceId: string }> },
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isPlatformAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id: appId, instanceId } = await params;
  const existing = await loadInstance(appId, instanceId);
  if (!existing) return NextResponse.json({ error: 'Instance not found' }, { status: 404 });

  await adminDb.connectedAppInstance.delete({ where: { id: instanceId } });
  return new NextResponse(null, { status: 204 });
}
