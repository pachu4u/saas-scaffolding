'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

interface Workspace {
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  plan: string;
  status: string;
}

interface WorkspaceSwitcherProps {
  currentName: string;
  currentSlug?: string;
}

const PLAN_BADGE: Record<string, { text: string; color: string }> = {
  free: { text: 'Free', color: 'var(--text-muted)' },
  pro: { text: 'Pro', color: 'var(--brand-primary)' },
  enterprise: { text: 'Enterprise', color: '#B06CFF' },
};

function switchToWorkspace(slug: string) {
  // In subdomain-based deployments, navigate to the other subdomain.
  // In dev (localhost / no subdomain), update NEXT_PUBLIC_DEFAULT_TENANT_SLUG
  // isn't possible at runtime — instead we hit the workspace URL directly.
  const host = window.location.host; // e.g. "acme.app.riogentix.com" or "localhost:3000"
  const parts = host.split('.');
  if (parts.length >= 3) {
    // Subdomain deployment: swap first label
    parts[0] = slug;
    window.location.href = `${window.location.protocol}//${parts.join('.')}/dashboard`;
  } else {
    // Dev / localhost: append slug as search param so middleware can pick it up
    // (or just navigate — the env var controls the workspace anyway in dev)
    window.location.href = `/dashboard?ws=${slug}`;
  }
}

export function WorkspaceSwitcher({ currentName, currentSlug }: WorkspaceSwitcherProps) {
  const [open, setOpen] = useState(false);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const fetchWorkspaces = useCallback(async () => {
    if (workspaces.length > 0) return; // already loaded
    setLoading(true);
    try {
      const res = await fetch('/api/users/me');
      if (res.ok) {
        const json = (await res.json()) as { workspaces?: Workspace[] };
        setWorkspaces(json.workspaces ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [workspaces.length]);

  // Close on outside click
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open]);

  function handleToggle() {
    if (!open) void fetchWorkspaces();
    setOpen((v) => !v);
  }

  return (
    <div className="relative" ref={ref}>
      {/* Trigger */}
      <button
        onClick={handleToggle}
        className="hover:bg-bg-subtle flex w-full cursor-pointer items-center gap-2 rounded-xl px-2.5 py-2 transition-colors"
        style={{ background: 'var(--bg-main)' }}
      >
        <div
          className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md text-xs font-bold text-white"
          style={{ background: 'var(--brand-secondary)' }}
        >
          {currentName[0]?.toUpperCase()}
        </div>
        <div className="min-w-0 flex-1 text-left">
          <div className="truncate text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
            {currentName}
          </div>
          {currentSlug && (
            <div className="truncate text-xs" style={{ color: 'var(--text-muted)' }}>
              {currentSlug}.app
            </div>
          )}
        </div>
        <svg
          viewBox="0 0 20 20"
          fill="currentColor"
          className="ml-auto h-4 w-4 flex-shrink-0 transition-transform"
          style={{
            color: 'var(--text-muted)',
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
          }}
        >
          <path
            fillRule="evenodd"
            d="M5.293 7.293a1 1 0 0 1 1.414 0L10 10.586l3.293-3.293a1 1 0 1 1 1.414 1.414l-4 4a1 1 0 0 1-1.414 0l-4-4a1 1 0 0 1 0-1.414z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {/* Dropdown */}
      {open && (
        <div
          className="absolute left-0 top-full z-50 mt-1.5 w-64 overflow-hidden rounded-2xl border"
          style={{
            background: 'var(--bg-white)',
            borderColor: 'var(--border-light)',
            boxShadow: 'var(--shadow-brand)',
          }}
        >
          {/* Header */}
          <div
            className="border-b px-4 py-2.5"
            style={{ borderColor: 'var(--border-light)', background: 'var(--bg-main)' }}
          >
            <span
              className="text-xs font-bold uppercase tracking-wide"
              style={{ color: 'var(--text-muted)' }}
            >
              Switch workspace
            </span>
          </div>

          {/* Workspace list */}
          <div className="max-h-60 overflow-y-auto py-1">
            {loading ? (
              <div className="px-4 py-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div
                    key={i}
                    className="mb-2 h-9 animate-pulse rounded-xl"
                    style={{ background: 'var(--bg-subtle)' }}
                  />
                ))}
              </div>
            ) : workspaces.length === 0 ? (
              <div className="px-4 py-4 text-center text-xs" style={{ color: 'var(--text-muted)' }}>
                No other workspaces
              </div>
            ) : (
              workspaces.map((ws) => {
                const isCurrent = ws.tenantSlug === currentSlug;
                const badge = PLAN_BADGE[ws.plan] ?? PLAN_BADGE.free!;
                return (
                  <button
                    key={ws.tenantId}
                    onClick={() => {
                      if (!isCurrent) switchToWorkspace(ws.tenantSlug);
                      setOpen(false);
                    }}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-gray-50"
                    style={{ cursor: isCurrent ? 'default' : 'pointer' }}
                  >
                    <div
                      className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white"
                      style={{
                        background: isCurrent ? 'var(--brand-primary)' : 'var(--border-default)',
                      }}
                    >
                      {ws.tenantName[0]?.toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div
                        className="flex items-center gap-1.5 truncate text-sm font-semibold"
                        style={{ color: 'var(--text-primary)' }}
                      >
                        {ws.tenantName}
                        {isCurrent && (
                          <span
                            className="rounded px-1.5 py-0.5 text-xs font-bold"
                            style={{
                              background: 'rgba(79,123,255,0.1)',
                              color: 'var(--brand-primary)',
                            }}
                          >
                            current
                          </span>
                        )}
                      </div>
                      <div
                        className="flex items-center gap-1 text-xs"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        <span>{ws.tenantSlug}</span>
                        <span>·</span>
                        <span style={{ color: badge.color }}>{badge.text}</span>
                      </div>
                    </div>
                    {!isCurrent && (
                      <svg
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        className="h-4 w-4 flex-shrink-0"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        <path
                          fillRule="evenodd"
                          d="M7.293 14.707a1 1 0 0 1 0-1.414L10.586 10 7.293 6.707a1 1 0 0 1 1.414-1.414l4 4a1 1 0 0 1 0 1.414l-4 4a1 1 0 0 1-1.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    )}
                  </button>
                );
              })
            )}
          </div>

          {/* Footer actions */}
          <div
            className="border-t px-4 py-3"
            style={{ borderColor: 'var(--border-light)', background: 'var(--bg-main)' }}
          >
            <a
              href="/onboarding"
              className="flex items-center gap-2 text-xs font-semibold transition-colors hover:opacity-80"
              style={{ color: 'var(--brand-primary)' }}
              onClick={() => setOpen(false)}
            >
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                <path
                  fillRule="evenodd"
                  d="M10 3a1 1 0 0 1 1 1v5h5a1 1 0 1 1 0 2h-5v5a1 1 0 1 1-2 0v-5H4a1 1 0 1 1 0-2h5V4a1 1 0 0 1 1-1z"
                  clipRule="evenodd"
                />
              </svg>
              Create new workspace
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
