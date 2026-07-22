import crypto from 'crypto';

import { env } from '@platform/config';
import { adminDb, appendSyncOutbox, withPlatformAdmin } from '@platform/db';
import { enqueue, tenantProvisionQueue, type TenantProvisionJob } from '@platform/jobs';
import { type NextRequest, NextResponse } from 'next/server';

import { getKeycloakAdminToken } from '@/lib/keycloak-admin';

export const runtime = 'nodejs';

interface SignupBody {
  companyName?: string;
  slug?: string;
  adminEmail?: string;
  adminPassword?: string;
  adminName?: string;
  plan?: string;
  primaryColor?: string;
  timezone?: string;
}

async function createKeycloakUser(
  token: string,
  email: string,
  password: string,
  name: string,
): Promise<string> {
  const kcUrl = env.KEYCLOAK_INTERNAL_URL ?? env.KEYCLOAK_ISSUER.replace(/\/realms\/.*$/, '');
  const realm = env.KEYCLOAK_REALM;

  const [firstName, ...rest] = name.trim().split(' ');
  const lastName = rest.join(' ') || firstName;

  const res = await fetch(`${kcUrl}/admin/realms/${realm}/users`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      username: email.toLowerCase(),
      email: email.toLowerCase(),
      firstName: firstName ?? '',
      lastName,
      enabled: true,
      emailVerified: true,
      credentials: [{ type: 'password', value: password, temporary: false }],
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Keycloak user creation failed (${String(res.status)}): ${text}`);
  }

  // 201 Location header: .../admin/realms/{realm}/users/{userId}
  const location = res.headers.get('Location') ?? '';
  const kcUserId = location.split('/').pop();
  if (!kcUserId)
    throw new Error('Keycloak user created but could not extract user ID from Location header');
  return kcUserId;
}

async function deleteKeycloakUser(token: string, kcUserId: string): Promise<void> {
  const kcUrl = env.KEYCLOAK_INTERNAL_URL ?? env.KEYCLOAK_ISSUER.replace(/\/realms\/.*$/, '');
  const realm = env.KEYCLOAK_REALM;

  await fetch(`${kcUrl}/admin/realms/${realm}/users/${kcUserId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  }).catch(() => undefined);
}

