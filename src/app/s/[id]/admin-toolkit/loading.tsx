import { Skeleton, SkeletonAdminToolkit } from '@/components/ui/Skeleton'

/** Admin Toolkit page skeleton - mirrors header + sidebar/grid layout */
export default function AdminToolkitLoading() {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-6xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <header className="mb-6 flex items-start justify-between gap-4 animate-pulse">
          <div>
            <Skeleton height="h-8" width="w-56" className="mb-2" />
            <Skeleton height="h-4" width="w-32" />
          </div>
          <Skeleton height="h-10" width="w-24" rounded="md" />
        </header>

        {/* Admin Toolkit skeleton */}
        <SkeletonAdminToolkit />
      </div>
    </div>
  )
}
