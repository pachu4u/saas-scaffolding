import { auth } from '@platform/auth';
import { setupStripeIntegration } from '@platform/billing';
import { env } from '@platform/config';
import { adminDb } from '@platform/db';
import { logger } from '@platform/logger';
import { getPlatformSecrets } from '@platform/vault';
import { type NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

function isPlatformAdmin(session: { groups?: unknown }): boolean {
  return (
    Array.isArray(session.groups) &&
    (session.groups as string[]).some((g) =>
      ['platform_super_admin', 'platform_support'].includes(g),
    )
  );
}

function maskKey(key: string): string {
  if (key.length <= 11) return '••••';
  return `${key.slice(0, 7)}••••${key.slice(-4)}`;
}

/**
 * GET /api/admin/billing
 * Current Stripe configuration status (masked) and plan price IDs.
 */
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isPlatformAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const [keys, plans] = await Promise.all([
    getPlatformSecrets()
      .getStripeKeys()
      .catch(() => null),
    adminDb.plan.findMany({
      where: { code: { in: ['pro', 'enterprise'] } },
      select: { code: true, name: true, priceIdStripe: true },
    }),
  ]);

  return NextResponse.json({
    configured: Boolean(keys?.secret_key),
    publishableKey: keys?.publishable_key ? maskKey(keys.publishable_key) : null,
    webhookConfigured: Boolean(keys?.webhook_secret),
    plans,
  });
}

/**
 * POST /api/admin/billing
 * Body: { secretKey, publishableKey, webhookSecret?, proPriceUsd?, enterprisePriceUsd? }
 * Validates the key against Stripe, creates/updates Product+Price for any plan
 * with a price supplied, auto-registers the webhook endpoint when no secret is
 * given, and stores everything in Vault.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isPlatformAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = (await req.json()) as {
    secretKey?: string;
    publishableKey?: string;
    webhookSecret?: string;
    proPriceUsd?: number;
    enterprisePriceUsd?: number;
  };

  const { secretKey, publishableKey } = body;
  if (!secretKey?.startsWith('sk_') || !publishableKey?.startsWith('pk_')) {
    return NextResponse.json(
      { error: 'Enter a valid Stripe secret key (sk_...) and publishable key (pk_...)' },
      { status: 422 },
    );
  }

  try {
    const result = await setupStripeIntegration({
      secretKey,
      publishableKey,
      webhookSecret: body.webhookSecret,
      webhookUrl: `${env.NEXT_PUBLIC_APP_URL}/api/billing/webhook`,
      planPricesUsd: {
        pro: body.proPriceUsd,
        enterprise: body.enterprisePriceUsd,
      },
    });

    logger.info(
      { actor: session.user.email, priceIds: result.priceIds },
      'Stripe integration configured',
    );

    return NextResponse.json({
      ok: true,
      publishableKey: maskKey(publishableKey),
      webhookConfigured: result.webhookConfigured,
      priceIds: result.priceIds,
    });
  } catch (err) {
    logger.error({ err, actor: session.user.email }, 'Stripe setup failed');
    const message = err instanceof Error ? err.message : 'Stripe rejected the request';
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
