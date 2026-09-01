'use client';

import { useActionState } from 'react';

export type CreateAccountState = { error: string } | null;

const inputClassName = 'w-full rounded-xl border px-3 py-2.5 text-sm outline-none';
const inputStyle = {
  borderColor: 'var(--border-default)',
  background: 'var(--bg-white)',
  color: 'var(--text-primary)',
};

export function CreateAccountForm({
  action,
}: {
  action: (prevState: CreateAccountState, formData: FormData) => Promise<CreateAccountState>;
}) {
  const [state, formAction, isPending] = useActionState<CreateAccountState, FormData>(action, null);

  return (
    <form action={formAction} className="space-y-4 px-8 pb-8 pt-2">
      <div>
        <label
          className="mb-1.5 block text-xs font-semibold"
          style={{ color: 'var(--text-secondary)' }}
        >
          Your name
        </label>
        <input
          name="name"
          type="text"
          required
          placeholder="Jane Doe"
          className={inputClassName}
          style={inputStyle}
        />
      </div>

      <div>
        <label
          className="mb-1.5 block text-xs font-semibold"
          style={{ color: 'var(--text-secondary)' }}
        >
          Password
        </label>
        <input
          name="password"
          type="password"
          required
          placeholder="At least 8 characters"
          className={inputClassName}
          style={inputStyle}
        />
      </div>

      <div>
        <label
          className="mb-1.5 block text-xs font-semibold"
          style={{ color: 'var(--text-secondary)' }}
        >
          Confirm password
        </label>
        <input
          name="confirmPassword"
          type="password"
          required
          placeholder="Re-enter your password"
          className={inputClassName}
          style={inputStyle}
        />
      </div>

      {state?.error && (
        <p className="text-sm" style={{ color: 'var(--status-error)' }}>
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="brand-gradient w-full rounded-xl py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {isPending ? 'Creating account…' : 'Create account & accept →'}
      </button>
    </form>
  );
}
