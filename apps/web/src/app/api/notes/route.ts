import { type NextRequest, NextResponse } from 'next/server';

import { withTenant } from '@platform/db';
import { Permission, withAuthz, isOwnerPolicy } from '@platform/authz';
import { getTenantFromRequest } from '../../../lib/server-tenant';

export async function GET(req: NextRequest) {
  const tenant = await getTenantFromRequest(req);
  if (!tenant) {
    return NextResponse.json({ error: 'No tenant' }, { status: 404 });
  }

  const notes = await withTenant(tenant.tenantId, (tx) =>
    tx.note.findMany({
      orderBy: { createdAt: 'desc' },
      select: { id: true, body: true, createdAt: true },
    }),
  );

  return NextResponse.json(notes);
}

export const POST = withAuthz(
  { permission: Permission.NOTES_CREATE },
  async (req, { authz }) => {
    const { body } = (await req.json()) as { body?: string };
    if (!body?.trim()) {
      return NextResponse.json({ error: 'body is required' }, { status: 422 });
    }

    const note = await withTenant(authz.tenantId, (tx) =>
      tx.note.create({
        data: { tenantId: authz.tenantId, body: body.trim(), userId: authz.user.id },
        select: { id: true, body: true, createdAt: true },
      }),
    );

    return NextResponse.json(note, { status: 201 });
  },
);

export const DELETE = withAuthz(
  { permission: Permission.NOTES_DELETE, entitlement: 'notes.delete' },
  async (req, { authz }) => {
    const id = req.nextUrl.searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 422 });
    }

    const note = await withTenant(authz.tenantId, (tx) =>
      tx.note.findUnique({ where: { id }, select: { userId: true } }),
    );
    if (!note) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    if (!isOwnerPolicy(authz, note.userId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await withTenant(authz.tenantId, (tx) => tx.note.delete({ where: { id } }));
    return new NextResponse(null, { status: 204 });
  },
);
