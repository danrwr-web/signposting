'use client'

import AdminSearchBar from '@/components/admin/AdminSearchBar'
import { Button } from '@/components/ui'
import { EMPTY_FILTERS, type MemberFilters } from './types'

interface MemberFilterBarProps {
  search: string
  onSearchChange: (value: string) => void
  filters: MemberFilters
  onFiltersChange: (filters: MemberFilters) => void
  handbookEnabled: boolean
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

export default function MemberFilterBar({
  search,
  onSearchChange,
  filters,
  onFiltersChange,
  handbookEnabled,
  resultCount,
  totalCount,
}: MemberFilterBarProps) {
  const hasActiveFilters =
    search.trim() !== '' ||
    filters.adminsOnly ||
    filters.handbookOnly ||
    filters.activity !== 'all'

  return (
    <div>
      <AdminSearchBar
        value={search}
        onChange={onSearchChange}
        placeholder="Search by name or email…"
        debounceMs={0}
      />
      <div className="px-4 py-3 border-b border-gray-200 flex flex-wrap items-center gap-2">
        <FilterChip
          label="Practice admins"
          active={filters.adminsOnly}
          onToggle={() => onFiltersChange({ ...filters, adminsOnly: !filters.adminsOnly })}
        />
        {handbookEnabled && (
          <FilterChip
            label="Handbook access"
            active={filters.handbookOnly}
            onToggle={() => onFiltersChange({ ...filters, handbookOnly: !filters.handbookOnly })}
          />
        )}
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
            Showing {resultCount} of {totalCount} members
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
