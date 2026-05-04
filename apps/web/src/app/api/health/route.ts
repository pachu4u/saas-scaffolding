import { NextResponse } from 'next/server';

// Liveness/readiness probe used by Docker healthcheck and load balancers.
// Must not connect to any external service — the container must be able to
// answer this before the DB or Redis have initialised.
export const dynamic = 'force-dynamic';

export function GET() {
  return NextResponse.json({ status: 'ok' }, { status: 200 });
}
