export const Permission = {
  // Notes
  NOTES_CREATE: 'notes:create',
  NOTES_READ: 'notes:read',
  NOTES_UPDATE: 'notes:update',
  NOTES_DELETE: 'notes:delete',

  // Users
  USERS_CREATE: 'users:create',
  USERS_READ: 'users:read',
  USERS_UPDATE: 'users:update',
  USERS_DELETE: 'users:delete',

  // Billing
  BILLING_READ: 'billing:read',
  BILLING_MANAGE: 'billing:manage',

  // Settings
  SETTINGS_READ: 'settings:read',
  SETTINGS_MANAGE: 'settings:manage',

  // Audit
  AUDIT_READ: 'audit:read',

  // SCIM
  SCIM_MANAGE: 'scim:manage',

  // Webhooks
  WEBHOOKS_MANAGE: 'webhooks:manage',

  // Riogentix: Flows
  RIOGENTIX_FLOW_CREATE: 'riogentix:flow:create',
  RIOGENTIX_FLOW_READ: 'riogentix:flow:read',
  RIOGENTIX_FLOW_UPDATE: 'riogentix:flow:update',
  RIOGENTIX_FLOW_DELETE: 'riogentix:flow:delete',

  // Riogentix: Deployments
  RIOGENTIX_DEPLOYMENT_CREATE: 'riogentix:deployment:create',
  RIOGENTIX_DEPLOYMENT_READ: 'riogentix:deployment:read',
  RIOGENTIX_DEPLOYMENT_UPDATE: 'riogentix:deployment:update',
  RIOGENTIX_DEPLOYMENT_DELETE: 'riogentix:deployment:delete',

  // Riogentix: Projects
  RIOGENTIX_PROJECT_CREATE: 'riogentix:project:create',
  RIOGENTIX_PROJECT_READ: 'riogentix:project:read',
  RIOGENTIX_PROJECT_UPDATE: 'riogentix:project:update',
  RIOGENTIX_PROJECT_DELETE: 'riogentix:project:delete',

  // Riogentix: Knowledge bases
  RIOGENTIX_KNOWLEDGE_BASE_CREATE: 'riogentix:knowledge_base:create',
  RIOGENTIX_KNOWLEDGE_BASE_READ: 'riogentix:knowledge_base:read',
  RIOGENTIX_KNOWLEDGE_BASE_UPDATE: 'riogentix:knowledge_base:update',
  RIOGENTIX_KNOWLEDGE_BASE_DELETE: 'riogentix:knowledge_base:delete',

  // Riogentix: Variables
  RIOGENTIX_VARIABLE_CREATE: 'riogentix:variable:create',
  RIOGENTIX_VARIABLE_READ: 'riogentix:variable:read',
  RIOGENTIX_VARIABLE_UPDATE: 'riogentix:variable:update',
  RIOGENTIX_VARIABLE_DELETE: 'riogentix:variable:delete',

  // Riogentix: Files
  RIOGENTIX_FILE_CREATE: 'riogentix:file:create',
  RIOGENTIX_FILE_READ: 'riogentix:file:read',
  RIOGENTIX_FILE_UPDATE: 'riogentix:file:update',
  RIOGENTIX_FILE_DELETE: 'riogentix:file:delete',

  // Riogentix: Shares
  RIOGENTIX_SHARE_CREATE: 'riogentix:share:create',
  RIOGENTIX_SHARE_READ: 'riogentix:share:read',
  RIOGENTIX_SHARE_UPDATE: 'riogentix:share:update',
  RIOGENTIX_SHARE_DELETE: 'riogentix:share:delete',

  // Platform
  PLATFORM_ADMIN: 'platform:admin',
} as const;

export type PermissionCode = (typeof Permission)[keyof typeof Permission];

const RIOGENTIX_RESOURCES = [
  'FLOW',
  'DEPLOYMENT',
  'PROJECT',
  'KNOWLEDGE_BASE',
  'VARIABLE',
  'FILE',
  'SHARE',
] as const;

/** All riogentix:{resource}:{crud} permission codes. */
const RIOGENTIX_PERMISSIONS: PermissionCode[] = RIOGENTIX_RESOURCES.flatMap((resource) => [
  Permission[`RIOGENTIX_${resource}_CREATE`],
  Permission[`RIOGENTIX_${resource}_READ`],
  Permission[`RIOGENTIX_${resource}_UPDATE`],
  Permission[`RIOGENTIX_${resource}_DELETE`],
]);

/** riogentix:{resource}:read permission codes only. */
const RIOGENTIX_READ_PERMISSIONS: PermissionCode[] = RIOGENTIX_RESOURCES.map(
  (resource) => Permission[`RIOGENTIX_${resource}_READ`],
);

/** riogentix:{resource}:{create,read,update} permission codes (no delete). */
const RIOGENTIX_NO_DELETE_PERMISSIONS: PermissionCode[] = RIOGENTIX_RESOURCES.flatMap(
  (resource) => [
    Permission[`RIOGENTIX_${resource}_CREATE`],
    Permission[`RIOGENTIX_${resource}_READ`],
    Permission[`RIOGENTIX_${resource}_UPDATE`],
  ],
);

/**
 * Default permissions for each system role.
 * Seeded into the DB and cached for authorization checks.
 */
export const ROLE_PERMISSIONS: Record<string, PermissionCode[]> = {
  platform_super_admin: Object.values(Permission),
  platform_support: [
    Permission.NOTES_READ,
    Permission.USERS_READ,
    Permission.BILLING_READ,
    Permission.AUDIT_READ,
  ],
  tenant_admin: [
    Permission.NOTES_CREATE,
    Permission.NOTES_READ,
    Permission.NOTES_UPDATE,
    Permission.NOTES_DELETE,
    Permission.USERS_CREATE,
    Permission.USERS_READ,
    Permission.USERS_UPDATE,
    Permission.USERS_DELETE,
    Permission.BILLING_READ,
    Permission.SETTINGS_READ,
    Permission.SETTINGS_MANAGE,
    Permission.AUDIT_READ,
    Permission.SCIM_MANAGE,
    Permission.WEBHOOKS_MANAGE,
    ...RIOGENTIX_PERMISSIONS,
  ],
  tenant_billing_admin: [
    Permission.BILLING_READ,
    Permission.BILLING_MANAGE,
    Permission.SETTINGS_READ,
  ],
  tenant_user: [
    Permission.NOTES_CREATE,
    Permission.NOTES_READ,
    Permission.NOTES_UPDATE,
    Permission.USERS_READ,
    ...RIOGENTIX_NO_DELETE_PERMISSIONS,
  ],
  tenant_viewer: [Permission.NOTES_READ, Permission.USERS_READ, ...RIOGENTIX_READ_PERMISSIONS],
};

/**
 * System roles that operate at the platform level, not the tenant level.
 * These are seeded with tenantId: null and must never be listed as
 * assignable/visible from within a tenant's own role management UI or APIs.
 */
export const PLATFORM_ROLE_NAMES = ['platform_super_admin', 'platform_support'] as const;
