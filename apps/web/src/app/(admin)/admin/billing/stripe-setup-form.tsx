'use client';

import { useEffect, useState, useTransition } from 'react';

interface PlanRow {
  code: string;
  name: string;
  priceIdStripe: string | null;
}

interface StatusResponse {
  configured: boolean;
  publishableKey: string | null;
  webhookConfigured: boolean;
  mode: 'live' | 'test';
  plans: PlanRow[];
}

function fieldStyle() {
  return {
    borderColor: 'var(--border-default)',
    background: 'var(--bg-main)',
    color: 'var(--text-primary)',
  };
}

export function StripeSetupForm() {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [secretKey, setSecretKey] = useState('');
  const [publishableKey, setPublishableKey] = useState('');
  const [webhookSecret, setWebhookSecret] = useState('');
  const [proPriceUsd, setProPriceUsd] = useState('29');
  const [enterprisePriceUsd, setEnterprisePriceUsd] = useState('99');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  function loadStatus() {
    fetch('/api/admin/billing')
      .then((res) => res.json() as Promise<StatusResponse>)
      .then(setStatus)
      .catch(() => {
        setStatus(null);
      });
  }

  useEffect(() => {
    loadStatus();
  }, []);

  function save() {
    setMsg(null);
    startTransition(async () => {
      try {
        const res = await fetch('/api/admin/billing', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            secretKey,
            publishableKey,
            webhookSecret: webhookSecret || undefined,
            proPriceUsd: proPriceUsd ? Number(proPriceUsd) : undefined,
            enterprisePriceUsd: enterprisePriceUsd ? Number(enterprisePriceUsd) : undefined,
          }),
        });
        const json = (await res.json()) as { ok?: boolean; error?: string };
        if (json.ok) {
          setMsg({ ok: true, text: 'Stripe connected — plans and webhook synced.' });
          setSecretKey('');
          setWebhookSecret('');
          loadStatus();
        } else {
          setMsg({ ok: false, text: json.error ?? 'Failed to save' });
        }
      } catch {
        setMsg({ ok: false, text: 'Request failed' });
      }
    });
  }

  return (
    <div className="max-w-2xl space-y-6">
      {/* Status */}
      <div
        className="rounded-xl border p-5"
        style={{
          background: 'var(--bg-white)',
          borderColor: 'var(--border-light)',
          boxShadow: 'var(--shadow-card)',
        }}
      >
        <h2 className="mb-3 text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
          Current status
        </h2>
        {status ? (
          <div className="space-y-1.5 text-sm" style={{ color: 'var(--text-secondary)' }}>
            <div>
              Stripe:{' '}
              {status.configured ? `connected (${status.publishableKey ?? ''})` : 'not connected'}
            </div>
            <div>Webhook: {status.webhookConfigured ? 'registered' : 'not registered'}</div>
            {status.plans.map((p) => (
              <div key={p.code}>
                {p.name}: {p.priceIdStripe ?? 'no price configured'}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Loading…
          </p>
        )}
      </div>

      {/* Setup form */}
      <div
        className="rounded-xl border"
        style={{
          background: 'var(--bg-white)',
          borderColor: 'var(--border-light)',
          boxShadow: 'var(--shadow-card)',
        }}
      >
        <div className="space-y-5 p-6">
          <div>
            <label
              className="mb-1.5 block text-xs font-semibold"
              style={{ color: 'var(--text-secondary)' }}
            >
              Stripe secret key
            </label>
            <input
              type="password"
              value={secretKey}
              onChange={(e) => {
                setSecretKey(e.target.value);
              }}
              placeholder="sk_test_…"
              autoComplete="off"
              className="w-full rounded-xl border px-3 py-2 font-mono text-sm outline-none"
              style={fieldStyle()}
            />
          </div>
          <div>
            <label
              className="mb-1.5 block text-xs font-semibold"
              style={{ color: 'var(--text-secondary)' }}
            >
              Stripe publishable key
            </label>
            <input
              type="text"
              value={publishableKey}
              onChange={(e) => {
                setPublishableKey(e.target.value);
              }}
              placeholder="pk_test_…"
              autoComplete="off"
              className="w-full rounded-xl border px-3 py-2 font-mono text-sm outline-none"
              style={fieldStyle()}
            />
          </div>
          <div>
            <label
              className="mb-1.5 block text-xs font-semibold"
              style={{ color: 'var(--text-secondary)' }}
            >
              Webhook signing secret (optional)
            </label>
            <input
              type="password"
              value={webhookSecret}
              onChange={(e) => {
                setWebhookSecret(e.target.value);
              }}
              placeholder="Leave blank to auto-register the webhook endpoint"
              autoComplete="off"
              className="w-full rounded-xl border px-3 py-2 font-mono text-sm outline-none"
              style={fieldStyle()}
            />
          </div>
          <div className="grid grid-cols-2 gap-5">
            <div>
              <label
                className="mb-1.5 block text-xs font-semibold"
                style={{ color: 'var(--text-secondary)' }}
              >
                Pro plan ($/month)
              </label>
              <input
                type="number"
                min="0"
                step="1"
                value={proPriceUsd}
                onChange={(e) => {
                  setProPriceUsd(e.target.value);
                }}
                className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
                style={fieldStyle()}
              />
            </div>
            <div>
              <label
                className="mb-1.5 block text-xs font-semibold"
                style={{ color: 'var(--text-secondary)' }}
              >
                Enterprise plan ($/month)
              </label>
              <input
                type="number"
                min="0"
                step="1"
                value={enterprisePriceUsd}
                onChange={(e) => {
                  setEnterprisePriceUsd(e.target.value);
                }}
                className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
                style={fieldStyle()}
              />
            </div>
          </div>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Get {status?.mode === 'test' ? 'test-mode' : 'live'} keys from{' '}
            <a
              href={`https://dashboard.stripe.com/${status?.mode === 'test' ? 'test/' : ''}apikeys`}
              target="_blank"
              rel="noreferrer"
              className="underline"
            >
              dashboard.stripe.com/{status?.mode === 'test' ? 'test/' : ''}apikeys
            </a>
            . Saving creates/updates a Stripe Product + Price for each plan priced above and stores
            everything in Vault — nothing is written to disk or logs.
          </p>
        </div>
        {msg && (
          <div
            className="border-t px-6 py-3 text-xs"
            style={{
              borderColor: 'var(--border-light)',
              color: msg.ok ? 'var(--status-success)' : '#ef4444',
            }}
          >
            {msg.text}
          </div>
        )}
        <div
          className="flex justify-end border-t px-6 py-4"
          style={{ borderColor: 'var(--border-light)' }}
        >
          <button
            onClick={save}
            disabled={isPending || !secretKey || !publishableKey}
            className="brand-gradient rounded-xl px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {isPending ? 'Saving…' : 'Save & sync to Stripe'}
          </button>
        </div>
      </div>
    </div>
  );
}
