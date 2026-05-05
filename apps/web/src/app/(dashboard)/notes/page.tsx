'use client';

import { useState, useEffect, useCallback } from 'react';

import { Topbar } from '@/components/layout/topbar';

interface Note {
  id: string;
  body: string;
  createdAt: string;
}

interface ApiNote {
  id: string;
  body: string;
  createdAt: string;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function NotesPage() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  // quota info from headers
  const [quota, setQuota] = useState<{ used: number; max: number | null } | null>(null);

  const tenantSlug = process.env.NEXT_PUBLIC_DEFAULT_TENANT_SLUG ?? 'acme';

  const fetchNotes = useCallback(async () => {
    try {
      const res = await fetch('/api/notes', {
        headers: { 'x-tenant-slug': tenantSlug },
      });
      if (res.ok) {
        const data = (await res.json()) as ApiNote[];
        setNotes(data);
      } else if (res.status === 429) {
        setError('Rate limit exceeded — please try again shortly');
      }
    } catch {
      // ignore network errors on load
    } finally {
      setLoading(false);
    }
  }, [tenantSlug]);

  useEffect(() => {
    void fetchNotes();
  }, [fetchNotes]);

  async function createNote() {
    if (!body.trim()) return;
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-tenant-slug': tenantSlug },
        body: JSON.stringify({ body: body.trim() }),
      });

      if (res.status === 429) {
        setError('Rate limit exceeded — please try again shortly');
        return;
      }
      if (res.status === 403) {
        const json = (await res.json()) as { error?: string };
        // Check if it's a quota error
        if (json.error?.includes('quota') || json.error?.includes('limit')) {
          setError(`Note limit reached for your plan. ${json.error}`);
        } else {
          setError(json.error ?? 'Permission denied');
        }
        return;
      }
      if (!res.ok) {
        const json = (await res.json()) as { error?: string };
        setError(json.error ?? 'Failed to create note');
        return;
      }

      const note = (await res.json()) as ApiNote;
      setNotes((prev) => [note, ...prev]);
      setBody('');
    } catch {
      setError('Request failed');
    } finally {
      setSubmitting(false);
    }
  }

  async function deleteNote(id: string) {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/notes?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: { 'x-tenant-slug': tenantSlug },
      });
      if (res.ok || res.status === 204) {
        setNotes((prev) => prev.filter((n) => n.id !== id));
      } else if (res.status === 403) {
        const json = (await res.json()) as { error?: string };
        setError(json.error ?? 'Cannot delete this note — upgrade your plan or check permissions');
      }
    } catch {
      // ignore
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div>
      <Topbar title="Notes" subtitle="Shared workspace notes — permission and quota enforced" />

      <main className="mx-auto max-w-3xl space-y-5 p-6">
        {/* Quota info */}
        {quota && quota.max !== null && (
          <div
            className="flex items-center justify-between rounded-xl border px-4 py-3"
            style={{ background: 'var(--bg-white)', borderColor: 'var(--border-light)' }}
          >
            <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              Notes used: <strong>{quota.used}</strong> / {quota.max}
            </span>
            <div
              className="h-1.5 w-40 overflow-hidden rounded-full"
              style={{ background: 'var(--border-light)' }}
            >
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${String(Math.min(Math.round((quota.used / quota.max) * 100), 100))}%`,
                  background:
                    quota.used / quota.max > 0.85
                      ? 'var(--status-warning)'
                      : 'var(--brand-primary)',
                }}
              />
            </div>
          </div>
        )}

        {/* Compose */}
        <div
          className="rounded-xl border p-5"
          style={{
            background: 'var(--bg-white)',
            borderColor: 'var(--border-light)',
            boxShadow: 'var(--shadow-card)',
          }}
        >
          <label
            className="mb-2 block text-xs font-semibold uppercase tracking-wide"
            style={{ color: 'var(--text-muted)' }}
          >
            New note
          </label>
          {error && (
            <div className="mb-3 rounded-lg border border-red-100 bg-red-50 px-4 py-2 text-sm text-red-700">
              {error}
              <button onClick={() => setError(null)} className="ml-2 underline">
                Dismiss
              </button>
            </div>
          )}
          <textarea
            rows={4}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Write a note for your team…"
            className="w-full resize-none rounded-xl border px-3 py-2.5 text-sm outline-none"
            style={{
              borderColor: 'var(--border-default)',
              background: 'var(--bg-main)',
              color: 'var(--text-primary)',
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void createNote();
            }}
          />
          <div className="mt-3 flex items-center justify-between">
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {body.length > 0 && `${body.length} chars · `}⌘+Enter to submit
            </span>
            <button
              onClick={() => void createNote()}
              disabled={submitting || !body.trim()}
              className="brand-gradient rounded-xl px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {submitting ? 'Saving…' : 'Add note'}
            </button>
          </div>
        </div>

        {/* Notes list */}
        {loading ? (
          <div className="py-12 text-center">
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              Loading notes…
            </p>
          </div>
        ) : notes.length === 0 ? (
          <div
            className="rounded-xl border py-12 text-center"
            style={{ background: 'var(--bg-white)', borderColor: 'var(--border-light)' }}
          >
            <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              No notes yet
            </p>
            <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
              Create the first note above. Notes are shared across the workspace.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {notes.map((note) => (
              <div
                key={note.id}
                className="group rounded-xl border p-4"
                style={{
                  background: 'var(--bg-white)',
                  borderColor: 'var(--border-light)',
                  boxShadow: 'var(--shadow-card)',
                }}
              >
                <p
                  className="whitespace-pre-wrap text-sm leading-relaxed"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {note.body}
                </p>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {timeAgo(note.createdAt)}
                  </span>
                  <button
                    onClick={() => void deleteNote(note.id)}
                    disabled={deletingId === note.id}
                    className="rounded-lg border border-red-100 bg-red-50 px-2.5 py-1 text-xs text-red-600 opacity-0 transition-opacity hover:bg-red-100 disabled:opacity-50 group-hover:opacity-100"
                  >
                    {deletingId === note.id ? '…' : 'Delete'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Plan notice */}
        <div
          className="flex items-start gap-3 rounded-xl p-4"
          style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-default)' }}
        >
          <svg
            viewBox="0 0 20 20"
            fill="currentColor"
            className="mt-0.5 h-4 w-4 flex-shrink-0"
            style={{ color: 'var(--brand-secondary)' }}
          >
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0zm-7-4a1 1 0 1 1-2 0 1 1 0 0 1 2 0zM9 9a1 1 0 0 0 0 2v3a1 1 0 0 0 1 1h1a1 1 0 1 0 0-2v-3a1 1 0 0 0-1-1H9z"
              clipRule="evenodd"
            />
          </svg>
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            Free plan: up to <strong>10 notes</strong>, no deletion. Pro: up to{' '}
            <strong>1,000 notes</strong> with deletion. Enterprise: unlimited.{' '}
            <a href="/billing" className="underline" style={{ color: 'var(--brand-primary)' }}>
              Upgrade
            </a>
          </p>
        </div>
      </main>
    </div>
  );
}
