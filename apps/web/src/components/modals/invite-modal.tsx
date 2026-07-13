'use client';

import { useRef, useState, useTransition } from 'react';

interface InviteModalProps {
  onClose: () => void;
  tenantSlug: string;
}

const ROLES = [
  { id: 'tenant_admin', name: 'Admin', description: 'Full workspace control' },
  { id: 'tenant_billing_admin', name: 'Billing Admin', description: 'Billing management only' },
  { id: 'tenant_user', name: 'Member', description: 'Standard access' },
  { id: 'tenant_viewer', name: 'Viewer', description: 'Read-only access' },
];

export function InviteModal({ onClose, tenantSlug }: InviteModalProps) {
  const [email, setEmail] = useState('');
  const [roleId, setRoleId] = useState('tenant_user');
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{ success?: boolean; error?: string } | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  function handleOverlayClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === overlayRef.current) onClose();
  }

  function handleSubmit(e: React.SyntheticEvent) {
    e.preventDefault();
    if (!email) return;

    startTransition(async () => {
      try {
        const res = await fetch('/api/team/invite', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-tenant-slug': tenantSlug,
          },
          body: JSON.stringify({ email, roleId }),
        });
        const data = (await res.json()) as { success?: boolean; error?: string };
        setResult(data);
      } catch {
        setResult({ error: 'Something went wrong. Please try again.' });
      }
    });
  }

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}
      onClick={handleOverlayClick}
    >
      <div
        className="flex w-full max-w-md flex-col overflow-hidden rounded-xl border"
        style={{
          background: 'var(--bg-white)',
          borderColor: 'var(--border-light)',
          boxShadow: 'var(--shadow-card)',
          maxHeight: '90vh',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between border-b px-6 py-5"
          style={{ borderColor: 'var(--border-light)' }}
        >
          <div>
            <h2 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>
              Invite team member
            </h2>
            <p className="mt-0.5 text-xs" style={{ color: 'var(--text-muted)' }}>
              They&apos;ll receive an email with a link to join.
            </p>
          </div>
          <button
            onClick={onClose}
            className="hover:bg-bg-subtle flex h-8 w-8 items-center justify-center rounded-lg transition-colors"
            style={{ color: 'var(--text-muted)' }}
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 0 1 1.414 0L10 8.586l4.293-4.293a1 1 0 1 1 1.414 1.414L11.414 10l4.293 4.293a1 1 0 0 1-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 0 1-1.414-1.414L8.586 10 4.293 5.707a1 1 0 0 1 0-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>

        {result?.success ? (
          <div className="px-6 py-10 text-center">
            <div
              className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-xl"
              style={{ background: 'rgba(22,163,74,0.1)' }}
            >
              <svg
                viewBox="0 0 20 20"
                fill="currentColor"
                className="h-7 w-7"
                style={{ color: 'var(--status-success)' }}
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16zm3.707-9.293a1 1 0 0 0-1.414-1.414L9 10.586 7.707 9.293a1 1 0 0 0-1.414 1.414l2 2a1 1 0 0 0 1.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <h3 className="mb-1 text-base font-bold" style={{ color: 'var(--text-primary)' }}>
              Invitation sent!
            </h3>
            <p className="mb-6 text-sm" style={{ color: 'var(--text-secondary)' }}>
              We&apos;ve emailed <strong>{email}</strong> with a link to join the workspace.
            </p>
            <button
              onClick={onClose}
              className="brand-gradient rounded-xl px-6 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
            <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
              {/* Email */}
              <div>
                <label
                  className="mb-1.5 block text-xs font-semibold"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  Email address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                  }}
                  placeholder="colleague@example.com"
                  required
                  className="focus:border-brand-primary w-full rounded-xl border px-4 py-2.5 text-sm outline-none transition-colors"
                  style={{
                    borderColor: 'var(--border-light)',
                    background: 'var(--bg-main)',
                    color: 'var(--text-primary)',
                  }}
                />
              </div>

              {/* Role */}
              <div>
                <label
                  className="mb-1.5 block text-xs font-semibold"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  Role
                </label>
                <div className="space-y-2">
                  {ROLES.map((role) => (
                    <label
                      key={role.id}
                      className="flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition-all"
                      style={
                        roleId === role.id
                          ? {
                              borderColor: 'var(--brand-primary)',
                              background: 'rgba(79,123,255,0.05)',
                            }
                          : { borderColor: 'var(--border-light)', background: 'var(--bg-main)' }
                      }
                    >
                      <input
                        type="radio"
                        name="role"
                        value={role.id}
                        checked={roleId === role.id}
                        onChange={() => {
                          setRoleId(role.id);
                        }}
                        className="sr-only"
                      />
                      <div
                        className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full border-2"
                        style={
                          roleId === role.id
                            ? { borderColor: 'var(--brand-primary)' }
                            : { borderColor: 'var(--border-default)' }
                        }
                      >
                        {roleId === role.id && (
                          <div
                            className="h-2 w-2 rounded-full"
                            style={{ background: 'var(--brand-primary)' }}
                          />
                        )}
                      </div>
                      <div>
                        <div
                          className="text-sm font-semibold"
                          style={{ color: 'var(--text-primary)' }}
                        >
                          {role.name}
                        </div>
                        <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                          {role.description}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Error */}
              {result?.error && <p className="px-1 text-xs text-red-600">{result.error}</p>}
            </div>

            {/* Footer */}
            <div
              className="flex items-center justify-end gap-3 border-t px-6 py-4"
              style={{ borderColor: 'var(--border-light)' }}
            >
              <button
                type="button"
                onClick={onClose}
                className="hover:bg-bg-subtle rounded-xl border px-4 py-2 text-sm font-semibold transition-colors"
                style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isPending || !email}
                className="brand-gradient rounded-xl px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {isPending ? 'Sending…' : 'Send invite'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
