import { auth } from '@platform/auth';
import { adminDb, type Prisma } from '@platform/db';
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

// Blank input should clear the field to null, not store an empty string —
// `??` wouldn't do that since '' is neither null nor undefined.
function trimmedOrNull(value: string | undefined): string | null {
  const trimmed = value?.trim();
  // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
  return trimmed ? trimmed : null;
}

const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

/**
 * GET /api/admin/connected-apps
 * Registry of every app the platform can hand identity to via SCIM, plus
 * how many tenants have it wired up and how many app-specific roles it owns.
 */
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isPlatformAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const apps = await adminDb.connectedApp.findMany({
    include: {
      _count: { select: { instances: true, roles: true } },
    },
    orderBy: { name: 'asc' },
  });

  return NextResponse.json(
    apps.map((app) => ({
      id: app.id,
      slug: app.slug,
      name: app.name,
      description: app.description,
      iconUrl: app.iconUrl,
      status: app.status,
      instanceCount: app._count.instances,
      roleCount: app._count.roles,
      createdAt: app.createdAt,
    })),
  );
}

/**
 * POST /api/admin/connected-apps
 * Body: { slug, name, description?, iconUrl?, docsUrl?, config? }
 * Registers a new connected app. Per-tenant SCIM instances (base URL + token)
 * are created separately, either through provisioning automation or the
 * app detail page, once this registry row exists.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isPlatformAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = (await req.json()) as {
    slug?: string;
    name?: string;
    description?: string;
    iconUrl?: string;
    docsUrl?: string;
    config?: Record<string, unknown>;
  };
  const { slug, name, description, iconUrl, docsUrl, config } = body;

  if (!slug?.trim() || !SLUG_PATTERN.test(slug.trim())) {
    return NextResponse.json(
      { error: 'slug is required and must be lowercase alphanumeric with hyphens' },
      { status: 422 },
    );
  }
  if (!name?.trim()) {
    return NextResponse.json({ error: 'name is required' }, { status: 422 });
  }

  const existing = await adminDb.connectedApp.findUnique({ where: { slug: slug.trim() } });
  if (existing) {
    return NextResponse.json({ error: 'An app with that slug already exists' }, { status: 409 });
  }

  const app = await adminDb.connectedApp.create({
    data: {
      slug: slug.trim(),
      name: name.trim(),
      description: trimmedOrNull(description),
      iconUrl: trimmedOrNull(iconUrl),
      docsUrl: trimmedOrNull(docsUrl),
      config: (config ?? {}) as Prisma.InputJsonValue,
    },
  });

  return NextResponse.json({ id: app.id, slug: app.slug, name: app.name }, { status: 201 });
}
