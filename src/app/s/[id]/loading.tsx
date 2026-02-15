import { Skeleton, SkeletonCardGrid } from '@/components/ui/Skeleton'

/** Signposting page skeleton - mirrors the symptom card grid layout */
export default function SignpostingLoading() {
  return (
    <div className="min-h-screen bg-nhs-light-grey">
      {/* Toolbar skeleton */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex flex-col md:flex-row gap-3 items-start md:items-center justify-between animate-pulse">
            <Skeleton height="h-10" width="w-full md:w-72" rounded="md" />
            <div className="flex gap-2 flex-wrap">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} height="h-8" width="w-14" rounded="md" />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Usage bar skeleton */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 animate-pulse">
          <Skeleton height="h-4" width="w-48" />
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Page Header */}
        <div className="text-center mb-6 animate-pulse">
          <Skeleton height="h-8" width="w-80" className="mx-auto mb-3" />
          <Skeleton height="h-4" width="w-96" className="mx-auto" />
        </div>

        {/* Symptom card grid */}
        <SkeletonCardGrid count={8} lines={3} />
      </main>
    </div>
  )
}
