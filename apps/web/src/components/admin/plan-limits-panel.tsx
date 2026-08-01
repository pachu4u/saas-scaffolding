'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

const PLANS = ['free', 'pro', 'enterprise'] as const;
type Plan = (typeof PLANS)[number];

interface ResourceLimits {
  flows?: number | null;
  storageBytes?: number | null;
  apiKeys?: number | null;
  seats?: number | null;
}

type LimitField = 'flows' | 'storageBytes' | 'apiKeys' | 'seats';

const LIMIT_FIELDS: { key: LimitField; label: string; hint: string }[] = [
  { key: 'flows', label: 'Flows', hint: 'Max flows the tenant can create' },
  { key: 'storageBytes', label: 'Storage (bytes)', hint: 'Max file-storage bytes' },
  { key: 'apiKeys', label: 'API keys', hint: 'Max API keys' },
  { key: 'seats', label: 'Seats', hint: 'Max members' },
];

/**
 * Plan + per-tenant resource-limit overrides. Mirrors the PATCH actions on
 * /api/admin/tenants/[id] (`update-plan`, `update-resource-limits`), which
 * persist to tenants.plan / tenants.resource_limits and enqueue the worker
 * sync that pushes them into the tenant's Riogentix instance.
 *
 * Limit semantics: blank input = inherit the plan-tier default (field absent
 * from the JSON), a number = explicit override, and the explicit-`null`
 * "unlimited" case is what an empty value maps to when the field was already
 * set — matching parseResourceLimits on the API side.
 */
export function PlanLimitsPanel({
  tenantId,
  currentPlan,
  currentLimits,
}: {
  tenantId: string;
  currentPlan: string;
  currentLimits: ResourceLimits;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [plan, setPlan] = useState<Plan>(
    (PLANS as readonly string[]).includes(currentPlan) ? (currentPlan as Plan) : 'free',
  );
  const [limits, setLimits] = useState<Record<LimitField, string>>({
    flows: toInput(currentLimits.flows),
    storageBytes: toInput(currentLimits.storageBytes),
    apiKeys: toInput(currentLimits.apiKeys),
    seats: toInput(currentLimits.seats),
  });
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  function toInput(v: number | null | undefined): string {
    return v === undefined || v === null ? '' : String(v);
  }

  async function savePlan() {
    setMessage(null);
    const res = await fetch(`/api/admin/tenants/${tenantId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'update-plan', plan }),
    });
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    setMessage(
      res.ok
        ? { ok: true, text: 'Plan updated and synced to Riogentix.' }
        : { ok: false, text: body.error ?? `Failed (${String(res.status)})` },
    );
    startTransition(() => {
      router.refresh();
    });
  }

  async function saveLimits() {
    setMessage(null);
    const payload: ResourceLimits = {};
    for (const { key } of LIMIT_FIELDS) {
      const raw = limits[key].trim();
      if (raw === '') continue; // inherit tier default — leave field out
      const n = Number(raw);
      if (!Number.isFinite(n) || n < 0) {
        setMessage({ ok: false, text: `Invalid value for ${key}: "${raw}"` });
        return;
      }
      payload[key] = n;
    }
    const res = await fetch(`/api/admin/tenants/${tenantId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'update-resource-limits', resourceLimits: payload }),
    });
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    setMessage(
      res.ok
        ? { ok: true, text: 'Limits saved; Riogentix sync queued.' }
        : { ok: false, text: body.error ?? `Failed (${String(res.status)})` },
    );
    startTransition(() => {
      router.refresh();
    });
  }

  return (
    <div
      className="rounded-xl border p-6"
      style={{
        background: 'var(--bg-white)',
        borderColor: 'var(--border-light)',
        boxShadow: 'var(--shadow-card)',
      }}
    >
      <h2 className="mb-1 text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
        Plan &amp; Resource Limits
      </h2>
      <p className="mb-4 text-xs" style={{ color: 'var(--text-muted)' }}>
        Plan tier and per-tenant quota overrides. Both sync to the tenant&apos;s Riogentix instance;
        an empty limit inherits the tier default.
      </p>

      <div className="grid grid-cols-2 gap-6">
        {/* Plan tier */}
        <div>
          <label
            htmlFor="plan-select"
            className="mb-1 block text-xs font-semibold"
            style={{ color: 'var(--text-muted)' }}
          >
            Plan tier
          </label>
          <div className="flex gap-2">
            <select
              id="plan-select"
              value={plan}
              onChange={(e) => {
                setPlan(e.target.value as Plan);
              }}
              className="flex-1 rounded-lg border px-3 py-1.5 text-xs"
              style={{
                borderColor: 'var(--border-default)',
                color: 'var(--text-primary)',
                background: 'var(--bg-white)',
              }}
            >
              {PLANS.map((p) => (
                <option key={p} value={p}>
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </option>
              ))}
            </select>
            <button
              onClick={() => void savePlan()}
              disabled={isPending}
              className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white transition-colors disabled:opacity-50"
              style={{ background: 'var(--brand-accent)' }}
            >
              {isPending ? '…' : 'Save plan'}
            </button>
          </div>
        </div>

        {/* Resource limit overrides */}
        <div>
          <span className="mb-1 block text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
            Quota overrides
          </span>
          <div className="space-y-2">
            {LIMIT_FIELDS.map(({ key, label, hint }) => (
              <div key={key} className="flex items-center gap-2">
                <label
                  htmlFor={`limit-${key}`}
                  className="w-28 flex-shrink-0 text-xs"
                  style={{ color: 'var(--text-secondary)' }}
                  title={hint}
                >
                  {label}
                </label>
                <input
                  id={`limit-${key}`}
                  type="number"
                  min={0}
                  value={limits[key]}
                  onChange={(e) => {
                    setLimits((s) => ({ ...s, [key]: e.target.value }));
                  }}
                  placeholder="tier default"
                  className="flex-1 rounded-lg border px-3 py-1 text-xs"
                  style={{
                    borderColor: 'var(--border-default)',
                    color: 'var(--text-primary)',
                    background: 'var(--bg-white)',
                  }}
                />
              </div>
            ))}
            <button
              onClick={() => void saveLimits()}
              disabled={isPending}
              className="mt-1 rounded-lg px-3 py-1.5 text-xs font-semibold text-white transition-colors disabled:opacity-50"
              style={{ background: 'var(--brand-accent)' }}
            >
              {isPending ? '…' : 'Save limits'}
            </button>
          </div>
        </div>
      </div>

      {message && (
        <p
          className="mt-4 rounded-lg px-3 py-2 text-xs"
          style={{
            background: message.ok ? 'var(--bg-success, #ecfdf5)' : 'var(--bg-error, #fef2f2)',
            color: message.ok ? 'var(--text-success, #047857)' : 'var(--text-error, #b91c1c)',
          }}
        >
          {message.text}
        </p>
      )}
    </div>
  );
}
