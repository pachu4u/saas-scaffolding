'use client';

import { useEffect, useMemo, useState } from 'react';

import { SYSTEM_ROLE_META, SYSTEM_ROLE_ORDER } from './system-roles';

export interface TenantRole {
  id: string;
  name: string;
  isSystem: boolean;
  memberCount: number;
  permissions: string[];
}

export interface RoleOption {
  /** Role name as stored in the DB — what the team APIs expect as `roleId`. */
  id: string;
  name: string;
  description: string;
  color: string;
}

/** Static fallback so role pickers still render if /api/team/roles fails. */
export const SYSTEM_ROLE_OPTIONS: RoleOption[] = Object.entries(SYSTEM_ROLE_META).map(
  ([name, meta]) => ({
    id: name,
    name: meta.label,
    description: meta.description,
    color: meta.color,
  }),
);

/**
 * Load all roles assignable in the current tenant (system + custom) and shape
 * them for the role-picker modals. System roles come first in a fixed order,
 * custom roles after, alphabetically.
 */
export function useTenantRoles(tenantSlug?: string): {
  roleOptions: RoleOption[] | null;
  error: string | null;
} {
  const [roles, setRoles] = useState<TenantRole[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/team/roles', {
      headers: tenantSlug ? { 'x-tenant-slug': tenantSlug } : {},
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(`Failed to load roles (${String(res.status)})`);
        return (await res.json()) as TenantRole[];
      })
      .then((data) => {
        if (!cancelled) setRoles(data);
      })
      .catch(() => {
        if (!cancelled) setError('Could not load custom roles');
      });
    return () => {
      cancelled = true;
    };
  }, [tenantSlug]);

  const roleOptions = useMemo(() => {
    if (!roles) return error ? SYSTEM_ROLE_OPTIONS : null;

    const system = roles
      .filter((r) => r.isSystem)
      .sort((a, b) => SYSTEM_ROLE_ORDER.indexOf(a.name) - SYSTEM_ROLE_ORDER.indexOf(b.name));
    const custom = roles.filter((r) => !r.isSystem).sort((a, b) => a.name.localeCompare(b.name));

    return [...system, ...custom].map((r): RoleOption => {
      const meta = SYSTEM_ROLE_META[r.name];
      const count = r.permissions.length;
      return {
        id: r.name,
        name: meta?.label ?? r.name,
        description:
          meta?.description ?? `Custom role · ${String(count)} permission${count === 1 ? '' : 's'}`,
        color: meta?.color ?? 'var(--brand-primary)',
      };
    });
  }, [roles, error]);

  return { roleOptions, error };
}
