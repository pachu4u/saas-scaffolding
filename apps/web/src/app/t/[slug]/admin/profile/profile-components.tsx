'use client';

import { useState } from 'react';

import { Badge } from '@/components/ui/badge';

export interface ProfileData {
  id: string;
  email: string;
  name?: string | null;
  avatarUrl?: string | null;
  status: string;
  createdAt: string;
  workspaces: {
    tenantId: string;
    tenantName: string;
    tenantSlug: string;
    plan: string;
    status: string;
  }[];
}

export interface SessionInfo {
  sessionId: string;
  createdAt: string;
  lastActive: string;
  ip?: string;
  userAgent?: string;
  active: boolean;
}

export function AvatarUpload({ user, onUpdate }: { user: ProfileData; onUpdate: () => void }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please upload an image file');
      return;
    }

    const allowedTypes = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setError('Avatar must be PNG, JPEG, GIF, or WebP');
      return;
    }

    const maxSize = 2 * 1024 * 1024; // 2MB
    if (file.size > maxSize) {
      setError('Avatar must be less than 2MB');
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('avatar', file);

      const response = await fetch('/api/users/me/avatar', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error ?? 'Failed to upload avatar');
      }

      onUpdate();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUploading(false);
    }
  };

  const handleAvatarRemove = async () => {
    setUploading(true);
    setError(null);

    try {
      const response = await fetch('/api/users/me/avatar', {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to remove avatar');
      }

      onUpdate();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUploading(false);
    }
  };

  const initials = (user.name ?? user.email)
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="group relative">
        <div className="brand-gradient flex h-24 w-24 flex-shrink-0 items-center justify-center rounded-full text-3xl font-extrabold text-white shadow-lg">
          {user.avatarUrl?.startsWith('data:') ? (
            <img
              src={user.avatarUrl}
              alt={user.name ?? user.email}
              className="h-24 w-24 rounded-full object-cover"
            />
          ) : (
            initials
          )}
        </div>
        <label
          className={`bg-brand-primary hover:bg-brand-secondary absolute bottom-0 right-0 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-white shadow transition-all hover:scale-110 ${uploading ? 'cursor-not-allowed opacity-50' : ''} `}
        >
          {user.avatarUrl ? (
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="h-4 w-4"
            >
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
              <circle cx="12" cy="12" r="3"></circle>
            </svg>
          ) : (
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="h-4 w-4"
            >
              <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
            </svg>
          )}
          <input
            type="file"
            accept="image/png,image/jpeg,image/gif,image/webp"
            onChange={(e) => {
              void handleAvatarChange(e);
            }}
            className="hidden"
            disabled={uploading}
          />
        </label>
        {user.avatarUrl && !uploading && (
          <button
            onClick={() => {
              void handleAvatarRemove();
            }}
            className="absolute bottom-0 left-0 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-red-500 text-white shadow transition-all hover:scale-110 hover:bg-red-600"
            title="Remove avatar"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="h-4 w-4"
            >
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
      <div className="text-center">
        <input
          type="file"
          accept="image/png,image/jpeg,image/gif,image/webp"
          onChange={(e) => {
            void handleAvatarChange(e);
          }}
          className="hidden"
          id="avatar-input"
          disabled={uploading}
        />
        <button
          onClick={() => document.getElementById('avatar-input')?.click()}
          disabled={uploading}
          className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${uploading ? 'cursor-not-allowed bg-gray-400' : 'bg-brand-primary hover:bg-brand-secondary text-white'} `}
        >
          {uploading ? 'Uploading...' : user.avatarUrl ? 'Change avatar' : 'Upload avatar'}
        </button>
        {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
      </div>
    </div>
  );
}

export function DisplayNameForm({ user, onUpdate }: { user: ProfileData; onUpdate: () => void }) {
  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState(user.name ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!displayName.trim()) {
      setError('Display name cannot be empty');
      return;
    }

    if (displayName.trim().length > 128) {
      setError('Display name must be 128 characters or fewer');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const response = await fetch('/api/users/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName: displayName.trim() }),
      });

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error ?? 'Failed to update display name');
      }

      setEditing(false);
      onUpdate();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (editing) {
    return (
      <div className="space-y-3">
        <div>
          <label
            className="mb-1 block text-xs font-semibold uppercase tracking-wide"
            style={{ color: 'var(--text-muted)' }}
          >
            Display name
          </label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => {
              setDisplayName(e.target.value);
            }}
            className="focus:border-brand-primary focus:ring-brand-primary w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-1"
            style={{ borderColor: 'var(--border-default)' }}
            placeholder="Enter your display name"
            maxLength={128}
          />
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              void handleSave();
            }}
            disabled={saving}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${saving ? 'cursor-not-allowed bg-gray-400' : 'bg-brand-primary hover:bg-brand-secondary text-white'} `}
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
          <button
            onClick={() => {
              setEditing(false);
              setDisplayName(user.name ?? '');
              setError(null);
            }}
            className="hover:bg-bg-subtle rounded-lg border px-4 py-2 text-sm font-semibold transition-colors"
            style={{ borderColor: 'var(--border-default)' }}
          >
            Cancel
          </button>
        </div>
        {error && <p className="text-xs text-red-500">{error}</p>}
      </div>
    );
  }

  return (
    <div className="flex items-start justify-between">
      <div>
        <h3 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
          {user.name ?? 'Unknown'}
        </h3>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          {user.email}
        </p>
      </div>
      <button
        onClick={() => {
          setEditing(true);
        }}
        className="hover:bg-bg-subtle rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors"
        style={{ borderColor: 'var(--border-default)' }}
      >
        Edit
      </button>
    </div>
  );
}

export function ActiveSessions({ sessions }: { sessions: SessionInfo[] }) {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
        Active sessions
      </h3>
      {sessions.length === 0 ? (
        <div
          className="rounded-lg border p-6 text-center"
          style={{ borderColor: 'var(--border-light)' }}
        >
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            No active sessions found
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {sessions.map((session) => (
            <div
              key={session.sessionId}
              className="flex items-center justify-between rounded-lg border p-4"
              style={{ borderColor: 'var(--border-light)' }}
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {new Date(session.createdAt).toLocaleDateString()} -{' '}
                    {new Date(session.lastActive).toLocaleTimeString()}
                  </span>
                  {session.active && (
                    <Badge variant="success" dot>
                      Active
                    </Badge>
                  )}
                </div>
                <div className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                  {session.userAgent ? (
                    <span className="max-w-[200px] truncate">{session.userAgent}</span>
                  ) : (
                    'Unknown device'
                  )}
                </div>
              </div>
              <button
                onClick={() => {
                  console.log('Revoke session:', session.sessionId);
                }}
                className="text-xs font-semibold text-red-500 hover:underline"
              >
                Revoke
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
