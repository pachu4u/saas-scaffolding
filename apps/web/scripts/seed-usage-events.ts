#!/usr/bin/env tsx
/**
 * Insert synthetic usage events for a tenant so the Usage Events feature
 * (admin dashboard chart, /api/usage, Live Activity SSE panel) can be
 * verified visually before Riogentix instrumentation exists.
 *
 * Usage:
 *   pnpm --filter @platform/web exec tsx scripts/seed-usage-events.ts <slug> [count]
 *   # or from repo root:
 *   tsx apps/web/scripts/seed-usage-events.ts acme 200
 *
 * Requires DATABASE_URL (or DATABASE_URL_MIGRATOR) in the environment —
 * run with `pnpm dev:up` services running, or source .env first.
 */
import { PrismaClient } from '@prisma/client';

const KINDS = [
  'flow.created',
  'flow.deleted',
  'flow.executed',
  'storage.updated',
  'apikey.created',
  'seat.added',
] as const;

// Weighted so flow.executed dominates, like real traffic.
const WEIGHTS = [3, 1, 60, 15, 4, 6];

function pickKind(): string {
  const total = WEIGHTS.reduce((a, b) => a + b, 0);
  let roll = Math.random() * total;
  for (const [i, w] of WEIGHTS.entries()) {
    roll -= w ?? 0;
    if (roll <= 0) return KINDS[i] ?? 'flow.executed';
  }
  return 'flow.executed';
}

async function main() {
  const slug = process.argv[2];
  const count = Math.min(Math.max(Number(process.argv[3] ?? '200') || 200, 1), 5000);
  if (!slug) {
    console.error('Usage: seed-usage-events.ts <tenant-slug> [count]');
    process.exit(1);
  }

  const datasourceUrl = process.env.DATABASE_URL_MIGRATOR ?? process.env.DATABASE_URL;
  const prisma = new PrismaClient({
    ...(datasourceUrl !== undefined ? { datasourceUrl } : {}),
  });

  try {
    const tenant = await prisma.tenant.findUnique({
      where: { slug },
      select: { id: true, slug: true },
    });
    if (!tenant) {
      console.error(`Tenant not found: ${slug}`);
      process.exit(1);
    }

    // Spread events randomly over the last 30 days, biased toward recent.
    const now = Date.now();
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
    const data = Array.from({ length: count }, () => {
      const ageMs = Math.floor(thirtyDaysMs * Math.pow(Math.random(), 1.5));
      const quantity =
        pickKind() === 'storage.updated'
          ? Math.floor(Math.random() * 50) + 1
          : Math.floor(Math.random() * 5) + 1;
      return {
        tenantId: tenant.id,
        kind: pickKind(),
        quantity,
        occurredAt: new Date(now - ageMs),
      };
    });

    const result = await prisma.usageEvent.createMany({ data });
    console.log(
      `Inserted ${String(result.count)} synthetic usage events for tenant "${tenant.slug}".`,
    );

    // Fire one NOTIFY so any open Live Activity panels light up immediately.
    const totals: Record<string, number> = {};
    for (const ev of data) totals[ev.kind] = (totals[ev.kind] ?? 0) + ev.quantity;
    const payload = JSON.stringify({
      tenantId: tenant.id,
      at: new Date().toISOString(),
      totals,
    });
    await prisma.$queryRaw`SELECT pg_notify('usage_events', ${payload})`;
    console.log('Sent usage_events NOTIFY (aggregate).');
  } finally {
    await prisma.$disconnect();
  }
}

await main();
