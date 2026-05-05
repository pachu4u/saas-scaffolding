'use client';

import { useRef, useState, useTransition } from 'react';

interface Member {
  userId: string;
  name: string;
  email: string;
  currentRole: string;
}

interface ChangeRoleModalProps {
  member: Member;
  onClose: () => void;
  onSuccess?: () => void;
}

const ROLES = [
  { id: 'tenant_admin', name: 'Admin', description: 'Full workspace control', color: '#B06CFF' },
  {
    id: 'tenant_billing_admin',
    name: 'Billing Admin',
    description: 'Billing management only',
    color: 'var(--brand-primary)',
  },
  {
    id: 'tenant_user',
    name: 'Member',
    description: 'Standard access',
    color: 'var(--text-secondary)',
  },
  {
    id: 'tenant_viewer',
    name: 'Viewer',
    description: 'Read-only access',
    color: 'var(--text-muted)',
  },
];

export function ChangeRoleModal({ member, onClose, onSuccess }: ChangeRoleModalProps) {
  const [selectedRole, setSelectedRole] = useState(member.currentRole);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  function handleOverlayClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === overlayRef.current) onClose();
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (selectedRole === member.currentRole) {
      onClose();
      return;
    }

    startTransition(async () => {
      try {
        const res = await fetch(`/api/team/members/${member.userId}/role`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ roleId: selectedRole }),
        });
        if (res.ok) {
          onSuccess?.();
          onClose();
        } else {
          const data = (await res.json()) as { error?: string };
          setError(data.error ?? 'Failed to update role');
        }
      } catch {
        setError('Something went wrong. Please try again.');
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
        className="w-full max-w-md overflow-hidden rounded-xl border"
        style={{
          background: 'var(--bg-white)',
          borderColor: 'var(--border-light)',
          boxShadow: 'var(--shadow-card)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between border-b px-6 py-5"
          style={{ borderColor: 'var(--border-light)' }}
        >
          <div>
            <h2 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>
              Change role
            </h2>
            <p className="mt-0.5 text-xs" style={{ color: 'var(--text-muted)' }}>
              Update permissions for {member.name}
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

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 px-6 py-5">
            {/* Member info */}
            <div
              className="flex items-center gap-3 rounded-xl p-3"
              style={{ background: 'var(--bg-main)' }}
            >
              <div className="brand-gradient flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold text-white">
                {member.name[0]?.toUpperCase() ?? member.email[0]?.toUpperCase()}
              </div>
              <div>
                <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                  {member.name}
                </div>
                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {member.email}
                </div>
              </div>
            </div>

            {/* Role picker */}
            <div>
              <label
                className="mb-2 block text-xs font-semibold"
                style={{ color: 'var(--text-secondary)' }}
              >
                Select role
              </label>
              <div className="space-y-2">
                {ROLES.map((role) => {
                  const isSelected = selectedRole === role.id;
                  const isCurrent = member.currentRole === role.id;
                  return (
                    <label
                      key={role.id}
                      className="flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition-all"
                      style={
                        isSelected
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
                        checked={isSelected}
                        onChange={() => setSelectedRole(role.id)}
                        className="sr-only"
                      />
                      <div
                        className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full border-2"
                        style={
                          isSelected
                            ? { borderColor: 'var(--brand-primary)' }
                            : { borderColor: 'var(--border-default)' }
                        }
                      >
                        {isSelected && (
                          <div
                            className="h-2 w-2 rounded-full"
                            style={{ background: 'var(--brand-primary)' }}
                          />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span
                            className="text-sm font-semibold"
                            style={{ color: 'var(--text-primary)' }}
                          >
                            {role.name}
                          </span>
                          {isCurrent && (
                            <span
                              className="rounded px-1.5 py-0.5 text-xs font-semibold"
                              style={{ background: 'var(--bg-subtle)', color: 'var(--text-muted)' }}
                            >
                              Current
                            </span>
                          )}
                        </div>
                        <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                          {role.description}
                        </div>
                      </div>
                      <div
                        className="h-2 w-2 flex-shrink-0 rounded-full"
                        style={{ background: role.color }}
                      />
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Error */}
            {error && <p className="px-1 text-xs text-red-600">{error}</p>}
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
              disabled={isPending}
              className="brand-gradient rounded-xl px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {isPending
                ? 'Saving…'
                : selectedRole === member.currentRole
                  ? 'No change'
                  : 'Update role'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
