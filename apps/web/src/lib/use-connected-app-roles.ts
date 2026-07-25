'use client';

import { useEffect, useState } from 'react';

export interface ConnectedAppRole {
  id: string;
  name: string;
  appName: string;
  memberCount: number;
}

/**
 * Load the roles defined by the tenant's connected app (e.g. Riogentix), if
 * any. Returns an empty array — not null — once resolved with no connected
 * app, so callers can tell "still loading" apart from "nothing to show".
 */
export function useConnectedAppRoles(tenantSlug?: string): {
  appRoles: ConnectedAppRole[] | null;
  error: string | null;
} {
  const [appRoles, setAppRoles] = useState<ConnectedAppRole[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/team/app-roles', {
      headers: tenantSlug ? { 'x-tenant-slug': tenantSlug } : {},
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(`Failed to load app roles (${String(res.status)})`);
        return (await res.json()) as ConnectedAppRole[];
      })
      .then((data) => {
        if (!cancelled) setAppRoles(data);
      })
      .catch(() => {
        if (!cancelled) {
          setError('Could not load connected app roles');
          setAppRoles([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [tenantSlug]);

  return { appRoles, error };
}
