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

/**
 * POST /api/admin/connected-apps/[id]/instances
 * Body: { tenantId: string; scimBaseUrl: string; scimToken: string }
 * Manually wires a tenant to this app's SCIM endpoint. Only the `shared`
 * Riogentix driver creates these rows automatically during provisioning —
 * every other connected app needs this until it gets its own provisioning
 * automation, since the dispatcher (apps/workers/src/handlers/
 * app-sync-targets.ts) is app-agnostic and just reads whatever instance
 * rows exist.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isPlatformAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id: appId } = await params;
  const app = await adminDb.connectedApp.findUnique({ where: { id: appId } });
  if (!app) return NextResponse.json({ error: 'App not found' }, { status: 404 });

  const body = (await req.json()) as {
    tenantId?: string;
    scimBaseUrl?: string;
    scimToken?: string;
  };
  const { tenantId, scimBaseUrl, scimToken } = body;

  if (!tenantId?.trim()) {
    return NextResponse.json({ error: 'tenantId is required' }, { status: 422 });
  }
  if (!scimBaseUrl?.trim()) {
    return NextResponse.json({ error: 'scimBaseUrl is required' }, { status: 422 });
  }
  if (!scimToken?.trim()) {
    return NextResponse.json({ error: 'scimToken is required' }, { status: 422 });
  }

  const tenant = await adminDb.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

  try {
    const instance = await adminDb.connectedAppInstance.create({
      data: {
        appId,
        tenantId,
        scimBaseUrl: scimBaseUrl.trim(),
        scimToken: scimToken.trim(),
      },
    });

    return NextResponse.json(
      {
        id: instance.id,
        tenantId: instance.tenantId,
        tenantName: tenant.name,
        tenantSlug: tenant.slug,
        scimBaseUrl: instance.scimBaseUrl,
        status: instance.status,
        lastSyncedAt: instance.lastSyncedAt,
        lastSyncError: instance.lastSyncError,
      },
      { status: 201 },
    );
  } catch (err: unknown) {
    const code = (err as { code?: string }).code;
    if (code === 'P2002') {
      return NextResponse.json(
        { error: 'This tenant is already connected to this app' },
        { status: 409 },
      );
    }
    console.error('[POST /api/admin/connected-apps/[id]/instances]', err);
    return NextResponse.json({ error: 'Failed to create instance' }, { status: 500 });
  }
}
