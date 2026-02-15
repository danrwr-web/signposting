'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { AdminToolkitCategory, AdminToolkitPageItem } from '@/server/adminToolkit'
import AdminSearchBar from '@/components/admin/AdminSearchBar'
import { useCardStyle } from '@/context/CardStyleContext'
import type { AdminToolkitQuickAccessButton } from '@/lib/adminToolkitQuickAccessShared'
import { EmptyState } from '@/components/ui/EmptyState'

// Note: Settings cog moved to page header (AdminToolkitHeaderActions component)

interface AdminToolkitLibraryClientProps {
  surgeryId: string
  canWrite: boolean
  categories: AdminToolkitCategory[]
  items: AdminToolkitPageItem[]
  quickAccessButtons: AdminToolkitQuickAccessButton[]
}

export default function AdminToolkitLibraryClient({ surgeryId, canWrite, categories, items, quickAccessButtons }: AdminToolkitLibraryClientProps) {
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | 'ALL'>('ALL')
  const [search, setSearch] = useState('')
  const [changesCount, setChangesCount] = useState<number | null>(null)
  const { cardStyle } = useCardStyle()
  const isBlueCards = cardStyle === 'powerappsBlue'

  const searchStickyRef = useRef<HTMLDivElement>(null)
  const [sidebarStickyTopPx, setSidebarStickyTopPx] = useState(0)

  // Fetch recent changes count for the badge
  useEffect(() => {
    async function fetchChangesCount() {
      try {
        const res = await fetch(`/api/admin-toolkit/changes?surgeryId=${surgeryId}&countOnly=true`)
        if (res.ok) {
          const data = await res.json()
          setChangesCount(data.count ?? 0)
        }
      } catch {
        // Silently fail - badge just won't show
      }
    }
    fetchChangesCount()
  }, [surgeryId])

  useEffect(() => {
    const measure = () => {
      const searchH = searchStickyRef.current?.getBoundingClientRect().height ?? 0
      setSidebarStickyTopPx(searchH)
    }

    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [])

  const normalisedSearch = useMemo(() => search.trim().toLowerCase(), [search])

  // Helper to get all category IDs including children for filtering
  const getCategoryAndChildrenIds = useMemo(() => {
    const helper = (cat: AdminToolkitCategory): string[] => {
      const ids = [cat.id]
      if (cat.children) {
        for (const child of cat.children) {
          ids.push(...helper(child))
        }
      }
      return ids
    }
    return helper
  }, [])

  const itemsFiltered = useMemo(() => {
    return items.filter((item) => {
      let matchesCategory = selectedCategoryId === 'ALL'
      if (selectedCategoryId !== 'ALL') {
        if (item.categoryId === selectedCategoryId) {
          matchesCategory = true
        } else {
          // Check if item belongs to a child of the selected parent category
          const findCategory = (cats: AdminToolkitCategory[], targetId: string): AdminToolkitCategory | null => {
            for (const cat of cats) {
              if (cat.id === targetId) return cat
              if (cat.children) {
                const found = findCategory(cat.children, targetId)
                if (found) return found
              }
            }
            return null
          }
          const selectedCat = findCategory(categories, selectedCategoryId)
          if (selectedCat && selectedCat.children) {
            const childIds = getCategoryAndChildrenIds(selectedCat)
            matchesCategory = item.categoryId !== null && childIds.includes(item.categoryId)
          }
        }
      }
      const matchesSearch =
        !normalisedSearch ||
        item.title.toLowerCase().includes(normalisedSearch) ||
        (item.contentHtml ? item.contentHtml.toLowerCase().includes(normalisedSearch) : false)
      return matchesCategory && matchesSearch
    })
  }, [items, selectedCategoryId, normalisedSearch, categories, getCategoryAndChildrenIds])

  const itemsSorted = useMemo(() => {
    return itemsFiltered
      .slice()
      .sort((a, b) => (a.title || '').localeCompare(b.title || '', undefined, { sensitivity: 'base' }))
  }, [itemsFiltered])

  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const item of items) {
      if (!item.categoryId) continue
      counts.set(item.categoryId, (counts.get(item.categoryId) || 0) + 1)
    }
    
    // Helper to recursively count items in a category and its children
    const countCategoryAndChildren = (cat: AdminToolkitCategory): number => {
      const directCount = counts.get(cat.id) || 0
      const childrenCount = cat.children?.reduce((sum, child) => sum + countCategoryAndChildren(child), 0) || 0
      return directCount + childrenCount
    }
    
    // Update counts to include children for parent categories
    const updateCounts = (cats: AdminToolkitCategory[]) => {
      for (const cat of cats) {
        if (cat.children && cat.children.length > 0) {
          const totalCount = countCategoryAndChildren(cat)
          counts.set(cat.id, totalCount)
          updateCounts(cat.children)
        }
      }
    }
    updateCounts(categories)
    
    return counts
  }, [items, categories])

  const quickAccessRenderable = useMemo(() => {
    if (!quickAccessButtons || quickAccessButtons.length === 0) return []
    const itemById = new Map(items.map((it) => [it.id, it]))
    return quickAccessButtons
      .slice()
      .sort((a, b) => a.orderIndex - b.orderIndex)
      .map((b) => ({ button: b, item: itemById.get(b.itemId) ?? null }))
      .filter((x) => x.item !== null)
  }, [quickAccessButtons, items])

  return (
    <div className="bg-white rounded-lg shadow-md border border-gray-200">
      {/* Header zone */}
      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
        <div className="flex items-center gap-2 text-sm text-gray-600" aria-live="polite">
          <span>{itemsSorted.length} page{itemsSorted.length === 1 ? '' : 's'}</span>
          <span className="text-gray-300">•</span>
          <Link
            href={`/s/${surgeryId}/admin-toolkit/changes`}
            className={`px-2.5 py-1 rounded-md text-sm transition-colors ${
              changesCount !== null && changesCount > 0
                ? 'text-nhs-blue font-medium hover:bg-blue-50 hover:underline'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            What&apos;s changed
            {changesCount !== null && changesCount > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center min-w-[1.25rem] px-1.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-900">
                {changesCount}
              </span>
            )}
          </Link>
        </div>
        {canWrite ? null : <span className="text-sm text-gray-500">You have view-only access.</span>}
      </div>

      {quickAccessRenderable.length > 0 ? (
        <div className="border-b border-gray-200 px-4 py-3">
          <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">Quick access</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {quickAccessRenderable.map(({ button, item }) => (
              <Link
                key={button.id}
                href={`/s/${surgeryId}/admin-toolkit/${item!.id}`}
                className="inline-flex items-center rounded-md px-3 py-2 text-sm font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-nhs-yellow focus:ring-offset-2"
                style={{ backgroundColor: button.backgroundColour, color: button.textColour }}
              >
                {button.label?.trim() ? button.label : item!.title}
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      <div ref={searchStickyRef} className="sticky top-0 z-20 border-b border-gray-200 bg-white">
        <AdminSearchBar value={search} onChange={setSearch} placeholder="Search handbook…" debounceMs={150} />
      </div>

      {/* Main content zone (normal page scroll) */}
      <div className="grid grid-cols-1 md:grid-cols-[240px_1fr]">
          {/* Sidebar: categories */}
          <aside
            className={`border-b md:border-b-0 md:border-r border-gray-200 md:sticky md:self-start ${
              isBlueCards ? 'bg-nhs-blue' : 'bg-gray-50'
            }`}
            style={sidebarStickyTopPx ? { top: sidebarStickyTopPx } : undefined}
          >
            <div className="px-4 py-4">
              <h2 className={`text-xs font-medium uppercase tracking-wide ${
                isBlueCards ? 'text-white' : 'text-gray-500'
              }`}>Categories</h2>
            </div>
            <nav
              className="px-2 pb-4"
              aria-label="Practice Handbook categories"
            >
            <button
              type="button"
              onClick={() => setSelectedCategoryId('ALL')}
              className={[
                'w-full text-left rounded-md px-3 py-2 text-sm flex items-center justify-between transition-colors',
                isBlueCards
                  ? selectedCategoryId === 'ALL'
                    ? 'bg-nhs-light-blue text-nhs-dark-blue'
                    : 'text-white hover:bg-white/20'
                  : selectedCategoryId === 'ALL'
                    ? 'bg-white border border-gray-200'
                    : 'hover:bg-white/70',
              ].join(' ')}
            >
              <span className={isBlueCards && selectedCategoryId !== 'ALL' ? 'text-white' : isBlueCards ? 'text-nhs-dark-blue' : 'text-gray-900'}>All</span>
              <span className={`text-xs ${
                isBlueCards
                  ? selectedCategoryId === 'ALL'
                    ? 'text-nhs-dark-blue'
                    : 'text-white/80'
                  : 'text-gray-500'
              }`}>{items.length}</span>
            </button>

            {categories.map((cat) => {
              const count = categoryCounts.get(cat.id) || 0
              const isSelected = selectedCategoryId === cat.id
              return (
                <div key={cat.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedCategoryId(cat.id)}
                    className={[
                      'mt-1 w-full text-left rounded-md px-3 py-2 text-sm flex items-center justify-between transition-colors',
                      isBlueCards
                        ? isSelected
                          ? 'bg-nhs-light-blue text-nhs-dark-blue'
                          : 'text-white hover:bg-white/20'
                        : isSelected
                          ? 'bg-white border border-gray-200'
                          : 'hover:bg-white/70',
                    ].join(' ')}
                  >
                    <span className={
                      isBlueCards
                        ? isSelected
                          ? 'text-nhs-dark-blue font-medium'
                          : 'text-white font-medium'
                        : 'text-gray-900 font-medium'
                    }>{cat.name}</span>
                    <span className={`text-xs ${
                      isBlueCards
                        ? isSelected
                          ? 'text-nhs-dark-blue'
                          : 'text-white/80'
                        : 'text-gray-500'
                    }`}>{count}</span>
                  </button>
                  {cat.children && cat.children.length > 0 && (
                    <div className="pl-4 mt-1 space-y-1">
                      {cat.children.map((child) => {
                        const childCount = categoryCounts.get(child.id) || 0
                        const isChildSelected = selectedCategoryId === child.id
                        return (
                          <button
                            key={child.id}
                            type="button"
                            onClick={() => setSelectedCategoryId(child.id)}
                            className={[
                              'w-full text-left rounded-md px-3 py-1.5 text-sm flex items-center justify-between transition-colors',
                              isBlueCards
                                ? isChildSelected
                                  ? 'bg-nhs-light-blue text-nhs-dark-blue'
                                  : 'text-white/90 hover:bg-white/20'
                                : isChildSelected
                                  ? 'bg-white border border-gray-200'
                                  : 'hover:bg-white/70',
                            ].join(' ')}
                          >
                            <span className={`text-sm ${
                              isBlueCards
                                ? isChildSelected
                                  ? 'text-nhs-dark-blue'
                                  : 'text-white/90'
                                : 'text-gray-700'
                            }`}>↳ {child.name}</span>
                            <span className={`text-xs ${
                              isBlueCards
                                ? isChildSelected
                                  ? 'text-nhs-dark-blue'
                                  : 'text-white/70'
                                : 'text-gray-500'
                            }`}>{childCount}</span>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
            </nav>
          </aside>

          {/* Main: pages */}
          <section className="p-4 lg:pb-64">
            {itemsSorted.length === 0 ? (
              <EmptyState
                illustration={normalisedSearch ? 'search' : 'documents'}
                title={normalisedSearch ? 'No pages match your search' : 'No pages yet'}
                description={normalisedSearch
                  ? 'Try a different search term or clear your search.'
                  : 'Add your first handbook page to get started.'}
                action={normalisedSearch
                  ? { label: 'Clear search', onClick: () => setSearch(''), variant: 'secondary' }
                  : canWrite
                    ? { label: 'Add page', href: `/s/${surgeryId}/admin-toolkit/admin` }
                    : undefined}
              />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {itemsSorted.map((item) => (
                  <Link
                    key={item.id}
                    href={`/s/${surgeryId}/admin-toolkit/${item.id}`}
                    className={`block rounded-lg border p-4 shadow-sm hover:shadow-md transition-shadow focus:outline-none focus:ring-2 ${
                      isBlueCards
                        ? 'border-nhs-blue bg-nhs-blue text-white hover:bg-nhs-dark-blue focus:ring-nhs-yellow focus:ring-offset-2 focus:ring-offset-white'
                        : 'border-gray-200 bg-white focus:ring-nhs-blue'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <h3 className={`text-base font-semibold ${isBlueCards ? 'text-white' : 'text-nhs-dark-blue'}`}>{item.title}</h3>
                      {item.warningLevel ? (
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium border ${
                          isBlueCards
                            ? 'bg-yellow-400/30 text-yellow-100 border-yellow-300/50'
                            : 'bg-yellow-50 text-yellow-800 border-yellow-200'
                        }`}>
                          {item.warningLevel}
                        </span>
                      ) : null}
                    </div>
                    <p className={`mt-2 text-sm line-clamp-3 ${isBlueCards ? 'text-white/90' : 'text-gray-600'}`}>
                      {item.type === 'LIST' ? 'Open list' : item.contentHtml ? 'Open guidance' : 'No content yet'}
                    </p>
                    <div className={`mt-3 text-xs ${isBlueCards ? 'text-white/70' : 'text-gray-500'}`}>
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

