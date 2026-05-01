import { type NextRequest, NextResponse } from 'next/server';

import { enqueue, webhookInboundQueue } from '@platform/jobs';

export const runtime = 'nodejs';

// Stripe sends raw body — we must read it as Buffer, not JSON
export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get('stripe-signature') ?? '';

  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 });
  }

  // Enqueue for async processing with idempotency via Stripe event id
  // The worker verifies the signature and processes the event
  await enqueue(
    webhookInboundQueue,
    { source: 'stripe', rawBody, signature },
    { priority: 1 },
  );

  return NextResponse.json({ received: true });
}
