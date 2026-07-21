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

  // Platform
  PLATFORM_ADMIN: 'platform:admin',
} as const;

export type PermissionCode = (typeof Permission)[keyof typeof Permission];

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
  ],
  tenant_viewer: [Permission.NOTES_READ, Permission.USERS_READ],
};

/**
 * System roles that operate at the platform level, not the tenant level.
 * These are seeded with tenantId: null and must never be listed as
 * assignable/visible from within a tenant's own role management UI or APIs.
 */
export const PLATFORM_ROLE_NAMES = ['platform_super_admin', 'platform_support'] as const;
