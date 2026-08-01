/**
 * Display metadata for the tenant-level system roles (Role.appId: null,
 * Role.isSystem: true, excluding platform-level roles). Shared between the
 * member/invite role pickers and the Roles & Permissions admin pages so
 * every surface shows the same label for the same role — the DB stores the
 * technical name (`tenant_admin`), never the label.
 */
export const SYSTEM_ROLE_META: Record<
  string,
  { label: string; description: string; color: string }
> = {
  tenant_admin: { label: 'Admin', description: 'Full workspace control', color: '#B06CFF' },
  tenant_billing_admin: {
    label: 'Billing Admin',
    description: 'Billing management only',
    color: 'var(--brand-primary)',
  },
  tenant_user: { label: 'Member', description: 'Standard access', color: 'var(--text-secondary)' },
  tenant_viewer: { label: 'Viewer', description: 'Read-only access', color: 'var(--text-muted)' },
};

export const SYSTEM_ROLE_ORDER = Object.keys(SYSTEM_ROLE_META);

/** Friendly label for a role name, falling back to the raw name for custom roles. */
export function getRoleLabel(name: string): string {
  return SYSTEM_ROLE_META[name]?.label ?? name;
}