/**
 * POST /api/signup
 * Public endpoint — no auth required.
 * Creates a tenant, Keycloak user, DB user, TenantUser, role binding, and provisions Riogentix.
 */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as SignupBody;
  const {
    companyName,
    slug,
    adminEmail,
    adminPassword,
    adminName = '',
    plan = 'free',
    primaryColor,
    timezone,
  } = body;

  if (!companyName?.trim() || !slug?.trim() || !adminEmail?.trim() || !adminPassword?.trim()) {
    return NextResponse.json(
      { error: 'companyName, slug, adminEmail, and adminPassword are required' },
      { status: 400 },
    );
  }

  if (!/^[a-z0-9-]{2,63}$/.test(slug.trim())) {
    return NextResponse.json(
      { error: 'Slug must be 2–63 lowercase letters, numbers, or hyphens' },
      { status: 400 },
    );
  }

  if (adminPassword.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
  }

  const emailNorm = adminEmail.trim().toLowerCase();
  const slugNorm = slug.trim().toLowerCase();

  // Check slug uniqueness up front
  const existing = await adminDb.tenant.findUnique({ where: { slug: slugNorm } });
  if (existing) {
    return NextResponse.json({ error: 'That slug is already taken' }, { status: 409 });
  }

  let kcToken: string;
  try {
    kcToken = await getKeycloakAdminToken();
  } catch (err) {
    console.error('[POST /api/signup] Keycloak admin token error:', err);
    return NextResponse.json(
      { error: 'Could not connect to identity provider. Please try again later.' },
      { status: 503 },
    );
  }

  let kcUserId: string;
  try {
    kcUserId = await createKeycloakUser(kcToken, emailNorm, adminPassword, adminName || emailNorm);
  } catch (err) {
    const msg = String(err);
    if (msg.includes('409') || msg.toLowerCase().includes('conflict')) {
      return NextResponse.json(
        { error: 'An account with that email already exists. Please sign in instead.' },
        { status: 409 },
      );
    }
    console.error('[POST /api/signup] Keycloak user creation error:', err);
    return NextResponse.json(
      { error: 'Failed to create account. Please try again.' },
      { status: 500 },
    );
  }

  try {
    const result = await withPlatformAdmin(async (tx) => {
      // Create tenant
      const branding: Record<string, string> = {};
      if (primaryColor) branding.primaryColor = primaryColor;
      if (timezone) branding.timezone = timezone;

      const tenant = await tx.tenant.create({
        data: {
          name: companyName.trim(),
          slug: slugNorm,
          plan,
          status: 'ACTIVE' as const,
          provisioningStatus: 'IN_PROGRESS' as const,
          customDomains: [],
          branding,
        },
        select: { id: true, slug: true, name: true },
      });

      // Create or fetch DB user record
      // externalId will be overwritten on first real SSO login
      const pendingExternalId = `pending-${crypto.randomUUID()}`;
      let dbUser = await tx.user.findUnique({ where: { email: emailNorm } });
      dbUser ??= await tx.user.create({
        data: {
          email: emailNorm,
          externalId: pendingExternalId,
          name: adminName || emailNorm,
        },
      });

      // Add as active tenant member
      await tx.tenantUser.upsert({
        where: { tenantId_userId: { tenantId: tenant.id, userId: dbUser.id } },
        create: { tenantId: tenant.id, userId: dbUser.id, status: 'ACTIVE' },
        update: { status: 'ACTIVE' },
      });

      // Assign tenant_admin role
      const adminRole = await tx.role.findFirst({ where: { name: 'tenant_admin' } });
      if (adminRole) {
        await tx.roleBinding.upsert({
          where: {
            tenantId_userId_roleId: {
              tenantId: tenant.id,
              userId: dbUser.id,
              roleId: adminRole.id,
            },
          },
          create: { tenantId: tenant.id, userId: dbUser.id, roleId: adminRole.id },
          update: {},
        });
      }

      await appendSyncOutbox(tx, tenant.id, [
        { resourceType: 'TENANT', resourceId: tenant.id },
        { resourceType: 'USER', resourceId: dbUser.id },
        ...(adminRole ? [{ resourceType: 'GROUP' as const, resourceId: adminRole.id }] : []),
      ]);

      return { tenant, userId: dbUser.id };
    });

    // Hand provisioning to the worker (stack stamping can take minutes on the
    // kubernetes driver — far too long for a signup request). Enqueue failure
    // is non-fatal: the tenant exists and the admin console can retry.
    try {
      const provisionJob: TenantProvisionJob = {
        tenantId: result.tenant.id,
        environments: ['PROD'],
      };
      await enqueue(tenantProvisionQueue, provisionJob, {
        idempotencyKey: `tenant-provision:signup:${result.tenant.id}`,
      });
    } catch (err) {
      console.warn('[POST /api/signup] Failed to enqueue provisioning (non-fatal):', err);
      await adminDb.tenant.update({
        where: { id: result.tenant.id },
        data: {
          provisioningStatus: 'FAILED',
          provisioningError: `Failed to enqueue provisioning: ${String(err)}`,
        },
      });
    }

    const workspaceUrl = env.AUTH_URL.replace('saas.', `${slugNorm}.`);

    return NextResponse.json(
      {
        tenantId: result.tenant.id,
        slug: result.tenant.slug,
        name: result.tenant.name,
        workspaceUrl,
        message: 'Your workspace is ready!',
      },
      { status: 201 },
    );
  } catch (err: unknown) {
    // Roll back Keycloak user if DB failed
    await deleteKeycloakUser(kcToken, kcUserId);

    const code = (err as { code?: string }).code;
    if (code === 'P2002') {
      return NextResponse.json(
        { error: 'A tenant with that slug already exists' },
        { status: 409 },
      );
    }
    console.error('[POST /api/signup]', err);
    return NextResponse.json({ error: 'Signup failed. Please try again.' }, { status: 500 });
  }
}
