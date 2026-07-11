import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Must stay in sync with packages/authz/src/permissions.ts ROLE_PERMISSIONS
const ROLE_PERMISSION_MAP: Record<string, string[]> = {
  platform_super_admin: [
    'notes:create',
    'notes:read',
    'notes:update',
    'notes:delete',
    'users:create',
    'users:read',
    'users:update',
    'users:delete',
    'billing:read',
    'billing:manage',
    'settings:read',
    'settings:manage',
    'audit:read',
    'scim:manage',
    'webhooks:manage',
    'platform:admin',
  ],
  platform_support: ['notes:read', 'users:read', 'billing:read', 'audit:read'],
  tenant_admin: [
    'notes:create',
    'notes:read',
    'notes:update',
    'notes:delete',
    'users:create',
    'users:read',
    'users:update',
    'users:delete',
    'billing:read',
    'settings:read',
    'settings:manage',
    'audit:read',
    'scim:manage',
    'webhooks:manage',
  ],
  tenant_billing_admin: ['billing:read', 'billing:manage', 'settings:read'],
  tenant_user: ['notes:create', 'notes:read', 'notes:update', 'users:read'],
  tenant_viewer: ['notes:read', 'users:read'],
};

const SYSTEM_ROLES = [
  { name: 'platform_super_admin', isSystem: true },
  { name: 'platform_support', isSystem: true },
  { name: 'tenant_admin', isSystem: true },
  { name: 'tenant_billing_admin', isSystem: true },
  { name: 'tenant_user', isSystem: true },
  { name: 'tenant_viewer', isSystem: true },
] as const;

const PERMISSIONS = [
  'notes:create',
  'notes:read',
  'notes:update',
  'notes:delete',
  'users:create',
  'users:read',
  'users:update',
  'users:delete',
  'billing:read',
  'billing:manage',
  'settings:read',
  'settings:manage',
  'audit:read',
  'scim:manage',
  'webhooks:manage',
  'platform:admin',
] as const;

const PLANS = [
  {
    code: 'free',
    name: 'Free',
    features: {
      notes: { maxCount: 10, delete: false },
      users: { maxCount: 3 },
      scim: false,
      webhooks: false,
      customDomain: false,
    },
  },
  {
    code: 'pro',
    name: 'Pro',
    features: {
      notes: { maxCount: 1000, delete: true },
      users: { maxCount: 50 },
      scim: true,
      webhooks: true,
      customDomain: false,
    },
  },
  {
    code: 'enterprise',
    name: 'Enterprise',
    features: {
      notes: { maxCount: null, delete: true },
      users: { maxCount: null },
      scim: true,
      webhooks: true,
      customDomain: true,
    },
  },
] as const;

async function main() {
  console.log('🌱 Seeding database...');

  // Plans
  for (const plan of PLANS) {
    await prisma.plan.upsert({
      where: { code: plan.code },
      update: { name: plan.name, features: plan.features },
      create: plan,
    });
    console.log(`  ✓ Plan: ${plan.code}`);
  }

  // System roles (tenant_id = null)
  for (const role of SYSTEM_ROLES) {
    const existing = await prisma.role.findFirst({
      where: { tenantId: null, name: role.name },
    });
    if (!existing) {
      await prisma.role.create({
        data: { tenantId: null, name: role.name, isSystem: role.isSystem },
      });
    }
    console.log(`  ✓ Role: ${role.name}`);
  }

  // Permissions
  for (const code of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { code },
      update: {},
      create: { code },
    });
  }
  console.log(`  ✓ ${String(PERMISSIONS.length)} permissions`);

  // Wire role → permissions in DB (source of truth alongside static fallback)
  for (const [roleName, permCodes] of Object.entries(ROLE_PERMISSION_MAP)) {
    const role = await prisma.role.findFirst({ where: { tenantId: null, name: roleName } });
    if (!role) continue;
    for (const code of permCodes) {
      const perm = await prisma.permission.findUnique({ where: { code } });
      if (!perm) continue;
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: perm.id } },
        update: {},
        create: { roleId: role.id, permissionId: perm.id },
      });
    }
  }
  console.log('  ✓ Role→permission mappings wired');

  // Tenants
  const acme = await prisma.tenant.upsert({
    where: { slug: 'acme' },
    update: {},
    create: {
      slug: 'acme',
      name: 'Acme Corp',
      status: 'ACTIVE',
      plan: 'pro',
      customDomains: [],
    },
  });
  console.log(`  ✓ Tenant: acme (${acme.id})`);

  const globex = await prisma.tenant.upsert({
    where: { slug: 'globex' },
    update: {},
    create: {
      slug: 'globex',
      name: 'Globex Corporation',
      status: 'ACTIVE',
      plan: 'free',
      customDomains: [],
    },
  });
  console.log(`  ✓ Tenant: globex (${globex.id})`);

  // Seed notes
  for (const [slug, tenantId] of [
    ['acme', acme.id],
    ['globex', globex.id],
  ] as const) {
    await prisma.note.createMany({
      data: [
        { tenantId, body: `Hello from ${slug} - note 1` },
        { tenantId, body: `Hello from ${slug} - note 2` },
      ],
      skipDuplicates: true,
    });
    console.log(`  ✓ Notes seeded for ${slug}`);
  }

  // Subscriptions
  const freePlan = await prisma.plan.findUniqueOrThrow({ where: { code: 'free' } });
  const proPlan = await prisma.plan.findUniqueOrThrow({ where: { code: 'pro' } });

  await prisma.subscription.upsert({
    where: { tenantId: acme.id },
    update: {},
    create: {
      tenantId: acme.id,
      planId: proPlan.id,
      status: 'ACTIVE',
    },
  });

  await prisma.subscription.upsert({
    where: { tenantId: globex.id },
    update: {},
    create: {
      tenantId: globex.id,
      planId: freePlan.id,
      status: 'ACTIVE',
    },
  });
  console.log('  ✓ Subscriptions created');

  console.log('\n✅ Seed complete!');
  console.log('\nTenant IDs for reference:');
  console.log(`  acme:   ${acme.id}`);
  console.log(`  globex: ${globex.id}`);
}

main()
  .catch((e: unknown) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
