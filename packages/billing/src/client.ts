import Stripe from 'stripe';

import { env } from '@platform/config';

export const stripe = new Stripe(env.STRIPE_SECRET_KEY ?? '', {
  apiVersion: '2024-06-20',
  typescript: true,
});
