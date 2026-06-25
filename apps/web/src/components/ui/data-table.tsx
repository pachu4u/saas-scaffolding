'use client';

import { useState, useMemo, useCallback } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

export type SortDir = 'asc' | 'desc' | null;

export interface Column<T> {
  key: string;
  label: string;
  sortable?: boolean;
  /** Custom cell renderer. Receives the row data and returns a React node. */
  render?: (row: T) => React.ReactNode;
  /** CSS class name(s) for the <td> */
  className?: string;
  /** Minimum width for the column (CSS value, e.g. "120px") */
  minWidth?: string;
}

export interface FilterOption {
  label: string;
  value: string;
}

export interface FilterConfig {
  key: string;
  label: string;
  options: FilterOption[];
}

export interface DataTableProps<T extends Record<string, unknown>> {
  /** Column definitions */
  columns: Column<T>[];
  /** Row data */
  data: T[];
  /** Filter definitions (each renders a select dropdown) */
  filters?: FilterConfig[];
  /** Placeholder for the search box */
  searchPlaceholder?: string;
  /** Keys to search across (defaults to all string/number columns) */
  searchKeys?: (keyof T)[];
  /** Row count suffix label, e.g. "tenant" → "12 tenants" */
  rowLabel?: string;
  /** Optional empty state message */
  emptyMessage?: string;
  /** Richer empty state (icon/title/CTA) — takes precedence over emptyMessage */
  emptyState?: React.ReactNode;
  /** Extra content to render in the toolbar right area (e.g. a "New" button) */
  toolbarRight?: React.ReactNode;
  /** Row click handler */
  onRowClick?: (row: T) => void;
  /** Optional row key extractor */
  rowKey?: (row: T) => string;
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function SortIcon({ dir }: { dir: SortDir }) {
  return (
    <span className="ml-1 inline-flex flex-col" style={{ lineHeight: 0 }}>
      <svg
        viewBox="0 0 8 5"
        className="h-[5px] w-2"
        fill="currentColor"
        style={{ opacity: dir === 'asc' ? 1 : 0.3 }}
      >
        <path d="M4 0 8 5H0z" />
      </svg>
      <svg
        viewBox="0 0 8 5"
        className="mt-[2px] h-[5px] w-2"
        fill="currentColor"
        style={{ opacity: dir === 'desc' ? 1 : 0.3 }}
      >
        <path d="M4 5 0 0h8z" />
      </svg>
    </span>
  );
}

// ─── DataTable ────────────────────────────────────────────────────────────────

export function DataTable<T extends Record<string, unknown>>({
  columns,
  data,
  filters = [],
  searchPlaceholder = 'Search…',
  searchKeys,
  rowLabel = 'row',
  emptyMessage = 'No results found.',
  emptyState,
  toolbarRight,
  onRowClick,
  rowKey,
}: DataTableProps<T>) {
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);
  const [activeFilters, setActiveFilters] = useState<Record<string, string>>({});

  // Determine search keys
  const effectiveSearchKeys = useMemo(() => {
    if (searchKeys) return searchKeys as string[];
    return columns.map((c) => c.key);
  }, [searchKeys, columns]);

  // Handle column sort toggle
  const handleSort = useCallback(
    (key: string) => {
      if (sortKey === key) {
        if (sortDir === 'asc') setSortDir('desc');
        else if (sortDir === 'desc') {
          setSortKey(null);
          setSortDir(null);
        }
      } else {
        setSortKey(key);
        setSortDir('asc');
      }
    },
    [sortKey, sortDir],
  );

  // Handle filter change
  const handleFilter = useCallback((key: string, value: string) => {
    setActiveFilters((prev) => {
      if (!value) {
        const next = { ...prev };
        delete next[key];
        return next;
      }
      return { ...prev, [key]: value };
    });
  }, []);

