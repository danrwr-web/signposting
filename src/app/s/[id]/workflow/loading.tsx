import { Skeleton, SkeletonWorkflowCard } from '@/components/ui/Skeleton'

/** Workflow page skeleton - mirrors heading + search + workflow card list */
export default function WorkflowLoading() {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <div className="mb-8 animate-pulse">
          <Skeleton height="h-10" width="w-3/4 sm:w-96" className="mb-3" />
          <Skeleton height="h-5" width="w-2/3 sm:w-80" className="mb-2" />
          <Skeleton height="h-4" width="w-40" className="mt-2" />

          {/* Search bar */}
          <div className="mt-5">
            <Skeleton height="h-11" width="w-full sm:w-96" rounded="lg" />
          </div>
        </div>

        {/* Section heading */}
        <Skeleton height="h-6" width="w-48" className="mb-4" />

        {/* Workflow cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonWorkflowCard key={i} />
          ))}
        </div>

        {/* Second section heading */}
        <Skeleton height="h-6" width="w-56" className="mt-10 mb-4" />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 2 }).map((_, i) => (
            <SkeletonWorkflowCard key={i} />
          ))}
        </div>
      </div>
    </div>
  )
}
