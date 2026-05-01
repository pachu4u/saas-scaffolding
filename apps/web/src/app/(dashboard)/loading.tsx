export default function DashboardLoading() {
  return (
    <div className="ml-60">
      {/* Topbar skeleton */}
      <div
        className="sticky top-0 z-30 flex items-center justify-between border-b px-6 py-4"
        style={{ background: 'var(--bg-white)', borderColor: 'var(--border-light)' }}
      >
        <div className="space-y-2">
          <div
            className="h-5 w-40 animate-pulse rounded-lg"
            style={{ background: 'var(--bg-subtle)' }}
          />
          <div
            className="h-3 w-64 animate-pulse rounded-lg"
            style={{ background: 'var(--bg-subtle)' }}
          />
        </div>
        <div className="flex items-center gap-3">
          <div
            className="h-8 w-8 animate-pulse rounded-full"
            style={{ background: 'var(--bg-subtle)' }}
          />
          <div
            className="h-8 w-8 animate-pulse rounded-full"
            style={{ background: 'var(--bg-subtle)' }}
          />
        </div>
      </div>

      {/* Content skeleton */}
      <div className="space-y-6 p-6">
        {/* Stat cards row */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="animate-pulse rounded-2xl border p-5"
              style={{ background: 'var(--bg-white)', borderColor: 'var(--border-light)' }}
            >
              <div className="mb-4 flex items-center justify-between">
                <div className="h-3 w-24 rounded" style={{ background: 'var(--bg-subtle)' }} />
                <div className="h-9 w-9 rounded-xl" style={{ background: 'var(--bg-subtle)' }} />
              </div>
              <div className="mb-2 h-8 w-28 rounded" style={{ background: 'var(--bg-subtle)' }} />
              <div className="h-3 w-20 rounded" style={{ background: 'var(--bg-subtle)' }} />
            </div>
          ))}
        </div>

        {/* Main content area */}
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <div
            className="animate-pulse rounded-2xl border p-6 xl:col-span-2"
            style={{ background: 'var(--bg-white)', borderColor: 'var(--border-light)' }}
          >
            <div className="mb-6 h-4 w-32 rounded" style={{ background: 'var(--bg-subtle)' }} />
            <div className="flex h-36 items-end gap-1">
              {Array.from({ length: 30 }).map((_, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-sm"
                  style={{
                    height: `${String(30 + Math.floor((i % 7) * 10))}%`,
                    background: 'var(--bg-subtle)',
                  }}
                />
              ))}
            </div>
          </div>
          <div
            className="animate-pulse rounded-2xl border p-6"
            style={{ background: 'var(--bg-white)', borderColor: 'var(--border-light)' }}
          >
            <div className="mb-4 h-4 w-28 rounded" style={{ background: 'var(--bg-subtle)' }} />
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="h-14 rounded-xl"
                  style={{ background: 'var(--bg-subtle)' }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
