'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import type React from 'react'
import type { AdminToolkitCategory, AdminToolkitPageItem, AdminQuickLink } from '@/server/adminToolkit'
import AdminSearchBar from '@/components/admin/AdminSearchBar'
import { useCardStyle } from '@/context/CardStyleContext'

interface AdminToolkitLibraryClientProps {
  surgeryId: string
  canWrite: boolean
  categories: AdminToolkitCategory[]
  items: AdminToolkitPageItem[]
  quickLinks: AdminQuickLink[]
}

export default function AdminToolkitLibraryClient({ surgeryId, canWrite, categories, items, quickLinks }: AdminToolkitLibraryClientProps) {
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | 'ALL'>('ALL')
  const [search, setSearch] = useState('')
  const { cardStyle } = useCardStyle()

  const normalisedSearch = useMemo(() => search.trim().toLowerCase(), [search])

  const itemsFiltered = useMemo(() => {
    return items.filter((item) => {
      const matchesCategory = selectedCategoryId === 'ALL' || item.categoryId === selectedCategoryId
      const matchesSearch =
        !normalisedSearch ||
        item.title.toLowerCase().includes(normalisedSearch) ||
        (item.contentHtml ? item.contentHtml.toLowerCase().includes(normalisedSearch) : false)
      return matchesCategory && matchesSearch
    })
  }, [items, selectedCategoryId, normalisedSearch])

  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const item of items) {
      if (!item.categoryId) continue
      counts.set(item.categoryId, (counts.get(item.categoryId) || 0) + 1)
    }
    return counts
  }, [items])

  const isBlueStyle = cardStyle === 'powerappsBlue'
  
  // Container always uses neutral styling (blue mode only affects item cards)
  const containerClasses = 'bg-white rounded-lg shadow-md border border-gray-200'

  // Header always uses neutral styling
  const headerClasses = 'flex items-center justify-between border-b border-gray-200 px-4 py-3 shrink-0'

  const countTextClasses = 'text-sm text-gray-600'

  const viewOnlyTextClasses = 'text-sm text-gray-500'

  return (
    <div className={containerClasses}>
      {/* Header zone (static) */}
      <div className={headerClasses}>
        <div className={countTextClasses} aria-live="polite">
          {itemsFiltered.length} item{itemsFiltered.length === 1 ? '' : 's'}
        </div>
        {canWrite ? (
          <Link 
            href={`/s/${surgeryId}/admin-toolkit/admin`} 
            className="nhs-button"
          >
            Add item
          </Link>
        ) : (
          <span className={viewOnlyTextClasses}>You have view-only access.</span>
        )}
      </div>

      {/* Quick access buttons */}
      {quickLinks.length > 0 && (
        <div className="shrink-0 border-b border-gray-200 px-4 py-3">
          <h3 className="text-xs font-medium uppercase tracking-wide mb-2 text-gray-500">
            Quick access
          </h3>
          <div className="flex flex-wrap gap-2">
            {quickLinks.map((ql) => {
              // Determine if we have custom colors (either or both)
              const hasBgColor = !!ql.bgColor
              const hasTextColor = !!ql.textColor
              const hasCustomColors = hasBgColor || hasTextColor
              
              // Build inline style object
              const buttonStyle: React.CSSProperties = {}
              if (hasBgColor) {
                buttonStyle.backgroundColor = ql.bgColor
                buttonStyle.borderColor = ql.bgColor
              }
              if (hasTextColor) {
                buttonStyle.color = ql.textColor
              }
              
              // If only bgColor is provided, compute a safe default text color
              if (hasBgColor && !hasTextColor) {
                // Simple contrast check: if bg is dark, use white text; otherwise use dark text
                const hex = ql.bgColor.replace('#', '')
                const r = parseInt(hex.substring(0, 2), 16)
                const g = parseInt(hex.substring(2, 4), 16)
                const b = parseInt(hex.substring(4, 6), 16)
                const brightness = (r * 299 + g * 587 + b * 114) / 1000
                buttonStyle.color = brightness < 128 ? '#FFFFFF' : '#000000'
              }
              
              // Base classes (layout only, no color classes when custom colors are present)
              const baseClasses = 'px-4 py-2 rounded-md font-medium text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2'
              const hoverClasses = hasCustomColors ? 'hover:opacity-90' : ''
              const borderClasses = hasCustomColors ? 'border' : ''
              
              // Default button classes (only used when no custom colors)
              const defaultButtonClasses = hasCustomColors
                ? `${baseClasses} ${hoverClasses} ${borderClasses}`
                : `${baseClasses} bg-nhs-blue text-white hover:bg-nhs-dark-blue focus:ring-nhs-blue`
              
              return (
                <Link
                  key={ql.id}
                  href={`/s/${surgeryId}/admin-toolkit/${ql.adminItemId}`}
                  className={defaultButtonClasses}
                  style={hasCustomColors ? buttonStyle : undefined}
                >
                  {ql.label}
                </Link>
              )
            })}
          </div>
        </div>
      )}

      <div className="border-b border-gray-200">
        <AdminSearchBar value={search} onChange={setSearch} placeholder="Search Admin Toolkit…" debounceMs={150} />
      </div>

      {/* Main content zone */}
      <div className="grid grid-cols-1 md:grid-cols-[240px_1fr]">
          {/* Sidebar: categories */}
          <aside className="border-b md:border-b-0 md:border-r border-gray-200 bg-gray-50">
            <div className="px-4 py-4">
              <h2 className="text-xs font-medium uppercase tracking-wide text-gray-500">Categories</h2>
            </div>
            <nav className="px-2 pb-4">
            <button
              type="button"
              onClick={() => setSelectedCategoryId('ALL')}
              className={[
                'w-full text-left rounded-md px-3 py-2 text-sm flex items-center justify-between',
                selectedCategoryId === 'ALL'
                  ? 'bg-white border border-gray-200'
                  : 'hover:bg-white/70',
              ].join(' ')}
            >
              <span className="text-gray-900">All</span>
              <span className="text-xs text-gray-500">{items.length}</span>
            </button>

            {categories.map((cat) => {
              const count = categoryCounts.get(cat.id) || 0
              const isSelected = selectedCategoryId === cat.id
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategoryId(cat.id)}
                  className={[
                    'mt-1 w-full text-left rounded-md px-3 py-2 text-sm flex items-center justify-between',
                    isSelected
                      ? 'bg-white border border-gray-200'
                      : 'hover:bg-white/70',
                  ].join(' ')}
                >
                  <span className="text-gray-900">{cat.name}</span>
                  <span className="text-xs text-gray-500">{count}</span>
                </button>
              )
            })}
            </nav>
          </aside>

          {/* Main: items */}
          <section className="p-4">
            {itemsFiltered.length === 0 ? (
              <div className="py-12 text-center text-sm text-gray-500">
                {normalisedSearch ? 'No items match your search.' : 'No items yet.'}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {itemsFiltered.map((item) => {
                  const cardClasses = isBlueStyle
                    ? 'block rounded-xl border border-blue-500 bg-[#305cae] p-4 shadow-sm hover:bg-[#3a6bc0] hover:shadow-md transition-all focus:outline-none focus:ring-2 focus:ring-blue-300'
                    : 'block rounded-lg border border-gray-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow focus:outline-none focus:ring-2 focus:ring-nhs-blue'
                  
                  const titleClasses = isBlueStyle
                    ? 'text-base font-semibold text-white'
                    : 'text-base font-semibold text-nhs-dark-blue'
                  
                  const descriptionClasses = isBlueStyle
                    ? 'mt-2 text-sm text-blue-100 line-clamp-3'
                    : 'mt-2 text-sm text-gray-600 line-clamp-3'
                  
                  const dateClasses = isBlueStyle
                    ? 'mt-3 text-xs text-blue-200'
                    : 'mt-3 text-xs text-gray-500'

                  return (
                    <Link
                      key={item.id}
                      href={`/s/${surgeryId}/admin-toolkit/${item.id}`}
                      className={cardClasses}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <h3 className={titleClasses}>{item.title}</h3>
                        {item.warningLevel ? (
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium border ${
                            isBlueStyle
                              ? 'bg-yellow-200 text-yellow-900 border-yellow-300'
                              : 'bg-yellow-50 text-yellow-800 border-yellow-200'
                          }`}>
                            {item.warningLevel}
                          </span>
                        ) : null}
                      </div>
                      <p className={descriptionClasses}>
                        {item.type === 'LIST' ? 'Open list' : item.contentHtml ? 'Open guidance' : 'No content yet'}
                      </p>
                      <div className={dateClasses}>
                        Updated {new Date(item.updatedAt).toLocaleDateString('en-GB')}
                      </div>
                    </Link>
                  )
                })}
              </div>
            )}
          </section>
        </div>
    </div>
  )
}

