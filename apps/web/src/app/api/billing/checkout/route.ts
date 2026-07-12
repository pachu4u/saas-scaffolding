import { auth } from '@platform/auth';
import { stripe } from '@platform/billing';
import { env } from '@platform/config';
import { adminDb } from '@platform/db';
import { logger } from '@platform/logger';
import { type NextRequest, NextResponse } from 'next/server';

import { getTenantFromRequest } from '../../../../lib/server-tenant';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await req.json()) as { planCode?: string };
  const planCode = body.planCode ?? 'pro';

  const tenant = await getTenantFromRequest(req);
  if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

  // Look up the plan and its Stripe price ID
  const plan = await adminDb.plan.findUnique({ where: { code: planCode } });
  if (!plan?.priceIdStripe) {
    return NextResponse.json(
      { error: `No Stripe price configured for plan "${planCode}"` },
      { status: 422 },
    );
  }

  // Find or create Stripe customer
  const subscription = await adminDb.subscription.findUnique({
    where: { tenantId: tenant.tenantId },
  });

  let customerId = subscription?.stripeCustomerId;

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: session.user.email,
      name: tenant.name,
      metadata: { tenantId: tenant.tenantId, tenantSlug: tenant.slug },
    });
    customerId = customer.id;

    // Persist the customer ID immediately so concurrent calls don't create duplicates
    if (subscription) {
      await adminDb.subscription.update({
        where: { tenantId: tenant.tenantId },
        data: { stripeCustomerId: customerId },
      });
    }
  }

  const appUrl = env.NEXT_PUBLIC_APP_URL;

  try {
    const checkoutSession = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: plan.priceIdStripe, quantity: 1 }],
      subscription_data: {
        metadata: { tenantId: tenant.tenantId, tenantSlug: tenant.slug, planCode },
      },
      success_url: `${appUrl}/billing?checkout=success`,
      cancel_url: `${appUrl}/billing?checkout=cancelled`,
      allow_promotion_codes: true,
      billing_address_collection: 'auto',
      customer_update: { address: 'auto' },
    });

    logger.info(
      { tenantId: tenant.tenantId, planCode, sessionId: checkoutSession.id },
      'Stripe Checkout session created',
    );

    return NextResponse.json({ url: checkoutSession.url });
  } catch (err) {
    logger.error({ err, tenantId: tenant.tenantId }, 'Failed to create Stripe Checkout session');
    return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 });
  }
}
