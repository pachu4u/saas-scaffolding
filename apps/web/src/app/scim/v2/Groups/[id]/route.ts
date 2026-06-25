import {
  authenticateScim,
  SCIM_SCHEMAS,
  scimDeleteGroup,
  scimGetGroup,
  scimPatchGroup,
  toScimGroup,
  type ScimPatchOp,
} from '@platform/scim';
import { type NextRequest, NextResponse } from 'next/server';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.lvh.me';

interface Params {
  params: Promise<{ id: string }>;
}

function scimError(status: number, detail: string, scimType?: string) {
  return NextResponse.json(
    { schemas: [SCIM_SCHEMAS.ERROR], status, detail, ...(scimType ? { scimType } : {}) },
    { status },
  );
}

/**
 * GET /scim/v2/Groups/:id
 */
export async function GET(req: NextRequest, { params }: Params) {
  const ctx = await authenticateScim(req);
  if (!ctx) return scimError(401, 'Unauthorized');

  const { id } = await params;
  const tenantSlug = req.headers.get('x-tenant-slug') ?? 'app';
  const scimBase = BASE_URL.replace('app.', `${tenantSlug}.`);

  const role = await scimGetGroup(ctx.tenantId, id);
  if (!role) return scimError(404, `Group ${id} not found`);

  return NextResponse.json(toScimGroup(role, scimBase));
}

/**
 * PUT /scim/v2/Groups/:id
 * Full replace (members list is replaced entirely).
 */
export async function PUT(req: NextRequest, { params }: Params) {
  const ctx = await authenticateScim(req);
  if (!ctx) return scimError(401, 'Unauthorized');

  const { id } = await params;
  const tenantSlug = req.headers.get('x-tenant-slug') ?? 'app';
  const scimBase = BASE_URL.replace('app.', `${tenantSlug}.`);

  const body = (await req.json()) as Record<string, unknown>;
  const displayName = body.displayName as string | undefined;
  const members = (body.members as { value: string }[] | undefined) ?? [];

  const existing = await scimGetGroup(ctx.tenantId, id);
  if (!existing) return scimError(404, `Group ${id} not found`);

  // Use PATCH machinery with a replace-all operation
  const patchOp: ScimPatchOp = {
    schemas: [SCIM_SCHEMAS.PATCH],
    Operations: [
      ...(displayName ? [{ op: 'replace' as const, value: { displayName } }] : []),
      { op: 'replace' as const, path: 'members', value: members },
    ],
  };

  const updated = await scimPatchGroup(ctx.tenantId, id, patchOp, ctx.tokenId);
  if (!updated) return scimError(500, 'Failed to update group');

  return NextResponse.json(toScimGroup(updated, scimBase));
}

/**
 * PATCH /scim/v2/Groups/:id
 * Partial update — add/remove/replace members or displayName.
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  const ctx = await authenticateScim(req);
  if (!ctx) return scimError(401, 'Unauthorized');

  const { id } = await params;
  const tenantSlug = req.headers.get('x-tenant-slug') ?? 'app';
  const scimBase = BASE_URL.replace('app.', `${tenantSlug}.`);

  const existing = await scimGetGroup(ctx.tenantId, id);
  if (!existing) return scimError(404, `Group ${id} not found`);

  const body = (await req.json()) as Partial<ScimPatchOp>;

  if (!body.schemas?.includes(SCIM_SCHEMAS.PATCH) || !Array.isArray(body.Operations)) {
    return scimError(400, 'Invalid PatchOp', 'invalidSyntax');
  }

  // Validated above: schemas includes PATCH and Operations is an array.
  const updated = await scimPatchGroup(ctx.tenantId, id, body as ScimPatchOp, ctx.tokenId);
  if (!updated) return scimError(500, 'Failed to patch group');

  return NextResponse.json(toScimGroup(updated, scimBase));
}

/**
 * DELETE /scim/v2/Groups/:id
 */
export async function DELETE(req: NextRequest, { params }: Params) {
  const ctx = await authenticateScim(req);
  if (!ctx) return scimError(401, 'Unauthorized');

  const { id } = await params;

  const existing = await scimGetGroup(ctx.tenantId, id);
  if (!existing) return scimError(404, `Group ${id} not found`);

  await scimDeleteGroup(ctx.tenantId, id, ctx.tokenId);

  return new NextResponse(null, { status: 204 });
}
