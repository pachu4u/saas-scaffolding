export default function RootLoading() {
  return (
    <div
      className="flex min-h-screen items-center justify-center"
      style={{ background: 'var(--bg-main)' }}
    >
      <div className="flex flex-col items-center gap-4">
        <div className="brand-gradient flex h-10 w-10 animate-pulse items-center justify-center rounded-xl text-sm font-bold text-white">
          R
        </div>
        <div className="flex items-center gap-1.5">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-2 w-2 rounded-full"
              style={{
                background: 'var(--brand-primary)',
                animation: `bounce 1s ease-in-out ${String(i * 0.15)}s infinite`,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
