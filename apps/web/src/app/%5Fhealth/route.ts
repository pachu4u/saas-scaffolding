import { type NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function GET(_req: NextRequest) {
  return NextResponse.json(
    {
      ok: true,
      sha: process.env.GIT_SHA ?? 'dev',
      env: process.env.NODE_ENV,
      ts: new Date().toISOString(),
    },
    { status: 200 },
  );
}
