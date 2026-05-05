'use client';

import { type CSSProperties, useState, useTransition } from 'react';

interface UpgradePlanButtonProps {
  planCode: string;
  label: string;
  className?: string;
  style?: CSSProperties;
  disabled?: boolean;
}

export function UpgradePlanButton({
  planCode,
  label,
  className,
  style,
  disabled,
}: UpgradePlanButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch('/api/billing/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ planCode }),
        });
        const data = (await res.json()) as { url?: string; error?: string };
        if (data.url) {
          window.location.href = data.url;
        } else {
          setError(data.error ?? 'Something went wrong');
        }
      } catch {
        setError('Failed to start checkout. Please try again.');
      }
    });
  }

  return (
    <div>
      <button
        onClick={handleClick}
        disabled={disabled ?? isPending}
        className={className}
        style={style}
      >
        {isPending ? 'Redirecting…' : label}
      </button>
      {error && <p className="mt-1 text-center text-xs text-red-600">{error}</p>}
    </div>
  );
}

interface ManageSubscriptionButtonProps {
  label?: string;
  className?: string;
  style?: CSSProperties;
}

export function ManageSubscriptionButton({
  label = 'Manage subscription',
  className,
  style,
}: ManageSubscriptionButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch('/api/billing/portal', { method: 'POST' });
        const data = (await res.json()) as { url?: string; error?: string };
        if (data.url) {
          window.location.href = data.url;
        } else {
          setError(data.error ?? 'Something went wrong');
        }
      } catch {
        setError('Failed to open portal. Please try again.');
      }
    });
  }

  return (
    <div>
      <button onClick={handleClick} disabled={isPending} className={className} style={style}>
        {isPending ? 'Redirecting…' : label}
      </button>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
