import { Skeleton, SkeletonTable } from '@/components/ui/Skeleton'

/** Clinical Review page skeleton - mirrors heading + tab bar + table layout */
export default function ClinicalReviewLoading() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Heading */}
        <div className="mb-6 animate-pulse">
          <Skeleton height="h-7" width="w-72" />
        </div>

        {/* Tab bar */}
        <div className="flex gap-2 mb-6 animate-pulse">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} height="h-10" width="w-32" rounded="md" />
          ))}
        </div>

        {/* Table */}
        <SkeletonTable columns={5} rows={6} />
      </div>
    </div>
  )
}
