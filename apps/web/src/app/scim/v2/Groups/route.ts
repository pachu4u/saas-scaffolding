import { type NextRequest, NextResponse } from 'next/server';

import {
  authenticateScim,
  SCIM_SCHEMAS,
  scimCreateGroup,
  scimGetGroups,
  toScimGroup,
} from '@platform/scim';

const BASE_URL = process.env['NEXT_PUBLIC_APP_URL'] ?? 'https://app.lvh.me';

function scimError(status: number, detail: string, scimType?: string) {
  return NextResponse.json(
    { schemas: [SCIM_SCHEMAS.ERROR], status, detail, ...(scimType ? { scimType } : {}) },
    { status },
  );
}

/**
 * GET /scim/v2/Groups
 * List all groups (roles) for the authenticated tenant.
 */
export async function GET(req: NextRequest) {
  const ctx = await authenticateScim(req);
  if (!ctx) return scimError(401, 'Unauthorized');

  const { searchParams } = req.nextUrl;
  const startIndex = Math.max(1, Number(searchParams.get('startIndex') ?? '1'));
  const count = Math.min(Number(searchParams.get('count') ?? '100'), 200);

  const tenantSlug = req.headers.get('x-tenant-slug') ?? 'app';
  const scimBase = BASE_URL.replace('app.', `${tenantSlug}.`);

  const { roles, total } = await scimGetGroups(ctx.tenantId, { startIndex, count });

  return NextResponse.json({
    schemas: [SCIM_SCHEMAS.LIST],
    totalResults: total,
    itemsPerPage: count,
    startIndex,
    Resources: roles.map((r) => toScimGroup(r, scimBase)),
  } satisfies {
    schemas: string[];
    totalResults: number;
    itemsPerPage: number;
    startIndex: number;
    Resources: ReturnType<typeof toScimGroup>[];
  });
}

/**
 * POST /scim/v2/Groups
 * Create a new group (role) for the tenant.
 */
export async function POST(req: NextRequest) {
  const ctx = await authenticateScim(req);
  if (!ctx) return scimError(401, 'Unauthorized');

  const body = (await req.json()) as Record<string, unknown>;
  const displayName = body['displayName'] as string | undefined;

  if (!displayName || typeof displayName !== 'string') {
    return scimError(400, 'displayName is required', 'invalidValue');
  }

  const members = (body['members'] as Array<{ value: string }> | undefined) ?? [];
  const tenantSlug = req.headers.get('x-tenant-slug') ?? 'app';
  const scimBase = BASE_URL.replace('app.', `${tenantSlug}.`);

  const role = await scimCreateGroup(ctx.tenantId, { displayName, members }, ctx.tokenId);

  if (!role) return scimError(500, 'Failed to create group');

  return NextResponse.json(toScimGroup(role, scimBase), { status: 201 });
}
