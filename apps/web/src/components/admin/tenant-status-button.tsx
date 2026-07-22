'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';

export function TenantStatusButton({
  tenantId,
  currentStatus,
}: {
  tenantId: string;
  currentStatus: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const isSuspended = currentStatus === 'SUSPENDED';
  const action = isSuspended ? 'reinstate' : 'suspend';

  function handleClick() {
    startTransition(async () => {
      await fetch(`/api/admin/tenants/${tenantId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      router.refresh();
    });
  }

  if (isSuspended) {
    return (
      <button
        onClick={handleClick}
        disabled={isPending}
        className="hover:bg-bg-subtle rounded-lg border px-2 py-1 text-xs transition-colors disabled:opacity-50"
        style={{ borderColor: 'var(--border-light)', color: 'var(--text-secondary)' }}
      >
        {isPending ? '…' : 'Reinstate'}
      </button>
    );
  }

  return (
    <button
      onClick={handleClick}
      disabled={isPending}
      className="rounded-lg border border-red-100 bg-red-50 px-2 py-1 text-xs text-red-600 transition-colors hover:bg-red-100 disabled:opacity-50"
    >
      {isPending ? '…' : 'Suspend'}
    </button>
  );
}

export function TenantDeleteButton({
  tenantId,
  tenantName,
  currentStatus,
}: {
  tenantId: string;
  tenantName: string;
  currentStatus: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  if (currentStatus === 'DELETED') return null;

  function handleClick() {
    if (
      !window.confirm(
        `Delete tenant "${tenantName}"? This tears down its app/infrastructure. Tenant data is retained and this can't be undone from here.`,
      )
    ) {
      return;
    }
    startTransition(async () => {
      await fetch(`/api/admin/tenants/${tenantId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete' }),
      });
      router.refresh();
    });
  }

  return (
    <button
      onClick={handleClick}
      disabled={isPending}
      className="rounded-lg border border-red-200 bg-white px-2 py-1 text-xs text-red-700 transition-colors hover:bg-red-50 disabled:opacity-50"
      title="Delete tenant and tear down its app"
    >
      {isPending ? '…' : 'Delete'}
    </button>
  );
}
