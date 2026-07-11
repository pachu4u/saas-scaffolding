export const PLAN_CODES = ['free', 'pro', 'enterprise'] as const;
export type PlanCode = (typeof PLAN_CODES)[number];

export interface PlanFeatures {
  notes: { maxCount: number | null; delete: boolean };
  users: { maxCount: number | null };
  scim: boolean;
  webhooks: boolean;
  customDomain: boolean;
  riogentix: {
    features: string[];
  };
}

export const PLAN_FEATURES: Record<PlanCode, PlanFeatures> = {
  free: {
    notes: { maxCount: 10, delete: false },
    users: { maxCount: 3 },
    scim: false,
    webhooks: false,
    customDomain: false,
    riogentix: {
      features: ['feature:chat:access', 'feature:flows:read'],
    },
  },
  pro: {
    notes: { maxCount: 1000, delete: true },
    users: { maxCount: 50 },
    scim: true,
    webhooks: true,
    customDomain: false,
    riogentix: {
      features: [
        'feature:chat:access',
        'feature:flows:read',
        'feature:flows:write',
        'feature:knowledge_bases:access',
      ],
    },
  },
  enterprise: {
    notes: { maxCount: null, delete: true },
    users: { maxCount: null },
    scim: true,
    webhooks: true,
    customDomain: true,
    riogentix: {
      features: [
        'feature:chat:access',
        'feature:flows:read',
        'feature:flows:write',
        'feature:knowledge_bases:access',
        'feature:mcp:access',
        'feature:memory:access',
        'feature:deployments:access',
      ],
    },
  },
};
