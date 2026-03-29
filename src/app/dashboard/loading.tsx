export default function Loading() {
  return (
    <div>
      <div className="h-8 w-48 bg-gray-200 rounded animate-pulse mb-6" />
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4 mb-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-white rounded-lg shadow-sm p-4 h-24 animate-pulse">
            <div className="h-3 w-20 bg-gray-200 rounded mb-3" />
            <div className="h-6 w-24 bg-gray-200 rounded" />
          </div>
        ))}
      </div>
    </div>
  )
}
