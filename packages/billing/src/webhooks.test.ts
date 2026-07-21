import { describe, it, expect, vi, beforeEach } from 'vitest';

// vi.mock is hoisted — use vi.hoisted() so the mock fns are available in the factories
const {
  mockConstructEvent,
  mockIdempotencyFindUnique,
  mockIdempotencyCreate,
  mockPlanFindUnique,
  mockSubscriptionFindUnique,
  mockSubscriptionUpsert,
  mockSubscriptionUpdate,
  mockEnqueue,
} = vi.hoisted(() => ({
  mockConstructEvent: vi.fn(),
  mockIdempotencyFindUnique: vi.fn(),
  mockIdempotencyCreate: vi.fn(),
  mockPlanFindUnique: vi.fn(),
  mockSubscriptionFindUnique: vi.fn(),
  mockSubscriptionUpsert: vi.fn(),
  mockSubscriptionUpdate: vi.fn(),
  mockEnqueue: vi.fn(),
}));

vi.mock('./client.js', () => ({
  stripe: { webhooks: { constructEvent: mockConstructEvent } },
}));

vi.mock('@platform/config', () => ({
  env: { STRIPE_WEBHOOK_SECRET: 'whsec_test' },
}));

vi.mock('@platform/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

vi.mock('@platform/jobs', () => ({
  enqueue: mockEnqueue,
  planChangedQueue: { name: 'plan-changed' },
}));

vi.mock('@platform/db', () => ({
  adminDb: {
    idempotencyKey: { findUnique: mockIdempotencyFindUnique, create: mockIdempotencyCreate },
    plan: { findUnique: mockPlanFindUnique },
    subscription: {
      findUnique: mockSubscriptionFindUnique,
      upsert: mockSubscriptionUpsert,
      update: mockSubscriptionUpdate,
    },
  },
}));

import { processStripeEvent } from './webhooks.js';

const TENANT_ID = 'tenant-uuid-1';

function makeSubscriptionEvent(
  type: 'customer.subscription.created' | 'customer.subscription.updated',
  overrides: Record<string, unknown> = {},
) {
  return {
    id: `evt_${type}`,
    type,
    data: {
      object: {
        id: 'sub_123',
        customer: 'cus_123',
        status: 'active',
        current_period_end: 1_700_000_000,
        metadata: { tenantId: TENANT_ID, planCode: 'pro' },
        ...overrides,
      },
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockIdempotencyFindUnique.mockResolvedValue(null);
  mockIdempotencyCreate.mockResolvedValue({});
  mockPlanFindUnique.mockResolvedValue({ id: 'plan-pro' });
  mockSubscriptionFindUnique.mockResolvedValue(null);
  mockSubscriptionUpsert.mockResolvedValue({});
  mockSubscriptionUpdate.mockResolvedValue({});
  mockEnqueue.mockResolvedValue('job-1');
});

describe('processStripeEvent', () => {
  it('skips unhandled event types without touching the database', async () => {
    mockConstructEvent.mockReturnValue({ id: 'evt_1', type: 'charge.succeeded', data: {} });

    await processStripeEvent('raw', 'sig');

    expect(mockIdempotencyFindUnique).not.toHaveBeenCalled();
    expect(mockSubscriptionUpsert).not.toHaveBeenCalled();
  });

  it('skips already-processed events (idempotency)', async () => {
    mockConstructEvent.mockReturnValue(makeSubscriptionEvent('customer.subscription.created'));
    mockIdempotencyFindUnique.mockResolvedValue({ key: 'stripe:evt_x' });

    await processStripeEvent('raw', 'sig');

    expect(mockSubscriptionUpsert).not.toHaveBeenCalled();
    expect(mockIdempotencyCreate).not.toHaveBeenCalled();
  });

  it('upserts the subscription and enqueues plan-changed on subscription.created', async () => {
    mockConstructEvent.mockReturnValue(makeSubscriptionEvent('customer.subscription.created'));

    await processStripeEvent('raw', 'sig');

    expect(mockSubscriptionUpsert).toHaveBeenCalledTimes(1);
    const upsertArg = mockSubscriptionUpsert.mock.calls[0]?.[0] as {
      where: { tenantId: string };
      create: { tenantId: string; status: string };
    };
    expect(upsertArg.where).toEqual({ tenantId: TENANT_ID });
    expect(upsertArg.create.tenantId).toBe(TENANT_ID);
    expect(upsertArg.create.status).toBe('ACTIVE');

    expect(mockEnqueue).toHaveBeenCalledWith(
      { name: 'plan-changed' },
      expect.objectContaining({ tenantId: TENANT_ID, newPlan: 'pro' }),
    );

    expect(mockIdempotencyCreate).toHaveBeenCalledTimes(1);
    const idempotencyArg = mockIdempotencyCreate.mock.calls[0]?.[0] as {
      data: { tenantId: string };
    };
    expect(idempotencyArg.data.tenantId).toBe(TENANT_ID);
  });

  it('maps Stripe subscription statuses to the internal SubscriptionStatus enum', async () => {
    mockConstructEvent.mockReturnValue(
      makeSubscriptionEvent('customer.subscription.updated', { status: 'past_due' }),
    );

    await processStripeEvent('raw', 'sig');

    const upsertArg = mockSubscriptionUpsert.mock.calls[0]?.[0] as { create: { status: string } };
    expect(upsertArg.create.status).toBe('PAST_DUE');
  });

  it('ignores subscription events with no tenantId in metadata', async () => {
    mockConstructEvent.mockReturnValue(
      makeSubscriptionEvent('customer.subscription.created', { metadata: {} }),
    );

    await processStripeEvent('raw', 'sig');

    expect(mockSubscriptionUpsert).not.toHaveBeenCalled();
  });

  it('cancels the subscription and enqueues a downgrade on subscription.deleted', async () => {
    mockConstructEvent.mockReturnValue({
      id: 'evt_deleted',
      type: 'customer.subscription.deleted',
      data: { object: { metadata: { tenantId: TENANT_ID } } },
    });

    await processStripeEvent('raw', 'sig');

    expect(mockSubscriptionUpdate).toHaveBeenCalledWith({
      where: { tenantId: TENANT_ID },
      data: { status: 'CANCELED' },
    });
    expect(mockEnqueue).toHaveBeenCalledWith(
      { name: 'plan-changed' },
      expect.objectContaining({ tenantId: TENANT_ID, newPlan: 'free' }),
    );
  });
});
