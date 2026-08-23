import { prisma, seedSystem } from './seed-system.js';

async function main() {
  console.log('🌱 Seeding database...');

  // Essential platform data (roles, permissions, plans) -- see seed-system.ts.
  await seedSystem();

  // Tenants
  const acme = await prisma.tenant.upsert({
    where: { slug: 'acme' },
    update: {},
    create: {
      slug: 'acme',
      name: 'Acme Corp',
      status: 'ACTIVE',
      plan: 'pro',
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
