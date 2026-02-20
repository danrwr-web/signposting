import { Skeleton } from '@/components/ui/Skeleton'

/** Analytics page skeleton - mirrors stat cards + chart areas */
export default function AnalyticsLoading() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8 animate-pulse">
          <Skeleton height="h-8" width="w-48" className="mb-2" />
          <Skeleton height="h-4" width="w-64" />
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm animate-pulse">
              <Skeleton height="h-3" width="w-24" className="mb-3" />
              <Skeleton height="h-8" width="w-16" className="mb-1" />
              <Skeleton height="h-3" width="w-20" />
            </div>
          ))}
        </div>

        {/* Chart areas */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm animate-pulse">
              <Skeleton height="h-5" width="w-40" className="mb-4" />
              <Skeleton height="h-48" width="w-full" rounded="lg" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
