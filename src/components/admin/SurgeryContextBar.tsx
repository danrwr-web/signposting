'use client'

import GroupedSurgeryOptions, { type GroupableSurgery } from '@/components/GroupedSurgeryOptions'
import { Badge } from '@/components/ui'

interface SurgeryContextBarProps {
  /** Whether the active tab operates on one surgery or applies to all surgeries. */
  scope: 'surgery' | 'global'
  surgeries: GroupableSurgery[]
  selectedSurgeryId: string
  onChange: (surgeryId: string) => void
  /** Label before the selector, e.g. "Configuring:" or "Viewing:". */
  label?: string
  /** Adds an "All surgeries" option that toggles a tab-local view without
   *  changing the shared selection (used by the Engagement tab). */
  allOption?: boolean
  showAll?: boolean
  onShowAllChange?: (showAll: boolean) => void
}

/**
 * Single source of truth indicator for the /admin settings tabs: every tab renders
 * this bar so it's always clear which surgery the tab operates on (or that the tab
 * is global). Selection changes propagate up to the page-level selected surgery.
 *
 * Superuser-only: surgery admins manage exactly one surgery, so the bar is not
 * rendered for them.
 */
export default function SurgeryContextBar({
  scope,
  surgeries,
  selectedSurgeryId,
  onChange,
  label = 'Configuring:',
  allOption = false,
  showAll = false,
  onShowAllChange,
}: SurgeryContextBarProps) {
  if (scope === 'global') {
    return (
      <div className="flex items-center gap-3 px-4 py-3 mb-6 bg-gray-50 border border-gray-200 rounded-md">
        <Badge color="gray">Global</Badge>
        <span className="text-sm text-gray-600">This tab applies to all surgeries.</span>
      </div>
    )
  }

  const selectValue = allOption && showAll ? 'all' : selectedSurgeryId

  return (
    <div className="flex flex-wrap items-center gap-3 px-4 py-3 mb-6 bg-blue-50 border border-blue-200 rounded-md">
      <span className="text-sm font-medium text-nhs-dark-blue">{label}</span>
      <select
        value={selectValue}
        onChange={(e) => {
          if (e.target.value === 'all') {
            onShowAllChange?.(true)
            return
          }
          onShowAllChange?.(false)
          if (e.target.value) onChange(e.target.value)
        }}
        className="px-3 py-2 border border-gray-300 rounded-md text-sm bg-white w-full sm:w-72"
        aria-label="Select surgery"
      >
        {allOption && <option value="all">All surgeries</option>}
        <GroupedSurgeryOptions surgeries={surgeries} />
      </select>
    </div>
  )
}
