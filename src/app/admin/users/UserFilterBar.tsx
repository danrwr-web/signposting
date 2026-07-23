'use client'

import AdminSearchBar from '@/components/admin/AdminSearchBar'
import { Button } from '@/components/ui'
import { EMPTY_FILTERS, type UserFilters } from './types'

interface UserFilterBarProps {
  search: string
  onSearchChange: (value: string) => void
  filters: UserFilters
  onFiltersChange: (filters: UserFilters) => void
  resultCount: number
  totalCount: number
}

function FilterChip({
  label,
  active,
  onToggle,
}: {
  label: string
  active: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onToggle}
      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
        active
          ? 'bg-nhs-blue text-white border-nhs-blue'
          : 'bg-white text-nhs-grey border-gray-300 hover:border-nhs-blue'
      }`}
    >
      {label}
    </button>
  )
}

export default function UserFilterBar({
  search,
  onSearchChange,
  filters,
  onFiltersChange,
  resultCount,
  totalCount,
}: UserFilterBarProps) {
  const hasActiveFilters =
    search.trim() !== '' ||
    filters.adminsOnly ||
    filters.testOnly ||
    filters.noSurgeries ||
    filters.activity !== 'all'

  return (
    <div>
      <AdminSearchBar
        value={search}
        onChange={onSearchChange}
        placeholder="Search by name, email or surgery…"
        debounceMs={0}
      />
      <div className="px-4 py-3 border-b border-gray-200 flex flex-wrap items-center gap-2">
        <FilterChip
          label="System admins"
          active={filters.adminsOnly}
          onToggle={() => onFiltersChange({ ...filters, adminsOnly: !filters.adminsOnly })}
        />
        <FilterChip
          label="Test users"
          active={filters.testOnly}
          onToggle={() => onFiltersChange({ ...filters, testOnly: !filters.testOnly })}
        />
        <FilterChip
          label="No surgeries"
          active={filters.noSurgeries}
          onToggle={() => onFiltersChange({ ...filters, noSurgeries: !filters.noSurgeries })}
        />
        <FilterChip
          label="Inactive 30d+"
          active={filters.activity === 'inactive30'}
          onToggle={() =>
            onFiltersChange({
              ...filters,
              activity: filters.activity === 'inactive30' ? 'all' : 'inactive30',
            })
          }
        />
        <FilterChip
          label="Never signed in"
          active={filters.activity === 'never'}
          onToggle={() =>
            onFiltersChange({
              ...filters,
              activity: filters.activity === 'never' ? 'all' : 'never',
            })
          }
        />
        {hasActiveFilters && (
          <span className="ml-auto flex items-center gap-3 text-xs text-nhs-grey">
            Showing {resultCount} of {totalCount} users
            <Button
              variant="link"
              size="sm"
              onClick={() => {
                onSearchChange('')
                onFiltersChange(EMPTY_FILTERS)
              }}
            >
              Clear all
            </Button>
          </span>
        )}
      </div>
    </div>
  )
}
