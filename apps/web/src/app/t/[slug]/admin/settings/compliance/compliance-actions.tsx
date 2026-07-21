'use client';

import { useState } from 'react';

export function ComplianceActions() {
  const [isExporting, setIsExporting] = useState(false);
  const [deleteRequested, setDeleteRequested] = useState(false);
  const [isRequesting, setIsRequesting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function exportData() {
    setIsExporting(true);
    setError(null);
    try {
      const res = await fetch('/api/settings/compliance/export');
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        setError(json.error ?? 'Export failed');
        return;
      }
      const blob = await res.blob();
      const disposition = res.headers.get('Content-Disposition') ?? '';
      const match = /filename="([^"]+)"/.exec(disposition);
      const filename = match?.[1] ?? 'workspace-export.json';

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError('Export failed');
    } finally {
      setIsExporting(false);
    }
  }

  async function requestDeletion() {
    setIsRequesting(true);
    setError(null);
    try {
      const res = await fetch('/api/settings/compliance/delete-request', {
        method: 'POST',
      });
      if (res.ok) {
        setDeleteRequested(true);
      } else {
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        setError(json.error ?? 'Request failed');
      }
    } catch {
      setError('Request failed');
    } finally {
      setIsRequesting(false);
    }
  }

  return (
    <div className="space-y-5">
      {error && (
        <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Export */}
      <div
        className="rounded-xl border p-5"
        style={{
          background: 'var(--bg-white)',
          borderColor: 'var(--border-light)',
          boxShadow: 'var(--shadow-card)',
        }}
      >
        <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
          Export workspace data
        </h3>
        <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
          Download a JSON snapshot of your workspace, members, notes, subscription, and recent audit
          history. Secrets (webhook signing keys, SCIM tokens, API keys) are never included.
        </p>
        <button
          onClick={() => void exportData()}
          disabled={isExporting}
          className="brand-gradient mt-4 rounded-xl px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {isExporting ? 'Preparing export…' : 'Export all workspace data'}
        </button>
      </div>

      {/* Cryptographic delete request */}
      <div
        className="rounded-xl border p-5"
        style={{
          background: 'var(--bg-white)',
          borderColor: 'rgba(239,68,68,0.25)',
          boxShadow: 'var(--shadow-card)',
        }}
      >
        <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
          Request cryptographic delete
        </h3>
        <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
          Submit a request to permanently and irreversibly destroy this workspace&apos;s data (GDPR
          &ldquo;right to erasure&rdquo;). This is reviewed and actioned by our platform team — it
          does not happen instantly, and cannot be undone once processed.
        </p>
        {deleteRequested ? (
          <div
            className="mt-4 rounded-lg px-3 py-2 text-xs font-semibold"
            style={{ background: 'rgba(22,163,74,0.08)', color: 'var(--status-success)' }}
          >
            ✓ Deletion request submitted. Our team will follow up by email.
          </div>
        ) : (
          <button
            onClick={() => void requestDeletion()}
            disabled={isRequesting}
            className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-600 transition-colors hover:bg-red-100 disabled:opacity-50"
          >
            {isRequesting ? 'Submitting…' : 'Request cryptographic delete'}
          </button>
        )}
      </div>
    </div>
  );
}
