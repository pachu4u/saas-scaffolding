export default function AdminLoading() {
  return (
    <div className="lg:ml-[var(--sidebar-width)]">
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
        <div
          className="h-8 w-8 animate-pulse rounded-full"
          style={{ background: 'var(--bg-subtle)' }}
        />
      </div>

      {/* Content skeleton — table-shaped, matches most admin pages */}
      <div className="space-y-4 p-6">
        <div className="flex items-center justify-between">
          <div
            className="h-8 w-56 animate-pulse rounded-lg"
            style={{ background: 'var(--bg-subtle)' }}
          />
          <div
            className="h-8 w-28 animate-pulse rounded-lg"
            style={{ background: 'var(--bg-subtle)' }}
          />
        </div>
        <div
          className="overflow-hidden rounded-xl border"
          style={{ background: 'var(--bg-white)', borderColor: 'var(--border-light)' }}
        >
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-4 border-b px-5 py-4 last:border-0"
              style={{ borderColor: 'var(--border-light)' }}
            >
              <div
                className="h-8 w-8 flex-shrink-0 animate-pulse rounded-full"
                style={{ background: 'var(--bg-subtle)' }}
              />
              <div className="flex-1 space-y-2">
                <div
                  className="h-3 w-1/3 animate-pulse rounded"
                  style={{ background: 'var(--bg-subtle)' }}
                />
                <div
                  className="h-2.5 w-1/5 animate-pulse rounded"
                  style={{ background: 'var(--bg-subtle)' }}
                />
              </div>
              <div
                className="h-6 w-16 flex-shrink-0 animate-pulse rounded-md"
                style={{ background: 'var(--bg-subtle)' }}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
