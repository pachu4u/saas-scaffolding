import { PrismaClient } from '@prisma/client';

// Exported so seed.ts can reuse this single client rather than opening a
// second connection just to layer demo fixtures on top of this file's data.
export const prisma = new PrismaClient();

// Must stay in sync with packages/authz/src/permissions.ts ROLE_PERMISSIONS
// and the SYSTEM_ROLES/PERMISSIONS/PLANS lists in seed.ts -- this file is
// the subset of seed.ts that's essential platform data (system roles,
// permissions, plans), not demo fixtures (acme/globex tenants, notes). Any
// deployment needs this to function at all -- without it, role assignment
// during tenant invites silently no-ops (no system role ever matches) and
// every tenant has no plan/subscription. See seed.ts's own comment history
// and bootstrap.sh.tftpl for why a real deployment runs this instead of
// seed.ts wholesale.
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

export async function seedSystem(): Promise<void> {
  console.log('🌱 Seeding essential system data (roles, permissions, plans)...');

  for (const plan of PLANS) {
    await prisma.plan.upsert({
      where: { code: plan.code },
      update: { name: plan.name, features: plan.features },
      create: plan,
    });
    console.log(`  ✓ Plan: ${plan.code}`);
  }

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

  for (const code of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { code },
      update: {},
      create: { code },
    });
  }
  console.log(`  ✓ ${String(PERMISSIONS.length)} permissions`);

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

  console.log('\n✅ System seed complete!');
}

// Only run standalone (tsx src/seed-system.ts) -- when imported by seed.ts,
// that file drives the disconnect after layering its own demo fixtures on.
if (import.meta.url === `file://${process.argv[1]}`) {
  seedSystem()
    .catch((e: unknown) => {
      console.error(e);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
