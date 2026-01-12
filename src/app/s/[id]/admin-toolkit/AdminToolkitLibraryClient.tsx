'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import type { AdminToolkitCategory, AdminToolkitPageItem } from '@/server/adminToolkit'
import AdminSearchBar from '@/components/admin/AdminSearchBar'

interface AdminToolkitLibraryClientProps {
  surgeryId: string
  canWrite: boolean
  categories: AdminToolkitCategory[]
  items: AdminToolkitPageItem[]
}

export default function AdminToolkitLibraryClient({ surgeryId, canWrite, categories, items }: AdminToolkitLibraryClientProps) {
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | 'ALL'>('ALL')
  const [search, setSearch] = useState('')

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

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden flex flex-col h-full min-h-0">
      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 shrink-0">
        <div className="text-sm text-gray-600" aria-live="polite">
          {itemsFiltered.length} item{itemsFiltered.length === 1 ? '' : 's'}
        </div>
        {canWrite ? (
          <Link href={`/s/${surgeryId}/admin-toolkit/admin`} className="nhs-button">
            Add item
          </Link>
        ) : (
          <span className="text-sm text-gray-500">You have view-only access.</span>
        )}
      </div>

      <div className="shrink-0">
        <AdminSearchBar value={search} onChange={setSearch} placeholder="Search Admin Toolkit…" debounceMs={150} />
      </div>

      {/* Scroll region (keeps header/search stable) */}
      <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] min-h-0 flex-1">
        {/* Sidebar: categories */}
        <aside className="border-b md:border-b-0 md:border-r border-gray-200 bg-gray-50 flex flex-col min-h-0">
          <div className="px-4 py-4 shrink-0">
            <h2 className="text-xs font-medium text-gray-500 uppercase tracking-wide">Categories</h2>
          </div>
          <nav className="px-2 pb-4 overflow-y-auto min-h-0">
            <button
              type="button"
              onClick={() => setSelectedCategoryId('ALL')}
              className={[
                'w-full text-left rounded-md px-3 py-2 text-sm flex items-center justify-between',
                selectedCategoryId === 'ALL' ? 'bg-white border border-gray-200' : 'hover:bg-white/70',
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
                    isSelected ? 'bg-white border border-gray-200' : 'hover:bg-white/70',
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
        <section className="p-4 overflow-y-auto min-h-0">
          {itemsFiltered.length === 0 ? (
            <div className="py-12 text-center text-sm text-gray-500">
              {normalisedSearch ? 'No items match your search.' : 'No items yet.'}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {itemsFiltered.map((item) => (
                <Link
                  key={item.id}
                  href={`/s/${surgeryId}/admin-toolkit/${item.id}`}
                  className="block rounded-lg border border-gray-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow focus:outline-none focus:ring-2 focus:ring-nhs-blue"
                >
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-base font-semibold text-nhs-dark-blue">{item.title}</h3>
                    {item.warningLevel ? (
                      <span className="inline-flex items-center rounded-full bg-yellow-50 px-2 py-0.5 text-xs font-medium text-yellow-800 border border-yellow-200">
                        {item.warningLevel}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-2 text-sm text-gray-600 line-clamp-3">
                    {item.contentHtml ? 'Open guidance' : 'No content yet'}
                  </p>
                  <div className="mt-3 text-xs text-gray-500">
                    Updated {new Date(item.updatedAt).toLocaleDateString('en-GB')}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

