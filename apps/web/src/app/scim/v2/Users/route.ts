import {
  authenticateScim,
  scimGetUsers,
  scimCreateUser,
  toScimUser,
  SCIM_SCHEMAS,
} from '@platform/scim';
import { type NextRequest, NextResponse } from 'next/server';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.lvh.me';

export async function GET(req: NextRequest) {
  const ctx = await authenticateScim(req);
  if (!ctx) return scimError(401, 'Unauthorized');

  const { searchParams } = req.nextUrl;
  const startIndex = Number(searchParams.get('startIndex') ?? '1');
  const count = Math.min(Number(searchParams.get('count') ?? '100'), 200);

  const { users, total } = await scimGetUsers(ctx.tenantId, { startIndex, count });
  const scimUrl = BASE_URL.replace('app.', `${req.headers.get('x-tenant-slug') ?? ''}.`);

  return NextResponse.json({
    schemas: [SCIM_SCHEMAS.LIST],
    totalResults: total,
    itemsPerPage: count,
    startIndex,
    Resources: users.map((u) => toScimUser(u, scimUrl)),
  });
}

export async function POST(req: NextRequest) {
  const ctx = await authenticateScim(req);
  if (!ctx) return scimError(401, 'Unauthorized');

  const body = (await req.json()) as Record<string, unknown>;
  const userName = body.userName as string | undefined;
  if (!userName) return scimError(400, 'userName is required', 'invalidValue');

  const scimUrl = BASE_URL.replace('app.', `${req.headers.get('x-tenant-slug') ?? ''}.`);

  const user = await scimCreateUser(ctx.tenantId, {
    userName,
    ...(body.externalId ? { externalId: body.externalId as string } : {}),
    ...(body.name ? { name: body.name } : {}),
  });

  return NextResponse.json(toScimUser(user, scimUrl), { status: 201 });
}

function scimError(status: number, detail: string, scimType?: string) {
  return NextResponse.json(
    { schemas: [SCIM_SCHEMAS.ERROR], status, detail, ...(scimType ? { scimType } : {}) },
    { status },
  );
}
