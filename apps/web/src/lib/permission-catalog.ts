import { Permission } from '@platform/authz';

/**
 * UI-facing labels/descriptions for the real, enforced Permission codes
 * (packages/authz/src/permissions.ts). This is the single source of truth
 * for what the Team → Roles & Permissions pages display — it must stay in
 * sync with `Permission`, not invent its own parallel vocabulary.
 *
 * PLATFORM_ADMIN is deliberately excluded: it's platform-scoped, never
 * something a tenant can view or grant through its own role editor.
 */
export interface PermissionCatalogEntry {
  code: string;
  label: string;
  desc: string;
}

export interface PermissionCatalogGroup {
  resource: string;
  icon: string;
  permissions: PermissionCatalogEntry[];
}

export const PERMISSION_CATALOG: PermissionCatalogGroup[] = [
  {
    resource: 'Notes',
    icon: '📝',
    permissions: [
      { code: Permission.NOTES_CREATE, label: 'Create notes', desc: 'Add new notes' },
      { code: Permission.NOTES_READ, label: 'View notes', desc: 'See existing notes' },
      { code: Permission.NOTES_UPDATE, label: 'Edit notes', desc: 'Modify existing notes' },
      { code: Permission.NOTES_DELETE, label: 'Delete notes', desc: 'Remove notes' },
    ],
  },
  {
    resource: 'Members',
    icon: '👤',
    permissions: [
      {
        code: Permission.USERS_CREATE,
        label: 'Invite members',
        desc: 'Send invitations to new members',
      },
      { code: Permission.USERS_READ, label: 'View members', desc: 'See the team member list' },
      {
        code: Permission.USERS_UPDATE,
        label: 'Edit member roles',
        desc: "Change a member's role or details",
      },
      {
        code: Permission.USERS_DELETE,
        label: 'Remove members',
        desc: 'Remove members from the tenant',
      },
    ],
  },
  {
    resource: 'Billing',
    icon: '💳',
    permissions: [
      {
        code: Permission.BILLING_READ,
        label: 'View billing',
        desc: 'See current plan, usage, and invoice history',
      },
      {
        code: Permission.BILLING_MANAGE,
        label: 'Manage billing',
        desc: 'Change plan, update payment method',
      },
    ],
  },
  {
    resource: 'Settings',
    icon: '⚙️',
    permissions: [
      {
        code: Permission.SETTINGS_READ,
        label: 'View settings',
        desc: 'View tenant configuration',
      },
      {
        code: Permission.SETTINGS_MANAGE,
        label: 'Edit settings',
        desc: 'Change tenant name, branding, SSO, and other settings',
      },
    ],
  },
  {
    resource: 'Audit Log',
    icon: '📋',
    permissions: [
      {
        code: Permission.AUDIT_READ,
        label: 'View audit log',
        desc: 'Search and read audit events',
      },
    ],
  },
  {
    resource: 'SCIM',
    icon: '🔐',
    permissions: [
      { code: Permission.SCIM_MANAGE, label: 'Manage SCIM', desc: 'Rotate SCIM bearer tokens' },
    ],
  },
  {
    resource: 'Webhooks',
    icon: '🔁',
    permissions: [
      {
        code: Permission.WEBHOOKS_MANAGE,
        label: 'Manage webhooks',
        desc: 'Create, edit, pause, or delete webhooks',
      },
    ],
  },
];