  // Filter + search + sort
  const processed = useMemo(() => {
    let rows = [...data];

    // Filter
    for (const [key, value] of Object.entries(activeFilters)) {
      if (value) {
        rows = rows.filter((row) => {
          const cell = row[key];
          return typeof cell === 'string'
            ? cell.toLowerCase() === value.toLowerCase()
            : String(cell) === value;
        });
      }
    }

    // Search
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      rows = rows.filter((row) =>
        effectiveSearchKeys.some((k) => {
          const v = row[k];
          return typeof v === 'string'
            ? v.toLowerCase().includes(q)
            : String(v ?? '')
                .toLowerCase()
                .includes(q);
        }),
      );
    }

    // Sort
    if (sortKey && sortDir) {
      rows = [...rows].sort((a, b) => {
        const av = a[sortKey];
        const bv = b[sortKey];
        const aStr = typeof av === 'string' ? av.toLowerCase() : String(av ?? '');
        const bStr = typeof bv === 'string' ? bv.toLowerCase() : String(bv ?? '');
        const cmp = aStr < bStr ? -1 : aStr > bStr ? 1 : 0;
        return sortDir === 'asc' ? cmp : -cmp;
      });
    }

    return rows;
  }, [data, activeFilters, search, sortKey, sortDir, effectiveSearchKeys]);

  const rowCount = processed.length;
  const total = data.length;
  const pluralLabel = rowCount === 1 ? rowLabel : rowLabel + 's';

  return (
    <div
      className="overflow-hidden rounded-xl border"
      style={{
        background: 'var(--bg-white)',
        borderColor: 'var(--border-light)',
        boxShadow: 'var(--shadow-card)',
      }}
    >
      {/* ── Toolbar ──────────────────────────────────────────────────────── */}
      <div
        className="flex flex-wrap items-center gap-2.5 border-b px-4 py-3"
        style={{ borderColor: 'var(--border-light)' }}
      >
        {/* Search */}
        <div className="relative min-w-0 flex-1" style={{ minWidth: '180px', maxWidth: '320px' }}>
          <svg
            viewBox="0 0 20 20"
            fill="currentColor"
            className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2"
            style={{ color: 'var(--text-muted)' }}
          >
            <path
              fillRule="evenodd"
              d="M8 4a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM2 8a6 6 0 1 1 10.89 3.476l4.817 4.817a1 1 0 0 1-1.414 1.414l-4.816-4.816A6 6 0 0 1 2 8z"
              clipRule="evenodd"
            />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={searchPlaceholder}
            className="h-8 w-full rounded-lg border py-0 pl-8 pr-3 text-xs outline-none transition-colors focus:ring-2"
            style={{
              borderColor: 'var(--border-default)',
              background: 'var(--bg-main)',
              color: 'var(--text-primary)',
            }}
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2"
              style={{ color: 'var(--text-muted)' }}
            >
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                <path
                  fillRule="evenodd"
                  d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          )}
        </div>

        {/* Filter dropdowns */}
        {filters.map((f) => (
          <select
            key={f.key}
            value={activeFilters[f.key] ?? ''}
            onChange={(e) => handleFilter(f.key, e.target.value)}
            className="h-8 rounded-lg border px-2.5 text-xs outline-none"
            style={{
              borderColor: activeFilters[f.key] ? 'var(--brand-primary)' : 'var(--border-default)',
              background: activeFilters[f.key] ? 'rgba(79,123,255,0.06)' : 'var(--bg-main)',
              color: 'var(--text-secondary)',
            }}
          >
            <option value="">{f.label}</option>
            {f.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        ))}

        {/* Clear filters */}
        {(Object.keys(activeFilters).length > 0 || search) && (
          <button
            onClick={() => {
              setSearch('');
              setActiveFilters({});
            }}
            className="h-8 rounded-lg px-2.5 text-xs font-medium transition-colors"
            style={{
              color: 'var(--brand-primary)',
              background: 'rgba(79,123,255,0.07)',
            }}
          >
            Clear
          </button>
        )}

        {/* Row count */}
        <span className="ml-auto text-xs" style={{ color: 'var(--text-muted)' }}>
          {rowCount === total
            ? `${rowCount.toLocaleString()} ${pluralLabel}`
            : `${rowCount.toLocaleString()} of ${total.toLocaleString()} ${pluralLabel}`}
        </span>

        {/* Toolbar right actions */}
        {toolbarRight}
      </div>

      {/* ── Table ────────────────────────────────────────────────────────── */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr
              style={{
                borderBottom: '1px solid var(--border-light)',
                background: 'var(--bg-main)',
              }}
            >
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`select-none px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide ${col.sortable ? 'cursor-pointer hover:opacity-80' : ''} ${col.className ?? ''}`}
                  style={{
                    color: 'var(--text-muted)',
                    minWidth: col.minWidth,
                    whiteSpace: 'nowrap',
                  }}
                  onClick={col.sortable ? () => handleSort(col.key) : undefined}
                >
                  {col.label}
                  {col.sortable && <SortIcon dir={sortKey === col.key ? sortDir : null} />}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {processed.length === 0 ? (
              <tr>
                <td colSpan={columns.length}>
                  {emptyState && data.length === 0 ? (
                    emptyState
                  ) : (
                    <p
                      className="px-4 py-12 text-center text-sm"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      {emptyMessage}
                    </p>
                  )}
                </td>
              </tr>
            ) : (
              processed.map((row, idx) => {
                const key = rowKey ? rowKey(row) : String(idx);
                return (
                  <tr
                    key={key}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    className="transition-colors"
                    style={{
                      borderBottom:
                        idx < processed.length - 1 ? '1px solid var(--border-light)' : 'none',
                      cursor: onRowClick ? 'pointer' : undefined,
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.background = 'var(--bg-subtle)';
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.background = '';
                    }}
                  >
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        className={`px-4 py-3 ${col.className ?? ''}`}
                        style={{ minWidth: col.minWidth }}
                      >
                        {col.render ? (
                          col.render(row)
                        ) : (
                          <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                            {String(row[col.key] ?? '—')}
                          </span>
                        )}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
