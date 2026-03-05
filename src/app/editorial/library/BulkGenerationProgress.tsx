'use client'

type BulkRunStatus = {
  status: string
  totalSubsections: number
  completedCount: number
  failedCount: number
  failedSubsections: Array<{ categoryName: string; subsection: string }>
}

type BulkGenerationProgressProps = {
  bulkRunStatus: BulkRunStatus | null
  canAdmin: boolean
  cancelLoading: boolean
  onCancel: () => void
}

export function BulkGenerationProgress({
  bulkRunStatus,
  canAdmin,
  cancelLoading,
  onCancel,
}: BulkGenerationProgressProps) {
  const statusText = !bulkRunStatus
    ? 'Loading...'
    : bulkRunStatus.status === 'COMPLETE'
      ? `Complete. ${bulkRunStatus.completedCount} cards created${bulkRunStatus.failedCount > 0 ? `, ${bulkRunStatus.failedCount} failed` : ''}`
      : bulkRunStatus.status === 'CANCELLED'
        ? `Stopped. ${bulkRunStatus.completedCount} cards created before cancellation${bulkRunStatus.failedCount > 0 ? `, ${bulkRunStatus.failedCount} failed` : ''}`
        : `${bulkRunStatus.completedCount} of ${bulkRunStatus.totalSubsections} done${bulkRunStatus.failedCount > 0 ? ` (${bulkRunStatus.failedCount} failed)` : ''}`

  const showProgressBar = bulkRunStatus?.status === 'RUNNING' && bulkRunStatus.totalSubsections > 0
  const progressPct = showProgressBar && bulkRunStatus
    ? Math.round((100 * (bulkRunStatus.completedCount + bulkRunStatus.failedCount)) / bulkRunStatus.totalSubsections)
    : 0

  return (
    <div className="rounded-lg border border-nhs-blue bg-nhs-light-blue/30 p-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-nhs-dark-blue">Bulk generation</h2>
          <p className="mt-1 text-sm text-slate-700">{statusText}</p>
          {showProgressBar && (
            <div className="mt-2 h-2 w-full max-w-xs overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full bg-nhs-blue transition-all duration-300"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          )}
        </div>
        {bulkRunStatus?.status === 'RUNNING' && canAdmin && (
          <button
            type="button"
            onClick={onCancel}
            disabled={cancelLoading}
            className="rounded-lg border border-red-500 bg-white px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {cancelLoading ? 'Stopping...' : 'Stop'}
          </button>
        )}
        {bulkRunStatus?.status === 'COMPLETE' && bulkRunStatus.failedSubsections.length > 0 && (
          <details className="text-xs text-slate-600">
            <summary className="cursor-pointer font-medium hover:text-nhs-blue">
              View failed subsections ({bulkRunStatus.failedSubsections.length})
            </summary>
            <ul className="mt-2 max-h-32 overflow-y-auto space-y-0.5">
              {bulkRunStatus.failedSubsections.map((f, i) => (
                <li key={i}>
                  {f.categoryName} / {f.subsection}
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </div>
  )
}
