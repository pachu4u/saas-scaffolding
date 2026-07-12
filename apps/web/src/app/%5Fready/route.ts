import { type NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest) {
  const checks: Record<string, 'ok' | 'fail'> = {};

  // DB check
  try {
    const { db } = await import('@platform/db');
    await db.$queryRaw`SELECT 1`;
    checks.db = 'ok';
  } catch {
    checks.db = 'fail';
  }

  // Redis check
  try {
    const { redis } = await import('@platform/db');
    await redis.ping();
    checks.redis = 'ok';
  } catch {
    checks.redis = 'fail';
  }

  const healthy = Object.values(checks).every((v) => v === 'ok');

  return NextResponse.json({ ok: healthy, checks }, { status: healthy ? 200 : 503 });
}
