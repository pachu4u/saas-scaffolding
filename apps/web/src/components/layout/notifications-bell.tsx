'use client';

import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { activityTypeConfig, type ActivityType } from '@/lib/audit-activity';
import { timeAgo } from '@/lib/time';

interface NotificationItem {
  id: string;
  action: string;
  type: ActivityType;
  subject: string;
  actor: string;
  occurredAt: string;
}

export function NotificationsBell() {
  const pathname = usePathname();
  const tenantBase = /^(\/t\/[^/]+)/.exec(pathname)?.[1] ?? '';
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/notifications');
      if (res.ok) {
        const json = (await res.json()) as { items?: NotificationItem[]; unreadCount?: number };
        setItems(json.items ?? []);
        setUnreadCount(json.unreadCount ?? 0);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // Seed the unread count on mount so the dot reflects reality before the
  // bell is ever clicked. Skipped on platform-admin pages, which have no
  // tenant to scope notifications to.
  useEffect(() => {
    if (!tenantBase) return;
    void fetchNotifications();
  }, [tenantBase, fetchNotifications]);

  if (!tenantBase) return null;

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', onClickOutside);
    return () => {
      document.removeEventListener('mousedown', onClickOutside);
    };
  }, [open]);

  function handleToggle() {
    const next = !open;
    setOpen(next);
    if (next && unreadCount > 0) {
      setUnreadCount(0);
      void fetch('/api/notifications', { method: 'POST' });
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={handleToggle}
        className="relative flex h-8 w-8 items-center justify-center rounded-lg border transition-colors hover:bg-gray-50"
        style={{ borderColor: 'var(--border-light)', color: 'var(--text-secondary)' }}
        title="Notifications"
      >
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
          <path d="M10 2a6 6 0 0 0-6 6v3.586l-.707.707A1 1 0 0 0 4 14h12a1 1 0 0 0 .707-1.707L16 11.586V8a6 6 0 0 0-6-6zm0 16a2 2 0 0 1-2-2h4a2 2 0 0 1-2 2z" />
        </svg>
        {unreadCount > 0 && (
          <span
            className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full"
            style={{ background: 'var(--brand-accent)' }}
          />
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 top-full z-50 mt-1.5 w-80 overflow-hidden rounded-xl border"
          style={{
            background: 'var(--bg-white)',
            borderColor: 'var(--border-light)',
            boxShadow: 'var(--shadow-lg)',
          }}
        >
          <div
            className="border-b px-4 py-2"
            style={{ borderColor: 'var(--border-light)', background: 'var(--bg-main)' }}
          >
            <span
              className="text-[10px] font-bold uppercase tracking-widest"
              style={{ color: 'var(--text-muted)' }}
            >
              Recent activity
            </span>
          </div>

          <div className="max-h-80 overflow-y-auto py-1">
            {loading ? (
              <div className="space-y-2 px-3 py-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-10 animate-pulse rounded-lg"
                    style={{ background: 'var(--bg-subtle)' }}
                  />
                ))}
              </div>
            ) : items.length === 0 ? (
              <div className="px-4 py-6 text-center text-xs" style={{ color: 'var(--text-muted)' }}>
                No activity yet
              </div>
            ) : (
              items.map((item) => {
                const config = activityTypeConfig[item.type];
                return (
                  <div key={item.id} className="mx-1 rounded-lg px-3 py-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span
                        className="text-xs font-semibold"
                        style={{ color: 'var(--text-primary)' }}
                      >
                        {item.action}
                      </span>
                      <Badge variant={config.variant}>{config.label}</Badge>
                    </div>
                    <div className="mt-0.5 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                      {item.subject} · by{' '}
                      <span style={{ color: 'var(--text-secondary)' }}>{item.actor}</span>
                    </div>
                    <div className="mt-0.5 text-[10px]" style={{ color: 'var(--text-muted)' }}>
                      {timeAgo(new Date(item.occurredAt))}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <a
            href={`${tenantBase}/admin/audit`}
            className="block border-t px-4 py-2 text-center text-xs font-semibold hover:underline"
            style={{ borderColor: 'var(--border-light)', color: 'var(--brand-primary)' }}
          >
            View full audit log
          </a>
        </div>
      )}
    </div>
  );
}
