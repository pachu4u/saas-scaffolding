'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useState } from 'react';

interface AuditFiltersProps {
  initialAction: string;
  initialActor: string;
  initialResource: string;
  initialFrom: string;
  initialTo: string;
}

export function AuditFilters({
  initialAction,
  initialActor,
  initialResource,
  initialFrom,
  initialTo,
}: AuditFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();

  const [action, setAction] = useState(initialAction);
  const [actor, setActor] = useState(initialActor);
  const [resource, setResource] = useState(initialResource);
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);

  function applyFilters() {
    const params = new URLSearchParams();
    if (action.trim()) params.set('action', action.trim());
    if (actor.trim()) params.set('actor', actor.trim());
    if (resource.trim()) params.set('resource', resource.trim());
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') applyFilters();
  }

  const inputStyle = {
    borderColor: 'var(--border-default)',
    background: 'var(--bg-main)',
    color: 'var(--text-primary)',
  };

  return (
    <div
      className="rounded-xl border p-4"
      style={{
        background: 'var(--bg-white)',
        borderColor: 'var(--border-light)',
        boxShadow: 'var(--shadow-card)',
      }}
    >
      <div className="mb-3 flex items-center justify-between">
        <span
          className="text-xs font-bold uppercase tracking-wide"
          style={{ color: 'var(--text-muted)' }}
        >
          Filters
        </span>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div>
          <label
            className="mb-1 block text-xs font-semibold"
            style={{ color: 'var(--text-secondary)' }}
          >
            Action
          </label>
          <input
            type="text"
            value={action}
            onChange={(e) => setAction(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="e.g. member.invited"
            className="w-full rounded-lg border px-2.5 py-1.5 text-xs outline-none"
            style={inputStyle}
          />
        </div>
        <div>
          <label
            className="mb-1 block text-xs font-semibold"
            style={{ color: 'var(--text-secondary)' }}
          >
            Actor email
          </label>
          <input
            type="text"
            value={actor}
            onChange={(e) => setActor(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="user@example.com"
            className="w-full rounded-lg border px-2.5 py-1.5 text-xs outline-none"
            style={inputStyle}
          />
        </div>
        <div>
          <label
            className="mb-1 block text-xs font-semibold"
            style={{ color: 'var(--text-secondary)' }}
          >
            Resource type
          </label>
          <input
            type="text"
            value={resource}
            onChange={(e) => setResource(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="e.g. user, Tenant"
            className="w-full rounded-lg border px-2.5 py-1.5 text-xs outline-none"
            style={inputStyle}
          />
        </div>
        <div>
          <label
            className="mb-1 block text-xs font-semibold"
            style={{ color: 'var(--text-secondary)' }}
          >
            From date
          </label>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="w-full rounded-lg border px-2.5 py-1.5 text-xs outline-none"
            style={inputStyle}
          />
        </div>
        <div>
          <label
            className="mb-1 block text-xs font-semibold"
            style={{ color: 'var(--text-secondary)' }}
          >
            To date
          </label>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="w-full rounded-lg border px-2.5 py-1.5 text-xs outline-none"
            style={inputStyle}
          />
        </div>
      </div>
      <div className="mt-3 flex justify-end">
        <button
          onClick={applyFilters}
          className="brand-gradient rounded-lg px-4 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90"
        >
          Apply filters
        </button>
      </div>
    </div>
  );
}
