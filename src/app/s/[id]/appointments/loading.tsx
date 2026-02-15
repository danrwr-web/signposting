import { Skeleton, SkeletonCardGrid } from '@/components/ui/Skeleton'

/** Appointments page skeleton - mirrors header + filter bar + card grid */
export default function AppointmentsLoading() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6 animate-pulse">
          <Skeleton height="h-8" width="w-64" className="mb-2" />
          <Skeleton height="h-4" width="w-40" />
        </div>

        {/* Top bar skeleton */}
        <div className="bg-white rounded-lg shadow-md p-4 mb-6 animate-pulse">
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
            <Skeleton height="h-10" width="w-full md:w-72" rounded="md" />
            <div className="flex gap-2 flex-wrap">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} height="h-10" width="w-20" rounded="md" />
              ))}
            </div>
          </div>
        </div>

        {/* Card grid */}
        <SkeletonCardGrid count={8} showBadge lines={2} />
      </div>
    </div>
  )
}
