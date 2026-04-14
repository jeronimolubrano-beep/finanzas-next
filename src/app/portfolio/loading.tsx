export default function PortfolioLoading() {
  return (
    <div className="container mx-auto px-4 max-w-7xl py-8 space-y-6 animate-pulse">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div>
          <div className="h-6 w-48 rounded-lg" style={{ background: '#1a1f4e' }} />
          <div className="h-3 w-64 rounded mt-2" style={{ background: '#1a1f4e' }} />
        </div>
        <div className="flex gap-2">
          <div className="h-9 w-24 rounded-lg" style={{ background: '#1a1f4e' }} />
          <div className="h-9 w-32 rounded-lg" style={{ background: '#1a1f4e' }} />
        </div>
      </div>

      {/* KPI skeletons */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => (
          <div
            key={i}
            className="rounded-xl p-5 border"
            style={{ background: '#1a1f4e', borderColor: '#333b72' }}
          >
            <div className="h-3 w-16 rounded mb-2" style={{ background: '#232a5c' }} />
            <div className="h-6 w-28 rounded" style={{ background: '#232a5c' }} />
            <div className="mt-3 h-[2px] rounded-full w-full" style={{ background: '#232a5c' }} />
          </div>
        ))}
      </div>

      {/* Chart skeleton */}
      <div
        className="rounded-xl border p-5"
        style={{ background: '#1a1f4e', borderColor: '#333b72' }}
      >
        <div className="h-3 w-36 rounded mb-4" style={{ background: '#232a5c' }} />
        <div className="h-[220px] rounded-lg" style={{ background: '#232a5c' }} />
      </div>

      {/* Table skeleton */}
      <div
        className="rounded-xl border overflow-hidden"
        style={{ background: '#1a1f4e', borderColor: '#333b72' }}
      >
        {[1, 2, 3].map(i => (
          <div
            key={i}
            className="px-5 py-4 border-b"
            style={{ borderColor: '#333b72' }}
          >
            <div className="h-4 w-32 rounded" style={{ background: '#232a5c' }} />
          </div>
        ))}
      </div>
    </div>
  )
}
