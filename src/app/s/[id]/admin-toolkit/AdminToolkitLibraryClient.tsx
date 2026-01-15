'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import type { AdminToolkitCategory, AdminToolkitPageItem } from '@/server/adminToolkit'
import AdminSearchBar from '@/components/admin/AdminSearchBar'
import { useCardStyle } from '@/context/CardStyleContext'

interface AdminToolkitLibraryClientProps {
  surgeryId: string
  canWrite: boolean
  categories: AdminToolkitCategory[]
  items: AdminToolkitPageItem[]
}

export default function AdminToolkitLibraryClient({ surgeryId, canWrite, categories, items }: AdminToolkitLibraryClientProps) {
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
  
  const containerClasses = isBlueStyle
    ? 'bg-[#264c96] rounded-xl shadow-md border border-blue-700 flex flex-col h-full min-h-0'
    : 'bg-white rounded-lg shadow-md border border-gray-200 flex flex-col h-full min-h-0'

  const headerClasses = isBlueStyle
    ? 'flex items-center justify-between border-b border-blue-500 px-4 py-3 shrink-0'
    : 'flex items-center justify-between border-b border-gray-200 px-4 py-3 shrink-0'

  const countTextClasses = isBlueStyle
    ? 'text-sm text-white'
    : 'text-sm text-gray-600'

  const viewOnlyTextClasses = isBlueStyle
    ? 'text-sm text-blue-200'
    : 'text-sm text-gray-500'

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
            className={isBlueStyle ? 'px-4 py-2 bg-white text-[#264c96] rounded-md hover:bg-blue-50 transition-colors font-medium' : 'nhs-button'}
          >
            Add item
          </Link>
        ) : (
          <span className={viewOnlyTextClasses}>You have view-only access.</span>
        )}
      </div>

      <div className={`shrink-0 border-b ${isBlueStyle ? 'border-blue-500' : 'border-gray-200'}`}>
        <AdminSearchBar value={search} onChange={setSearch} placeholder="Search Admin Toolkit…" debounceMs={150} />
      </div>

      {/* Main content zone (scroll container) */}
      <div className="flex-1 min-h-0 overflow-y-auto pb-56">
        <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] min-h-0">
          {/* Sidebar: categories */}
          <aside className={`border-b md:border-b-0 md:border-r ${isBlueStyle ? 'border-blue-500 bg-blue-900/30' : 'border-gray-200 bg-gray-50'}`}>
            <div className="px-4 py-4">
              <h2 className={`text-xs font-medium uppercase tracking-wide ${isBlueStyle ? 'text-blue-200' : 'text-gray-500'}`}>Categories</h2>
            </div>
            <nav className="px-2 pb-4">
            <button
              type="button"
              onClick={() => setSelectedCategoryId('ALL')}
              className={[
                'w-full text-left rounded-md px-3 py-2 text-sm flex items-center justify-between',
                isBlueStyle
                  ? selectedCategoryId === 'ALL'
                    ? 'bg-white text-[#264c96] border border-blue-300'
                    : 'hover:bg-white/20 text-white'
                  : selectedCategoryId === 'ALL'
                    ? 'bg-white border border-gray-200'
                    : 'hover:bg-white/70',
              ].join(' ')}
            >
              <span className={isBlueStyle && selectedCategoryId !== 'ALL' ? 'text-white' : isBlueStyle ? 'text-[#264c96]' : 'text-gray-900'}>All</span>
              <span className={isBlueStyle && selectedCategoryId !== 'ALL' ? 'text-xs text-blue-200' : isBlueStyle ? 'text-xs text-[#264c96]' : 'text-xs text-gray-500'}>{items.length}</span>
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
                    isBlueStyle
                      ? isSelected
                        ? 'bg-white text-[#264c96] border border-blue-300'
                        : 'hover:bg-white/20 text-white'
                      : isSelected
                        ? 'bg-white border border-gray-200'
                        : 'hover:bg-white/70',
                  ].join(' ')}
                >
                  <span className={isBlueStyle && !isSelected ? 'text-white' : isBlueStyle ? 'text-[#264c96]' : 'text-gray-900'}>{cat.name}</span>
                  <span className={isBlueStyle && !isSelected ? 'text-xs text-blue-200' : isBlueStyle ? 'text-xs text-[#264c96]' : 'text-xs text-gray-500'}>{count}</span>
                </button>
              )
            })}
            </nav>
          </aside>

          {/* Main: items */}
          <section className="p-4">
            {itemsFiltered.length === 0 ? (
              <div className={`py-12 text-center text-sm ${isBlueStyle ? 'text-blue-200' : 'text-gray-500'}`}>
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
    </div>
  )
}

