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
  free: { text: 'Free', color: 'rgba(255,255,255,0.4)' },
  pro: { text: 'Pro', color: '#6A9DFF' },
  enterprise: { text: 'Enterprise', color: '#C08AFF' },
};

function switchToWorkspace(slug: string) {
  const host = window.location.host;
  const parts = host.split('.');
  if (parts.length >= 3) {
    parts[0] = slug;
    window.location.href = `${window.location.protocol}//${parts.join('.')}/dashboard`;
  } else {
    window.location.href = `/dashboard?ws=${slug}`;
  }
}

export function WorkspaceSwitcher({ currentName, currentSlug }: WorkspaceSwitcherProps) {
  const [open, setOpen] = useState(false);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const fetchWorkspaces = useCallback(async () => {
    if (workspaces.length > 0) return;
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

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
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
      {/* Trigger — styled for dark sidebar */}
      <button
        onClick={handleToggle}
        className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 transition-all"
        style={{ background: 'var(--sidebar-item-hover)' }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.1)';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.background = 'var(--sidebar-item-hover)';
        }}
      >
        <div
          className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md text-xs font-bold text-white"
          style={{ background: 'var(--brand-primary)' }}
        >
          {currentName[0]?.toUpperCase()}
        </div>
        <div className="min-w-0 flex-1 text-left">
          <div
            className="truncate text-[12px] font-semibold"
            style={{ color: 'rgba(255,255,255,0.85)' }}
          >
            {currentName}
          </div>
          {currentSlug && (
            <div className="truncate text-[10px]" style={{ color: 'var(--sidebar-text)' }}>
              {currentSlug}
            </div>
          )}
        </div>
        <svg
          viewBox="0 0 20 20"
          fill="currentColor"
          className="ml-auto h-3.5 w-3.5 flex-shrink-0 transition-transform"
          style={{
            color: 'var(--sidebar-text)',
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

      {/* Dropdown — styled for light surface, positioned below the trigger */}
      {open && (
        <div
          className="absolute left-0 top-full z-50 mt-1.5 w-64 overflow-hidden rounded-xl border"
          style={{
            background: 'var(--bg-white)',
            borderColor: 'var(--border-light)',
            boxShadow: 'var(--shadow-lg)',
          }}
        >
          {/* Header */}
          <div
            className="border-b px-4 py-2"
            style={{ borderColor: 'var(--border-light)', background: 'var(--bg-main)' }}
          >
            <span
              className="text-[10px] font-bold uppercase tracking-widest"
              style={{ color: 'var(--text-muted)' }}
            >
              Switch workspace
            </span>
          </div>

          {/* List */}
          <div className="max-h-60 overflow-y-auto py-1">
            {loading ? (
              <div className="space-y-2 px-3 py-3">
                {Array.from({ length: 2 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-9 animate-pulse rounded-lg"
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
                    className="mx-1 flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left transition-colors"
                    style={{
                      width: 'calc(100% - 8px)',
                      cursor: isCurrent ? 'default' : 'pointer',
                      background: isCurrent ? 'rgba(79,123,255,0.06)' : 'transparent',
                    }}
                    onMouseEnter={(e) => {
                      if (!isCurrent)
                        (e.currentTarget as HTMLElement).style.background = 'var(--bg-subtle)';
                    }}
                    onMouseLeave={(e) => {
                      if (!isCurrent)
                        (e.currentTarget as HTMLElement).style.background = 'transparent';
                    }}
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
                        className="truncate text-xs font-semibold"
                        style={{ color: 'var(--text-primary)' }}
                      >
                        {ws.tenantName}
                        {isCurrent && (
                          <span
                            className="ml-1.5 rounded px-1 py-0.5 text-[10px] font-bold"
                            style={{
                              background: 'rgba(79,123,255,0.1)',
                              color: 'var(--brand-primary)',
                            }}
                          >
                            current
                          </span>
                        )}
                      </div>
                      <div className="text-[10px]" style={{ color: badge.color }}>
                        {ws.tenantSlug} · {badge.text}
                      </div>
                    </div>
                    {!isCurrent && (
                      <svg
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        className="h-3.5 w-3.5 flex-shrink-0"
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

          {/* Footer */}
          <div
         