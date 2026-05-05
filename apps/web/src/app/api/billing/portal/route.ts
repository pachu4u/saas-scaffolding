import { NextResponse } from 'next/server';

import { auth } from '@platform/auth';
import { stripe } from '@platform/billing';
import { env } from '@platform/config';
import { adminDb } from '@platform/db';
import { logger } from '@platform/logger';

export const runtime = 'nodejs';

export async function POST() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const tenantSlug = process.env.NEXT_PUBLIC_DEFAULT_TENANT_SLUG ?? 'acme';
  const tenant = await adminDb.tenant.findUnique({ where: { slug: tenantSlug } });
  if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

  const subscription = await adminDb.subscription.findUnique({
    where: { tenantId: tenant.id },
  });

  if (!subscription?.stripeCustomerId) {
    return NextResponse.json(
      { error: 'No Stripe customer found for this workspace' },
      { status: 422 },
    );
  }

  const appUrl = env.NEXT_PUBLIC_APP_URL;

  try {
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: subscription.stripeCustomerId,
      return_url: `${appUrl}/billing`,
    });

    logger.info(
      { tenantId: tenant.id, customerId: subscription.stripeCustomerId },
      'Stripe Customer Portal session created',
    );

    return NextResponse.json({ url: portalSession.url });
  } catch (err) {
    logger.error({ err, tenantId: tenant.id }, 'Failed to create Stripe Customer Portal session');
    return NextResponse.json({ error: 'Failed to open billing portal' }, { status: 500 });
  }
}
