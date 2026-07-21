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

  const tenant = await getTenantFromRequest(req);
  if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

  const subscription = await adminDb.subscription.findUnique({
    where: { tenantId: tenant.tenantId },
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
      { tenantId: tenant.tenantId, customerId: subscription.stripeCustomerId },
      'Stripe Customer Portal session created',
    );

    return NextResponse.json({ url: portalSession.url });
  } catch (err) {
    logger.error(
      { err, tenantId: tenant.tenantId },
      'Failed to create Stripe Customer Portal session',
    );
    return NextResponse.json({ error: 'Failed to open billing portal' }, { status: 500 });
  }
}
