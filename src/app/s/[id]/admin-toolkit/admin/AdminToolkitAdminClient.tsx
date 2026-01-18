'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import toast from 'react-hot-toast'
import RichTextEditor from '@/components/rich-text/RichTextEditor'
import { sanitizeHtml } from '@/lib/sanitizeHtml'
import type { AdminToolkitCategory, AdminToolkitPageItem, AdminToolkitPinnedPanel } from '@/server/adminToolkit'
import {
  createAdminToolkitCategory,
  deleteAdminToolkitCategory,
  renameAdminToolkitCategory,
  reorderAdminToolkitCategories,
  createAdminToolkitItem,
  updateAdminToolkitItem,
  deleteAdminToolkitItem,
  setAdminToolkitItemEditors,
  upsertAdminToolkitPinnedPanel,
  setAdminToolkitOnTakeWeek,
  getAdminToolkitOnTakeWeekValue,
  createAdminToolkitListColumn,
  updateAdminToolkitListColumn,
  deleteAdminToolkitListColumn,
  reorderAdminToolkitListColumns,
} from '../actions'

type EditorCandidate = { id: string; name: string | null; email: string }

interface AdminToolkitAdminClientProps {
  surgeryId: string
  currentWeekCommencingIso: string
  initialWeekCommencingIso: string
  initialOnTakeGpName: string | null
  upcomingWeeks: Array<{ weekCommencingIso: string; gpName: string | null }>
  initialPanel: AdminToolkitPinnedPanel
  initialCategories: AdminToolkitCategory[]
  initialItems: AdminToolkitPageItem[]
  editorCandidates: EditorCandidate[]
  initialItemId?: string
  initialTab?: 'items' | 'settings'
}

type PageEditorMode = 'create' | 'edit'

type PageFormState = {
  type: 'PAGE' | 'LIST'
  title: string
  categoryId: string | null
  warningLevel: string
  contentHtml: string
  lastReviewedDate: string // YYYY-MM-DD (local input), stored as UTC midnight when saving
  editorUserIds: string[]
}

const DEFAULT_PAGE_FORM: PageFormState = {
  type: 'PAGE',
  title: '',
  categoryId: null,
  warningLevel: '',
  contentHtml: '',
  lastReviewedDate: '',
  editorUserIds: [],
}

function addDaysIso(weekCommencingIso: string, days: number): string {
  const d = new Date(`${weekCommencingIso}T00:00:00.000Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

function weekStartMondayIso(inputIso: string): string {
  const d = new Date(`${inputIso}T00:00:00.000Z`)
  const day = d.getUTCDay() // 0=Sun ... 6=Sat
  const delta = (day + 6) % 7
  d.setUTCDate(d.getUTCDate() - delta)
  return d.toISOString().slice(0, 10)
}

function formatLondonDateNoWeekday(iso: string): string {
  return new Date(`${iso}T00:00:00.000Z`).toLocaleDateString('en-GB', {
    timeZone: 'Europe/London',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export default function AdminToolkitAdminClient({
  surgeryId,
  currentWeekCommencingIso,
  initialWeekCommencingIso,
  initialOnTakeGpName,
  upcomingWeeks,
  initialPanel,
  initialCategories,
  initialItems,
  editorCandidates,
  initialItemId,
  initialTab = 'items',
}: AdminToolkitAdminClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const titleInputRef = useRef<HTMLInputElement>(null)
  
  // Tab state with URL query param persistence
  const [activeTab, setActiveTab] = useState<'items' | 'settings'>(() => {
    const tabParam = searchParams.get('tab')
    return tabParam === 'items' || tabParam === 'settings' ? tabParam : initialTab
  })
  
  const handleTabChange = (tab: 'items' | 'settings') => {
    setActiveTab(tab)
    const params = new URLSearchParams(searchParams.toString())
    params.set('tab', tab)
    router.push(`/s/${surgeryId}/admin-toolkit/admin?${params.toString()}`, { scroll: false })
  }
  const [categories, setCategories] = useState(initialCategories)
  const [items, setItems] = useState(initialItems)

  const [newCategoryName, setNewCategoryName] = useState('')
  const [newSubcategoryName, setNewSubcategoryName] = useState('')
  const [addingSubcategoryToId, setAddingSubcategoryToId] = useState<string | null>(null)
  const [renamingCategoryId, setRenamingCategoryId] = useState<string | null>(null)
  const [renamingValue, setRenamingValue] = useState('')

  // Default behaviour: open in "Create item" mode unless an item is explicitly selected.
  const [mode, setMode] = useState<PageEditorMode>(() => (initialItemId ? 'edit' : 'create'))
  const [selectedItemId, setSelectedItemId] = useState<string | null>(() => initialItemId ?? null)
  const selectedItem = useMemo(() => (selectedItemId ? items.find((i) => i.id === selectedItemId) || null : null), [
    items,
    selectedItemId,
  ])
  const [form, setForm] = useState<PageFormState>(DEFAULT_PAGE_FORM)
  const [showAddAnotherHint, setShowAddAnotherHint] = useState(false)
  const [newListColumnLabel, setNewListColumnLabel] = useState('')
  const [newListColumnType, setNewListColumnType] = useState<'TEXT' | 'MULTILINE' | 'PHONE' | 'EMAIL' | 'URL'>('TEXT')

  const [panelTaskBuddy, setPanelTaskBuddy] = useState(initialPanel.taskBuddyText ?? '')
  const [panelPostRoute, setPanelPostRoute] = useState(initialPanel.postRouteText ?? '')
  const [panelSaved, setPanelSaved] = useState(() => ({
    taskBuddyText: initialPanel.taskBuddyText ?? '',
    postRouteText: initialPanel.postRouteText ?? '',
  }))

  const [selectedWeekCommencingIso, setSelectedWeekCommencingIso] = useState<string>(initialWeekCommencingIso)
  const [onTakeGpName, setOnTakeGpName] = useState(initialOnTakeGpName ?? '')
  const [onTakeLoading, setOnTakeLoading] = useState(false)
  const [onTakeDirty, setOnTakeDirty] = useState(false)
  const [upcomingMap, setUpcomingMap] = useState<Record<string, string | null>>(() => {
    const map: Record<string, string | null> = {}
    for (const w of upcomingWeeks) map[w.weekCommencingIso] = w.gpName
    return map
  })

  function focusTitle() {
    requestAnimationFrame(() => titleInputRef.current?.focus())
  }

  function formFromItem(item: AdminToolkitPageItem): PageFormState {
    return {
      type: item.type,
      title: item.title ?? '',
      categoryId: item.categoryId ?? null,
      warningLevel: item.warningLevel ?? '',
      contentHtml: item.contentHtml ?? '',
      lastReviewedDate: item.lastReviewedAt ? new Date(item.lastReviewedAt).toISOString().slice(0, 10) : '',
      editorUserIds: item.editors.map((e) => e.userId),
    }
  }

  function enterCreateMode() {
    setMode('create')
    setSelectedItemId(null)
    setShowAddAnotherHint(false)
    setForm(DEFAULT_PAGE_FORM)
    setNewListColumnLabel('')
    setNewListColumnType('TEXT')
    focusTitle()
  }

  function enterEditMode(itemId: string) {
    setMode('edit')
    setSelectedItemId(itemId)
    setShowAddAnotherHint(false)
    setNewListColumnLabel('')
    setNewListColumnType('TEXT')
  }

  function toUtcMidnightIso(dateOnly: string): string {
    // Input format from <input type="date"> is YYYY-MM-DD
    return new Date(`${dateOnly}T00:00:00.000Z`).toISOString()
  }

  // Sync server-provided props after router.refresh()
  useEffect(() => {
    setCategories(initialCategories)
  }, [initialCategories])

  useEffect(() => {
    setItems(initialItems)
  }, [initialItems])

  useEffect(() => {
    // Populate the form ONLY when an item is explicitly selected in edit mode.
    if (mode !== 'edit') return
    if (!selectedItemId) return

    const item = items.find((i) => i.id === selectedItemId) || null
    if (!item) {
      // The selected item no longer exists (e.g. deleted). Return to a blank create form.
      enterCreateMode()
      return
    }

    setForm(formFromItem(item))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, selectedItemId, items])

  useEffect(() => {
    setPanelTaskBuddy(initialPanel.taskBuddyText ?? '')
    setPanelPostRoute(initialPanel.postRouteText ?? '')
    setPanelSaved({
      taskBuddyText: initialPanel.taskBuddyText ?? '',
      postRouteText: initialPanel.postRouteText ?? '',
    })
  }, [initialPanel.taskBuddyText, initialPanel.postRouteText])

  useEffect(() => {
    // Refresh the upcoming list snapshot on server refresh.
    setUpcomingMap(() => {
      const map: Record<string, string | null> = {}
      for (const w of upcomingWeeks) map[w.weekCommencingIso] = w.gpName
      return map
    })
    // If we are still on the initially rendered week, keep its value in sync unless the user has edited.
    if (selectedWeekCommencingIso === initialWeekCommencingIso && !onTakeDirty) {
      setOnTakeGpName(initialOnTakeGpName ?? '')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [upcomingWeeks, initialOnTakeGpName, initialWeekCommencingIso])

  useEffect(() => {
    // When switching week: load from upcoming list first; otherwise query server.
    let cancelled = false
    async function load() {
      setOnTakeLoading(true)
      try {
        const local = upcomingMap[selectedWeekCommencingIso]
        if (local !== undefined) {
          if (!cancelled) setOnTakeGpName(local ?? '')
          return
        }
        const res = await getAdminToolkitOnTakeWeekValue({ surgeryId, weekCommencingIso: selectedWeekCommencingIso })
        if (!res.ok) {
          if (!cancelled) toast.error(res.error.message)
          return
        }
        if (!cancelled) setOnTakeGpName(res.data.gpName ?? '')
      } finally {
        if (!cancelled) setOnTakeLoading(false)
      }
    }
    setOnTakeDirty(false)
    load()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedWeekCommencingIso, surgeryId])
  // IMPORTANT: do not auto-select an item on refresh/navigation.
  // The editor should remain blank in create mode until the user explicitly selects an item.

  const refresh = async () => {
    router.refresh()
  }

  return (
    <div>
      {/* Tab Navigation */}
      <div className="bg-white rounded-lg shadow-sm mb-6">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6">
            {[
              { id: 'items', label: 'Items' },
              { id: 'settings', label: 'Structure & Settings' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id as 'items' | 'settings')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.id
                    ? 'border-nhs-blue text-nhs-blue'
                    : 'border-transparent text-nhs-grey hover:text-nhs-blue hover:border-gray-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'items' ? (
        <ItemsTab
          surgeryId={surgeryId}
          categories={categories}
          items={items}
          selectedItemId={selectedItemId}
          mode={mode}
          form={form}
          setForm={setForm}
          showAddAnotherHint={showAddAnotherHint}
          setShowAddAnotherHint={setShowAddAnotherHint}
          newListColumnLabel={newListColumnLabel}
          setNewListColumnLabel={setNewListColumnLabel}
          newListColumnType={newListColumnType}
          setNewListColumnType={setNewListColumnType}
          editorCandidates={editorCandidates}
          selectedItem={selectedItem}
          titleInputRef={titleInputRef}
          enterCreateMode={enterCreateMode}
          enterEditMode={enterEditMode}
          refresh={refresh}
          toUtcMidnightIso={toUtcMidnightIso}
          formFromItem={formFromItem}
          focusTitle={focusTitle}
        />
      ) : (
        <StructureSettingsTab
          surgeryId={surgeryId}
          categories={categories}
          items={items}
          newCategoryName={newCategoryName}
          setNewCategoryName={setNewCategoryName}
          newSubcategoryName={newSubcategoryName}
          setNewSubcategoryName={setNewSubcategoryName}
          addingSubcategoryToId={addingSubcategoryToId}
          setAddingSubcategoryToId={setAddingSubcategoryToId}
          renamingCategoryId={renamingCategoryId}
          setRenamingCategoryId={setRenamingCategoryId}
          renamingValue={renamingValue}
          setRenamingValue={setRenamingValue}
          panelTaskBuddy={panelTaskBuddy}
          setPanelTaskBuddy={setPanelTaskBuddy}
          panelPostRoute={panelPostRoute}
          setPanelPostRoute={setPanelPostRoute}
          panelSaved={panelSaved}
          setPanelSaved={setPanelSaved}
          currentWeekCommencingIso={currentWeekCommencingIso}
          selectedWeekCommencingIso={selectedWeekCommencingIso}
          setSelectedWeekCommencingIso={setSelectedWeekCommencingIso}
          onTakeGpName={onTakeGpName}
          setOnTakeGpName={setOnTakeGpName}
          onTakeLoading={onTakeLoading}
          onTakeDirty={onTakeDirty}
          setOnTakeDirty={setOnTakeDirty}
          upcomingWeeks={upcomingWeeks}
          upcomingMap={upcomingMap}
          setUpcomingMap={setUpcomingMap}
          refresh={refresh}
          addDaysIso={addDaysIso}
          weekStartMondayIso={weekStartMondayIso}
          formatLondonDateNoWeekday={formatLondonDateNoWeekday}
        />
      )}
    </div>
  )
}

// Items Tab Component
function ItemsTab({
  surgeryId,
  categories,
  items,
  selectedItemId,
  mode,
  form,
  setForm,
  showAddAnotherHint,
  setShowAddAnotherHint,
  newListColumnLabel,
  setNewListColumnLabel,
  newListColumnType,
  setNewListColumnType,
  editorCandidates,
  selectedItem,
  titleInputRef,
  enterCreateMode,
  enterEditMode,
  refresh,
  toUtcMidnightIso,
  formFromItem,
  focusTitle,
}: {
  surgeryId: string
  categories: AdminToolkitCategory[]
  items: AdminToolkitPageItem[]
  selectedItemId: string | null
  mode: PageEditorMode
  form: PageFormState
  setForm: React.Dispatch<React.SetStateAction<PageFormState>>
  showAddAnotherHint: boolean
  setShowAddAnotherHint: React.Dispatch<React.SetStateAction<boolean>>
  newListColumnLabel: string
  setNewListColumnLabel: React.Dispatch<React.SetStateAction<string>>
  newListColumnType: 'TEXT' | 'MULTILINE' | 'PHONE' | 'EMAIL' | 'URL'
  setNewListColumnType: React.Dispatch<React.SetStateAction<'TEXT' | 'MULTILINE' | 'PHONE' | 'EMAIL' | 'URL'>>
  editorCandidates: EditorCandidate[]
  selectedItem: AdminToolkitPageItem | null
  titleInputRef: React.RefObject<HTMLInputElement>
  enterCreateMode: () => void
  enterEditMode: (itemId: string) => void
  refresh: () => Promise<void>
  toUtcMidnightIso: (dateOnly: string) => string
  formFromItem: (item: AdminToolkitPageItem) => PageFormState
  focusTitle: () => void
}) {
  const [searchTerm, setSearchTerm] = useState('')
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'PAGE' | 'LIST'>('ALL')
  const [categoryFilterId, setCategoryFilterId] = useState<string | 'ALL' | 'UNCAT'>('ALL')

  const categoryById = useMemo(() => {
    const map = new Map<string, { id: string; name: string; parentId: string | null }>()
    for (const parent of categories) {
      map.set(parent.id, { id: parent.id, name: parent.name, parentId: null })
      for (const child of parent.children ?? []) {
        map.set(child.id, { id: child.id, name: child.name, parentId: parent.id })
      }
    }
    return map
  }, [categories])

  const childIdsByParentId = useMemo(() => {
    const map = new Map<string, string[]>()
    for (const parent of categories) {
      map.set(parent.id, (parent.children ?? []).map((c) => c.id))
    }
    return map
  }, [categories])

  const topLevelIdForCategoryId = useMemo(() => {
    const map = new Map<string, string>()
    for (const [id, c] of categoryById.entries()) {
      map.set(id, c.parentId ?? id)
    }
    return map
  }, [categoryById])

  const filteredItems = useMemo(() => {
    const q = searchTerm.trim().toLowerCase()
    return items.filter((it) => {
      if (typeFilter !== 'ALL' && it.type !== typeFilter) return false
      if (q && !it.title.toLowerCase().includes(q)) return false

      if (categoryFilterId === 'ALL') return true
      if (categoryFilterId === 'UNCAT') return it.categoryId == null
      if (it.categoryId == null) return false

      if (it.categoryId === categoryFilterId) return true

      // If filtering by a parent category, include items in its child categories.
      const childIds = childIdsByParentId.get(categoryFilterId) ?? []
      return childIds.includes(it.categoryId)
    })
  }, [items, searchTerm, typeFilter, categoryFilterId, childIdsByParentId])

  type Group = { key: string; title: string; count: number; items: AdminToolkitPageItem[] }

  const groups = useMemo((): Group[] => {
    const byKey = new Map<string, AdminToolkitPageItem[]>()

    for (const it of filteredItems) {
      const key = it.categoryId ? topLevelIdForCategoryId.get(it.categoryId) ?? 'UNCAT' : 'UNCAT'
      byKey.set(key, [...(byKey.get(key) ?? []), it])
    }

    const makeTitle = (key: string) => {
      if (key === 'UNCAT') return 'Uncategorised'
      return categoryById.get(key)?.name ?? 'Other'
    }

    const sorted = Array.from(byKey.entries())
      .map(([key, its]) => {
        const itemsSorted = its.slice().sort((a, b) => {
          const at = new Date(a.updatedAt).getTime()
          const bt = new Date(b.updatedAt).getTime()
          if (at !== bt) return bt - at
          return a.title.localeCompare(b.title)
        })
        return { key, title: makeTitle(key), count: itemsSorted.length, items: itemsSorted }
      })
      .sort((a, b) => {
        if (a.key === 'UNCAT') return -1
        if (b.key === 'UNCAT') return 1
        return a.title.localeCompare(b.title)
      })

    return sorted
  }, [filteredItems, topLevelIdForCategoryId, categoryById])

  const expandedStorageKey = useMemo(() => `adminToolkitItemsPickerExpanded:${surgeryId}`, [surgeryId])
  const [expandedGroupKeys, setExpandedGroupKeys] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') return new Set<string>()
    try {
      const raw = window.localStorage.getItem(expandedStorageKey)
      if (!raw) return new Set<string>()
      const parsed = JSON.parse(raw) as unknown
      if (!Array.isArray(parsed)) return new Set<string>()
      return new Set(parsed.filter((x) => typeof x === 'string'))
    } catch {
      return new Set<string>()
    }
  })

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem(expandedStorageKey, JSON.stringify(Array.from(expandedGroupKeys)))
    } catch {
      // ignore
    }
  }, [expandedGroupKeys, expandedStorageKey])

  // If no stored state yet, default to expanding all visible groups.
  useEffect(() => {
    if (expandedGroupKeys.size > 0) return
    if (groups.length === 0) return
    setExpandedGroupKeys(new Set(groups.map((g) => g.key)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groups.length])

  const toggleGroup = (key: string) => {
    setExpandedGroupKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">
      {/* Left Column: Items List */}
      <aside className="bg-white rounded-lg shadow-md border border-gray-200 flex flex-col min-h-0 lg:sticky lg:top-4 lg:max-h-[calc(100vh-6rem)]">
        <div className="p-4 border-b border-gray-200 bg-white">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-nhs-dark-blue">Items</h2>
            <button type="button" className="nhs-button" onClick={enterCreateMode}>
              Create new item
            </button>
          </div>

          <div className="mt-3">
            <label className="sr-only" htmlFor="admin-toolkit-item-search">
              Search items
            </label>
            <input
              id="admin-toolkit-item-search"
              className="w-full nhs-input"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search items…"
            />
          </div>

          <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Item type filter">
            {(['ALL', 'PAGE', 'LIST'] as const).map((t) => {
              const active = typeFilter === t
              const label = t === 'ALL' ? 'All' : t === 'PAGE' ? 'Pages' : 'Lists'
              return (
                <button
                  key={t}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setTypeFilter(t)}
                  className={[
                    'text-sm rounded-full px-3 py-1 border transition',
                    active ? 'bg-nhs-blue text-white border-nhs-blue' : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300',
                  ].join(' ')}
                >
                  {label}
                </button>
              )
            })}
          </div>

          <div className="mt-3">
            <label className="block text-xs font-medium text-gray-600 mb-1" htmlFor="admin-toolkit-category-filter">
              Category (optional)
            </label>
            <select
              id="admin-toolkit-category-filter"
              className="w-full nhs-input"
              value={categoryFilterId}
              onChange={(e) => {
                const v = e.target.value
                if (v === 'ALL' || v === 'UNCAT') {
                  setCategoryFilterId(v)
                } else {
                  setCategoryFilterId(v)
                }
              }}
            >
              <option value="ALL">All categories</option>
              <option value="UNCAT">Uncategorised</option>
              {categories.map((c) => (
                <optgroup key={c.id} label={c.name}>
                  <option value={c.id}>{c.name}</option>
                  {(c.children ?? []).map((child) => (
                    <option key={child.id} value={child.id}>
                      ↳ {child.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
        </div>

        <div className="p-2 overflow-y-auto min-h-0">
          <button
            type="button"
            onClick={enterCreateMode}
            className={[
              'w-full text-left rounded-md px-3 py-2 text-sm border mb-2',
              mode === 'create' ? 'bg-white border-gray-200' : 'bg-white/70 border-transparent hover:border-gray-200',
            ].join(' ')}
          >
            <span className="font-medium text-gray-900">Blank editor (new item)</span>
            <div className="text-xs text-gray-500 mt-0.5">Ready to add a new PAGE or LIST</div>
          </button>

          {filteredItems.length === 0 ? (
            <p className="mt-2 px-1 text-sm text-gray-500">No items match your filters.</p>
          ) : (
            <div className="space-y-2">
              {groups.map((g) => {
                const expanded = expandedGroupKeys.has(g.key)
                const buttonId = `group-${g.key}`
                const panelId = `panel-${g.key}`
                return (
                  <div key={g.key} className="rounded-lg border border-gray-200 bg-white">
                    <button
                      id={buttonId}
                      type="button"
                      className="w-full flex items-center justify-between gap-3 px-3 py-2 text-left"
                      aria-expanded={expanded}
                      aria-controls={panelId}
                      onClick={() => toggleGroup(g.key)}
                    >
                      <span className="font-medium text-gray-900 truncate">{g.title}</span>
                      <span className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">{g.count}</span>
                        <span className="text-gray-500" aria-hidden="true">
                          {expanded ? '▾' : '▸'}
                        </span>
                      </span>
                    </button>
                    {expanded ? (
                      <div id={panelId} role="region" aria-labelledby={buttonId} className="border-t border-gray-200">
                        <div className="py-1">
                          {g.items.map((it) => {
                            const isSelected = it.id === selectedItemId && mode === 'edit'
                            const restricted = it.editors.length > 0
                            const updated = new Date(it.updatedAt).toLocaleDateString('en-GB')
                            return (
                              <button
                                key={it.id}
                                type="button"
                                onClick={() => enterEditMode(it.id)}
                                className={[
                                  'w-full text-left px-3 py-2 text-sm border-l-4',
                                  isSelected ? 'bg-nhs-blue/5 border-l-nhs-blue' : 'hover:bg-gray-50 border-l-transparent',
                                ].join(' ')}
                                title={restricted ? 'Restricted item' : undefined}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0">
                                    <div className="font-medium text-gray-900 truncate">{it.title}</div>
                                    <div className="mt-0.5 text-xs text-gray-500">Updated {updated}</div>
                                  </div>
                                  <div className="flex items-center gap-1 shrink-0">
                                    {it.type === 'LIST' ? (
                                      <span className="text-[11px] rounded-full bg-blue-50 px-2 py-0.5 text-blue-800 border border-blue-200">LIST</span>
                                    ) : (
                                      <span className="text-[11px] rounded-full bg-gray-100 px-2 py-0.5 text-gray-700 border border-gray-200">PAGE</span>
                                    )}
                                    {restricted ? (
                                      <span className="text-[11px] rounded-full bg-gray-200 px-2 py-0.5 text-gray-700">Restricted</span>
                                    ) : null}
                                  </div>
                                </div>
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    ) : null}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </aside>

      {/* Right Column: Item Editor */}
      <div className="bg-white rounded-lg shadow-md p-6">
        {mode === 'create' ? (
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-nhs-dark-blue">Create item</h3>
                <p className="mt-1 text-sm text-nhs-grey">Add a new Admin Toolkit item. After saving, you can add another straight away.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                <select
                  className="w-full nhs-input"
                  value={form.type}
                  onChange={(e) => setForm((prev) => ({ ...prev, type: e.target.value as 'PAGE' | 'LIST' }))}
                >
                  <option value="PAGE">PAGE (guidance)</option>
                  <option value="LIST">LIST (table)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                <input
                  ref={titleInputRef}
                  className="w-full nhs-input"
                  value={form.title}
                  onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                  placeholder="e.g. How to process discharge summaries"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <select
                  className="w-full nhs-input"
                  value={form.categoryId ?? ''}
                  onChange={(e) => setForm((prev) => ({ ...prev, categoryId: e.target.value ? e.target.value : null }))}
                >
                  <option value="">Uncategorised</option>
                  {categories.map((c) => (
                    <optgroup key={c.id} label={c.name}>
                      <option value={c.id}>{c.name}</option>
                      {c.children && c.children.map((child) => (
                        <option key={child.id} value={child.id}>
                          ↳ {child.name}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Warning badge (optional)</label>
                <input
                  className="w-full nhs-input"
                  value={form.warningLevel}
                  onChange={(e) => setForm((prev) => ({ ...prev, warningLevel: e.target.value }))}
                  placeholder="e.g. Urgent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Last reviewed (optional)</label>
                <input
                  type="date"
                  className="w-full nhs-input"
                  value={form.lastReviewedDate}
                  onChange={(e) => setForm((prev) => ({ ...prev, lastReviewedDate: e.target.value }))}
                />
              </div>
            </div>

            <div>
              {form.type === 'PAGE' ? (
                <>
                  <label className="block text-sm font-medium text-gray-700">Content</label>
                  <div className="mt-2">
                    <RichTextEditor
                      value={form.contentHtml}
                      onChange={(html) => setForm((prev) => ({ ...prev, contentHtml: sanitizeHtml(html) }))}
                      height={260}
                      placeholder="Write guidance for staff…"
                    />
                  </div>
                </>
              ) : (
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
                  <strong>This is a LIST item.</strong> You can add and edit rows on the item page after creating it.
                </div>
              )}
            </div>

            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <h4 className="text-sm font-semibold text-gray-900">Restricted editors (optional)</h4>
              <p className="mt-1 text-sm text-gray-600">
                You can set restrictions after creating, or tick names now and we'll apply them after the page is created.
              </p>
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                {editorCandidates.length === 0 ? (
                  <p className="text-sm text-gray-500">No editor candidates yet. Grant write access first.</p>
                ) : (
                  editorCandidates.map((u) => {
                    const checked = form.editorUserIds.includes(u.id)
                    const label = u.name ? `${u.name} (${u.email})` : u.email
                    return (
                      <label key={u.id} className="flex items-center gap-2 text-sm text-gray-800">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            setForm((prev) => {
                              const nextIds = e.target.checked
                                ? Array.from(new Set([...prev.editorUserIds, u.id]))
                                : prev.editorUserIds.filter((x) => x !== u.id)
                              return { ...prev, editorUserIds: nextIds }
                            })
                          }}
                        />
                        <span>{label}</span>
                      </label>
                    )
                  })
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-2 justify-end">
              <button
                type="button"
                className="nhs-button-secondary"
                onClick={() => {
                  setShowAddAnotherHint(false)
                  setForm(DEFAULT_PAGE_FORM)
                  focusTitle()
                }}
              >
                Clear
              </button>
              <button
                type="button"
                className="nhs-button"
                disabled={!form.title.trim()}
                onClick={async () => {
                  const res = await createAdminToolkitItem({
                    surgeryId,
                    type: form.type,
                    title: form.title,
                    categoryId: form.categoryId,
                    contentHtml: form.type === 'PAGE' ? form.contentHtml : '',
                    warningLevel: form.warningLevel || null,
                    lastReviewedAt: form.lastReviewedDate ? toUtcMidnightIso(form.lastReviewedDate) : null,
                  })
                  if (!res.ok) {
                    toast.error(res.error.message)
                    return
                  }
                  // Optional: apply restrictions immediately after create.
                  if (form.editorUserIds.length > 0) {
                    const r = await setAdminToolkitItemEditors({
                      surgeryId,
                      itemId: res.data.id,
                      editorUserIds: form.editorUserIds,
                    })
                    if (!r.ok) {
                      toast.error(r.error.message)
                      return
                    }
                  }

                  toast.custom((t) => (
                    <div className="rounded-lg bg-white shadow-lg border border-gray-200 px-4 py-3">
                      <div className="text-sm text-gray-900">
                        <strong>{form.type === 'LIST' ? 'List created.' : 'Page created.'}</strong>{' '}
                        <a
                          href={`/s/${surgeryId}/admin-toolkit/${res.data.id}`}
                          className="text-nhs-blue underline underline-offset-2"
                        >
                          Open item
                        </a>
                      </div>
                    </div>
                  ))

                  // Reset to a blank "Create item" form for adding another.
                  setShowAddAnotherHint(false)
                  setForm(DEFAULT_PAGE_FORM)
                  focusTitle()
                  await refresh()
                }}
              >
                Create
              </button>
            </div>
          </div>
        ) : !selectedItem ? (
          <div className="py-12 text-center">
            <p className="text-sm text-gray-500">Select an item to edit, or create a new one.</p>
          </div>
        ) : (
          <ItemEditFormContent
            surgeryId={surgeryId}
            categories={categories}
            selectedItem={selectedItem}
            form={form}
            setForm={setForm}
            newListColumnLabel={newListColumnLabel}
            setNewListColumnLabel={setNewListColumnLabel}
            newListColumnType={newListColumnType}
            setNewListColumnType={setNewListColumnType}
            editorCandidates={editorCandidates}
            titleInputRef={titleInputRef}
            refresh={refresh}
            toUtcMidnightIso={toUtcMidnightIso}
            formFromItem={formFromItem}
            focusTitle={focusTitle}
          />
        )}
      </div>
    </div>
  )
}

// Item Edit Form Content (extracted for reuse)
function ItemEditFormContent({
  surgeryId,
  categories,
  selectedItem,
  form,
  setForm,
  newListColumnLabel,
  setNewListColumnLabel,
  newListColumnType,
  setNewListColumnType,
  editorCandidates,
  titleInputRef,
  refresh,
  toUtcMidnightIso,
  formFromItem,
  focusTitle,
}: {
  surgeryId: string
  categories: AdminToolkitCategory[]
  selectedItem: AdminToolkitPageItem
  form: PageFormState
  setForm: React.Dispatch<React.SetStateAction<PageFormState>>
  newListColumnLabel: string
  setNewListColumnLabel: React.Dispatch<React.SetStateAction<string>>
  newListColumnType: 'TEXT' | 'MULTILINE' | 'PHONE' | 'EMAIL' | 'URL'
  setNewListColumnType: React.Dispatch<React.SetStateAction<'TEXT' | 'MULTILINE' | 'PHONE' | 'EMAIL' | 'URL'>>
  editorCandidates: EditorCandidate[]
  titleInputRef: React.RefObject<HTMLInputElement>
  refresh: () => Promise<void>
  toUtcMidnightIso: (dateOnly: string) => string
  formFromItem: (item: AdminToolkitPageItem) => PageFormState
  focusTitle: () => void
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
          <input
            ref={titleInputRef}
            className="w-full nhs-input"
            value={form.title}
            onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
          <select
            className="w-full nhs-input"
            value={form.categoryId ?? ''}
            onChange={(e) => setForm((prev) => ({ ...prev, categoryId: e.target.value ? e.target.value : null }))}
          >
            <option value="">Uncategorised</option>
            {categories.map((c) => (
              <optgroup key={c.id} label={c.name}>
                <option value={c.id}>{c.name}</option>
                {(c.children ?? []).map((child) => (
                  <option key={child.id} value={child.id}>
                    ↳ {child.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Warning badge (optional)</label>
          <input
            className="w-full nhs-input"
            value={form.warningLevel}
            onChange={(e) => setForm((prev) => ({ ...prev, warningLevel: e.target.value }))}
            placeholder="e.g. Urgent"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Last reviewed (optional)</label>
          <input
            type="date"
            className="w-full nhs-input"
            value={form.lastReviewedDate}
            onChange={(e) => setForm((prev) => ({ ...prev, lastReviewedDate: e.target.value }))}
          />
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between gap-3">
          <label className="block text-sm font-medium text-gray-700">Content</label>
          <a
            className="text-sm text-nhs-blue hover:underline"
            href={`/s/${surgeryId}/admin-toolkit/${selectedItem.id}`}
            target="_blank"
            rel="noreferrer noopener"
          >
            Open item
          </a>
        </div>
        {selectedItem.type === 'PAGE' ? (
          <div className="mt-2">
            <RichTextEditor
              value={form.contentHtml}
              onChange={(html) => setForm((prev) => ({ ...prev, contentHtml: sanitizeHtml(html) }))}
              height={260}
              placeholder="Write guidance for staff…"
            />
          </div>
        ) : (
          <div className="mt-2 rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
            <strong>LIST item:</strong> rows are managed on the item page. Use the columns section below to configure fields.
          </div>
        )}
      </div>

      {selectedItem.type === 'LIST' ? (
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <h4 className="text-sm font-semibold text-gray-900">Columns</h4>
          <p className="mt-1 text-sm text-gray-600">Add, rename, and reorder columns for this list.</p>

          <div className="mt-3 grid grid-cols-1 sm:grid-cols-[1fr_180px_auto] gap-2">
            <input
              className="nhs-input"
              placeholder="New column label…"
              value={newListColumnLabel}
              onChange={(e) => setNewListColumnLabel(e.target.value)}
            />
            <select
              className="nhs-input"
              value={newListColumnType}
              onChange={(e) => setNewListColumnType(e.target.value as typeof newListColumnType)}
            >
              <option value="TEXT">Text</option>
              <option value="MULTILINE">Notes</option>
              <option value="PHONE">Phone</option>
              <option value="EMAIL">Email</option>
              <option value="URL">Link</option>
            </select>
            <button
              type="button"
              className="nhs-button"
              onClick={async () => {
                const label = newListColumnLabel.trim()
                if (!label) {
                  toast.error('Enter a column label.')
                  return
                }
                const res = await createAdminToolkitListColumn({
                  surgeryId,
                  itemId: selectedItem.id,
                  label,
                  fieldType: newListColumnType,
                })
                if (!res.ok) {
                  toast.error(res.error.message)
                  return
                }
                toast.success('Column added')
                setNewListColumnLabel('')
                setNewListColumnType('TEXT')
                await refresh()
              }}
            >
              Add
            </button>
          </div>

          <div className="mt-4 space-y-2">
            {(selectedItem.listColumns ?? []).length === 0 ? (
              <p className="text-sm text-gray-500">No columns yet.</p>
            ) : (
              (selectedItem.listColumns ?? []).map((col, idx) => (
                <div key={col.id} className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                  <div className="grid grid-cols-1 md:grid-cols-[1fr_180px_auto] gap-2 items-end">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Label</label>
                      <input
                        className="nhs-input"
                        defaultValue={col.label}
                        onBlur={async (e) => {
                          const nextLabel = e.target.value.trim()
                          if (!nextLabel || nextLabel === col.label) return
                          const r = await updateAdminToolkitListColumn({
                            surgeryId,
                            itemId: selectedItem.id,
                            columnId: col.id,
                            label: nextLabel,
                            fieldType: col.fieldType as any,
                          })
                          if (!r.ok) toast.error(r.error.message)
                          else toast.success('Column updated')
                          await refresh()
                        }}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
                      <select
                        className="nhs-input"
                        value={col.fieldType}
                        onChange={async (e) => {
                          const r = await updateAdminToolkitListColumn({
                            surgeryId,
                            itemId: selectedItem.id,
                            columnId: col.id,
                            label: col.label,
                            fieldType: e.target.value as any,
                          })
                          if (!r.ok) toast.error(r.error.message)
                          else toast.success('Column updated')
                          await refresh()
                        }}
                      >
                        <option value="TEXT">Text</option>
                        <option value="MULTILINE">Notes</option>
                        <option value="PHONE">Phone</option>
                        <option value="EMAIL">Email</option>
                        <option value="URL">Link</option>
                      </select>
                    </div>
                    <div className="flex gap-2 justify-end">
                      <button
                        type="button"
                        className="nhs-button-secondary"
                        disabled={idx === 0}
                        onClick={async () => {
                          const cols = (selectedItem.listColumns ?? []).slice()
                          const tmp = cols[idx - 1]
                          cols[idx - 1] = cols[idx]
                          cols[idx] = tmp
                          const r = await reorderAdminToolkitListColumns({
                            surgeryId,
                            itemId: selectedItem.id,
                            orderedColumnIds: cols.map((c) => c.id),
                          })
                          if (!r.ok) toast.error(r.error.message)
                          else toast.success('Columns reordered')
                          await refresh()
                        }}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        className="nhs-button-secondary"
                        disabled={idx === (selectedItem.listColumns?.length ?? 0) - 1}
                        onClick={async () => {
                          const cols = (selectedItem.listColumns ?? []).slice()
                          const tmp = cols[idx + 1]
                          cols[idx + 1] = cols[idx]
                          cols[idx] = tmp
                          const r = await reorderAdminToolkitListColumns({
                            surgeryId,
                            itemId: selectedItem.id,
                            orderedColumnIds: cols.map((c) => c.id),
                          })
                          if (!r.ok) toast.error(r.error.message)
                          else toast.success('Columns reordered')
                          await refresh()
                        }}
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        className="nhs-button-secondary"
                        onClick={async () => {
                          const ok = confirm(`Delete column "${col.label}"?`)
                          if (!ok) return
                          const r = await deleteAdminToolkitListColumn({ surgeryId, itemId: selectedItem.id, columnId: col.id })
                          if (!r.ok) toast.error(r.error.message)
                          else toast.success('Column deleted')
                          await refresh()
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      ) : null}

      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
        <h4 className="text-sm font-semibold text-gray-900">Restricted editors (optional)</h4>
        <p className="mt-1 text-sm text-gray-600">
          If you tick any names, only those people (and superusers) can edit this item. You still need Admin Toolkit write access.
        </p>
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
          {editorCandidates.length === 0 ? (
            <p className="text-sm text-gray-500">No editor candidates yet. Grant write access first.</p>
          ) : (
            editorCandidates.map((u) => {
              const checked = form.editorUserIds.includes(u.id)
              const label = u.name ? `${u.name} (${u.email})` : u.email
              return (
                <label key={u.id} className="flex items-center gap-2 text-sm text-gray-800">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => {
                      setForm((prev) => {
                        const nextIds = e.target.checked
                          ? Array.from(new Set([...prev.editorUserIds, u.id]))
                          : prev.editorUserIds.filter((x) => x !== u.id)
                        return { ...prev, editorUserIds: nextIds }
                      })
                    }}
                  />
                  <span>{label}</span>
                </label>
              )
            })
          )}
        </div>
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            className="nhs-button-secondary"
            onClick={async () => {
              const res = await setAdminToolkitItemEditors({
                surgeryId,
                itemId: selectedItem.id,
                editorUserIds: form.editorUserIds,
              })
              if (!res.ok) {
                toast.error(res.error.message)
                return
              }
              toast.success('Editors updated')
              await refresh()
            }}
          >
            Save editors
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 justify-end">
        <button
          type="button"
          className="nhs-button-secondary"
          onClick={() => {
            setForm(formFromItem(selectedItem))
            focusTitle()
          }}
        >
          Reset changes
        </button>
        <button
          type="button"
          className="nhs-button"
          onClick={async () => {
            const res = await updateAdminToolkitItem({
              surgeryId,
              itemId: selectedItem.id,
              title: form.title,
              categoryId: form.categoryId,
              contentHtml: selectedItem.type === 'PAGE' ? form.contentHtml : undefined,
              warningLevel: form.warningLevel || null,
              lastReviewedAt: form.lastReviewedDate ? toUtcMidnightIso(form.lastReviewedDate) : null,
            })
            if (!res.ok) {
              toast.error(res.error.message)
              return
            }
            toast.success('Item saved')
            await refresh()
          }}
        >
          Save item
        </button>
        <button
          type="button"
          className="rounded-md bg-nhs-red px-4 py-2 text-white transition-colors hover:bg-nhs-red-dark focus:outline-none focus:ring-2 focus:ring-nhs-red"
          onClick={async () => {
            const ok = confirm('Delete this item?')
            if (!ok) return
            const res = await deleteAdminToolkitItem({ surgeryId, itemId: selectedItem.id })
            if (!res.ok) {
              toast.error(res.error.message)
              return
            }
            toast.success('Item deleted')
            await refresh()
          }}
        >
          Delete item
        </button>
      </div>
    </div>
  )
}

function PinnedPanelPreview({ taskBuddyText, postRouteText }: { taskBuddyText: string; postRouteText: string }) {
  const task = (taskBuddyText || '').trim()
  const post = (postRouteText || '').trim()
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
      <div className="text-xs font-medium text-gray-600 uppercase tracking-wide">Preview</div>
      <div className="mt-3 space-y-3">
        <div className="rounded-md border border-gray-200 bg-white p-3">
          <div className="text-xs font-semibold text-gray-700">Task buddy system</div>
          <div className="mt-1 text-sm text-gray-800 whitespace-pre-wrap">{task || 'Nothing set yet.'}</div>
        </div>
        <div className="rounded-md border border-gray-200 bg-white p-3">
          <div className="text-xs font-semibold text-gray-700">Post route</div>
          <div className="mt-1 text-sm text-gray-800 whitespace-pre-wrap">{post || 'Nothing set yet.'}</div>
        </div>
      </div>
      <p className="mt-3 text-xs text-gray-500">This is a simple mock-up of the pinned panel at the bottom of the Admin Toolkit main page.</p>
    </div>
  )
}

function RotaUpcomingAccordion({
  upcomingWeeks,
  selectedWeekCommencingIso,
  onSelect,
  formatLondonDateNoWeekday,
}: {
  upcomingWeeks: Array<{ weekCommencingIso: string; gpName: string | null }>
  selectedWeekCommencingIso: string
  onSelect: (iso: string) => void
  formatLondonDateNoWeekday: (iso: string) => string
}) {
  return (
    <details className="rounded-lg border border-gray-200 bg-white">
      <summary className="cursor-pointer select-none px-4 py-3 text-sm font-medium text-gray-900">
        Upcoming weeks <span className="text-gray-400">(next 8)</span>
      </summary>
      <div className="border-t border-gray-200 px-4 py-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
          {upcomingWeeks.map((w) => {
            const label = formatLondonDateNoWeekday(w.weekCommencingIso)
            const value = w.gpName || 'Not set'
            return (
              <button
                key={w.weekCommencingIso}
                type="button"
                onClick={() => onSelect(w.weekCommencingIso)}
                className={[
                  'rounded-lg border px-3 py-2 text-left transition-colors',
                  selectedWeekCommencingIso === w.weekCommencingIso ? 'border-nhs-blue bg-nhs-light-blue' : 'border-gray-200 bg-white hover:bg-gray-50',
                ].join(' ')}
              >
                <div className="text-xs text-gray-500">W/C {label}</div>
                <div className={w.gpName ? 'text-sm font-semibold text-gray-900' : 'text-sm text-gray-500'}>{value}</div>
              </button>
            )
          })}
        </div>
      </div>
    </details>
  )
}

// Structure & Settings Tab Component
function StructureSettingsTab({
  surgeryId,
  categories,
  items,
  newCategoryName,
  setNewCategoryName,
  newSubcategoryName,
  setNewSubcategoryName,
  addingSubcategoryToId,
  setAddingSubcategoryToId,
  renamingCategoryId,
  setRenamingCategoryId,
  renamingValue,
  setRenamingValue,
  panelTaskBuddy,
  setPanelTaskBuddy,
  panelPostRoute,
  setPanelPostRoute,
  panelSaved,
  setPanelSaved,
  currentWeekCommencingIso,
  selectedWeekCommencingIso,
  setSelectedWeekCommencingIso,
  onTakeGpName,
  setOnTakeGpName,
  onTakeLoading,
  onTakeDirty,
  setOnTakeDirty,
  upcomingWeeks,
  upcomingMap,
  setUpcomingMap,
  refresh,
  addDaysIso,
  weekStartMondayIso,
  formatLondonDateNoWeekday,
}: {
  surgeryId: string
  categories: AdminToolkitCategory[]
  items: AdminToolkitPageItem[]
  newCategoryName: string
  setNewCategoryName: React.Dispatch<React.SetStateAction<string>>
  newSubcategoryName: string
  setNewSubcategoryName: React.Dispatch<React.SetStateAction<string>>
  addingSubcategoryToId: string | null
  setAddingSubcategoryToId: React.Dispatch<React.SetStateAction<string | null>>
  renamingCategoryId: string | null
  setRenamingCategoryId: React.Dispatch<React.SetStateAction<string | null>>
  renamingValue: string
  setRenamingValue: React.Dispatch<React.SetStateAction<string>>
  panelTaskBuddy: string
  setPanelTaskBuddy: React.Dispatch<React.SetStateAction<string>>
  panelPostRoute: string
  setPanelPostRoute: React.Dispatch<React.SetStateAction<string>>
  panelSaved: { taskBuddyText: string; postRouteText: string }
  setPanelSaved: React.Dispatch<React.SetStateAction<{ taskBuddyText: string; postRouteText: string }>>
  currentWeekCommencingIso: string
  selectedWeekCommencingIso: string
  setSelectedWeekCommencingIso: React.Dispatch<React.SetStateAction<string>>
  onTakeGpName: string
  setOnTakeGpName: React.Dispatch<React.SetStateAction<string>>
  onTakeLoading: boolean
  onTakeDirty: boolean
  setOnTakeDirty: React.Dispatch<React.SetStateAction<boolean>>
  upcomingWeeks: Array<{ weekCommencingIso: string; gpName: string | null }>
  upcomingMap: Record<string, string | null>
  setUpcomingMap: React.Dispatch<React.SetStateAction<Record<string, string | null>>>
  refresh: () => Promise<void>
  addDaysIso: (weekCommencingIso: string, days: number) => string
  weekStartMondayIso: (inputIso: string) => string
  formatLondonDateNoWeekday: (iso: string) => string
}) {
  const [categorySearch, setCategorySearch] = useState('')

  const parentById = useMemo(() => new Map(categories.map((p) => [p.id, p])), [categories])

  const categoryCounts = useMemo(() => {
    const direct = new Map<string, number>()
    for (const it of items) {
      if (!it.categoryId) continue
      direct.set(it.categoryId, (direct.get(it.categoryId) ?? 0) + 1)
    }

    const aggregate = new Map<string, number>()
    for (const parent of categories) {
      const parentDirect = direct.get(parent.id) ?? 0
      const childSum = (parent.children ?? []).reduce((sum, child) => sum + (direct.get(child.id) ?? 0), 0)
      aggregate.set(parent.id, parentDirect + childSum)
      for (const child of parent.children ?? []) {
        aggregate.set(child.id, direct.get(child.id) ?? 0)
      }
    }
    return aggregate
  }, [items, categories])

  const filteredCategories = useMemo(() => {
    const q = categorySearch.trim().toLowerCase()
    if (!q) return categories

    return categories
      .map((parent) => {
        const parentMatch = parent.name.toLowerCase().includes(q)
        const children = (parent.children ?? []).filter((c) => c.name.toLowerCase().includes(q))
        if (parentMatch) return parent
        if (children.length > 0) return { ...parent, children }
        return null
      })
      .filter((x): x is AdminToolkitCategory => x !== null)
  }, [categories, categorySearch])

  const pinnedDirty =
    (panelTaskBuddy ?? '') !== (panelSaved.taskBuddyText ?? '') || (panelPostRoute ?? '') !== (panelSaved.postRouteText ?? '')

  const settingsLinkClass = 'block text-sm text-nhs-blue hover:underline underline-offset-2'

  const ActionButton = ({
    children,
    onClick,
    disabled,
    variant,
    ariaLabel,
  }: {
    children: React.ReactNode
    onClick: () => void
    disabled?: boolean
    variant: 'primary' | 'danger' | 'neutral'
    ariaLabel: string
  }) => (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className={[
        'rounded-md border px-2 py-1 text-sm transition focus:outline-none focus:ring-2 focus:ring-nhs-blue focus:ring-offset-2',
        disabled ? 'opacity-50 cursor-not-allowed' : '',
        variant === 'primary'
          ? 'border-nhs-blue text-nhs-blue hover:bg-nhs-light-blue'
          : variant === 'danger'
            ? 'border-red-200 text-red-700 hover:bg-red-50'
            : 'border-gray-200 text-gray-700 hover:bg-gray-50',
      ].join(' ')}
    >
      {children}
    </button>
  )

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-6">
      {/* Left: settings navigation */}
      <aside className="lg:sticky lg:top-4 h-fit">
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Settings</div>
          <nav className="mt-3 space-y-2">
            <a className={settingsLinkClass} href="#settings-categories">
              Categories
            </a>
            <a className={settingsLinkClass} href="#settings-pinned-panel">
              Pinned panel
            </a>
            <a className={settingsLinkClass} href="#settings-on-take">
              On-take rota (weekly)
            </a>
          </nav>
        </div>
      </aside>

      {/* Right: settings cards */}
      <div className="space-y-6">
        {/* Categories */}
        <section id="settings-categories" className="bg-white rounded-lg shadow-md border border-gray-200 scroll-mt-6">
          <div className="p-6 border-b border-gray-200">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div className="min-w-0">
                <h2 className="text-lg font-semibold text-nhs-dark-blue">Categories</h2>
                <p className="mt-1 text-sm text-nhs-grey">Create and organise categories for Admin Toolkit items.</p>
              </div>
              <div className="w-full md:w-auto flex flex-col md:flex-row gap-2">
                <input
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  className="nhs-input md:w-[260px]"
                  placeholder="New category name…"
                />
                <button
                  type="button"
                  className="nhs-button"
                  disabled={!newCategoryName.trim()}
                  onClick={async () => {
                    const res = await createAdminToolkitCategory({ surgeryId, name: newCategoryName })
                    if (!res.ok) {
                      toast.error(res.error.message)
                      return
                    }
                    toast.success('Category created')
                    setNewCategoryName('')
                    await refresh()
                  }}
                >
                  Add category
                </button>
              </div>
            </div>

            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="category-search">
                Search categories
              </label>
              <input
                id="category-search"
                className="w-full nhs-input"
                value={categorySearch}
                onChange={(e) => setCategorySearch(e.target.value)}
                placeholder="Search parents and subcategories…"
              />
            </div>
          </div>

          <div className="p-6">
            {filteredCategories.length === 0 ? (
              <p className="text-sm text-gray-500">No categories match your search.</p>
            ) : (
              <div className="space-y-2">
                {filteredCategories.map((parent) => {
                  const topLevelIndex = categories.findIndex((c) => c.id === parent.id)
                  const parentCount = categoryCounts.get(parent.id) ?? 0
                  const isParentRenaming = renamingCategoryId === parent.id
                  const isAddingSub = addingSubcategoryToId === parent.id

                  return (
                    <div key={parent.id}>
                      <div className="rounded-lg border border-gray-200 bg-white px-3 py-2">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            {isParentRenaming ? (
                              <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                                <input
                                  className="w-full nhs-input"
                                  value={renamingValue}
                                  onChange={(e) => setRenamingValue(e.target.value)}
                                />
                                <div className="flex gap-2">
                                  <ActionButton
                                    variant="primary"
                                    ariaLabel="Save category rename"
                                    onClick={async () => {
                                      const res = await renameAdminToolkitCategory({ surgeryId, categoryId: parent.id, name: renamingValue })
                                      if (!res.ok) {
                                        toast.error(res.error.message)
                                        return
                                      }
                                      toast.success('Category renamed')
                                      setRenamingCategoryId(null)
                                      setRenamingValue('')
                                      await refresh()
                                    }}
                                  >
                                    Save
                                  </ActionButton>
                                  <ActionButton
                                    variant="neutral"
                                    ariaLabel="Cancel category rename"
                                    onClick={() => {
                                      setRenamingCategoryId(null)
                                      setRenamingValue('')
                                    }}
                                  >
                                    Cancel
                                  </ActionButton>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2 min-w-0">
                                <div className="font-semibold text-gray-900 truncate">{parent.name}</div>
                                <span className="shrink-0 inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700 border border-gray-200">
                                  {parentCount}
                                </span>
                              </div>
                            )}
                          </div>

                          {!isParentRenaming ? (
                            <div className="flex flex-wrap gap-2 justify-end">
                              <ActionButton
                                variant="neutral"
                                ariaLabel="Move category up"
                                disabled={topLevelIndex <= 0}
                                onClick={async () => {
                                  const ordered = categories.slice()
                                  const tmp = ordered[topLevelIndex - 1]
                                  ordered[topLevelIndex - 1] = ordered[topLevelIndex]
                                  ordered[topLevelIndex] = tmp
                                  const res = await reorderAdminToolkitCategories({ surgeryId, orderedCategoryIds: ordered.map((x) => x.id) })
                                  if (!res.ok) {
                                    toast.error(res.error.message)
                                    return
                                  }
                                  toast.success('Category order updated')
                                  await refresh()
                                }}
                              >
                                ↑
                              </ActionButton>
                              <ActionButton
                                variant="neutral"
                                ariaLabel="Move category down"
                                disabled={topLevelIndex === -1 || topLevelIndex >= categories.length - 1}
                                onClick={async () => {
                                  const ordered = categories.slice()
                                  const tmp = ordered[topLevelIndex + 1]
                                  ordered[topLevelIndex + 1] = ordered[topLevelIndex]
                                  ordered[topLevelIndex] = tmp
                                  const res = await reorderAdminToolkitCategories({ surgeryId, orderedCategoryIds: ordered.map((x) => x.id) })
                                  if (!res.ok) {
                                    toast.error(res.error.message)
                                    return
                                  }
                                  toast.success('Category order updated')
                                  await refresh()
                                }}
                              >
                                ↓
                              </ActionButton>
                              <ActionButton variant="primary" ariaLabel="Add subcategory" onClick={() => setAddingSubcategoryToId(parent.id)}>
                                Add subcategory
                              </ActionButton>
                              <ActionButton
                                variant="neutral"
                                ariaLabel="Rename category"
                                onClick={() => {
                                  setRenamingCategoryId(parent.id)
                                  setRenamingValue(parent.name)
                                }}
                              >
                                Rename
                              </ActionButton>
                              <ActionButton
                                variant="danger"
                                ariaLabel="Delete category"
                                onClick={async () => {
                                  const ok = confirm('Delete this category? You can only delete empty categories.')
                                  if (!ok) return
                                  const res = await deleteAdminToolkitCategory({ surgeryId, categoryId: parent.id })
                                  if (!res.ok) {
                                    toast.error(res.error.message)
                                    return
                                  }
                                  toast.success('Category deleted')
                                  await refresh()
                                }}
                              >
                                Delete
                              </ActionButton>
                            </div>
                          ) : null}
                        </div>
                      </div>

                      {isAddingSub ? (
                        <div className="ml-6 mt-2 rounded-lg border border-dashed border-gray-300 bg-gray-50 p-3">
                          <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                            <input
                              className="flex-1 nhs-input"
                              value={newSubcategoryName}
                              onChange={(e) => setNewSubcategoryName(e.target.value)}
                              placeholder="New subcategory name…"
                            />
                            <div className="flex gap-2">
                              <button
                                type="button"
                                className="nhs-button"
                                disabled={!newSubcategoryName.trim()}
                                onClick={async () => {
                                  const res = await createAdminToolkitCategory({ surgeryId, name: newSubcategoryName.trim(), parentCategoryId: parent.id })
                                  if (!res.ok) {
                                    toast.error(res.error.message)
                                    return
                                  }
                                  toast.success('Subcategory created')
                                  setNewSubcategoryName('')
                                  setAddingSubcategoryToId(null)
                                  await refresh()
                                }}
                              >
                                Add
                              </button>
                              <button
                                type="button"
                                className="nhs-button-secondary"
                                onClick={() => {
                                  setAddingSubcategoryToId(null)
                                  setNewSubcategoryName('')
                                }}
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : null}

                      {(parent.children ?? []).length > 0 ? (
                        <div className="mt-2 space-y-2">
                          {(parent.children ?? []).map((child) => {
                            const fullParent = parentById.get(parent.id)
                            const siblings = fullParent?.children ?? []
                            const siblingIndex = siblings.findIndex((x) => x.id === child.id)
                            const childCount = categoryCounts.get(child.id) ?? 0
                            const isChildRenaming = renamingCategoryId === child.id

                            return (
                              <div key={child.id} className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 ml-6">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0 flex-1">
                                    {isChildRenaming ? (
                                      <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                                        <input
                                          className="w-full nhs-input"
                                          value={renamingValue}
                                          onChange={(e) => setRenamingValue(e.target.value)}
                                        />
                                        <div className="flex gap-2">
                                          <ActionButton
                                            variant="primary"
                                            ariaLabel="Save subcategory rename"
                                            onClick={async () => {
                                              const res = await renameAdminToolkitCategory({ surgeryId, categoryId: child.id, name: renamingValue })
                                              if (!res.ok) {
                                                toast.error(res.error.message)
                                                return
                                              }
                                              toast.success('Category renamed')
                                              setRenamingCategoryId(null)
                                              setRenamingValue('')
                                              await refresh()
                                            }}
                                          >
                                            Save
                                          </ActionButton>
                                          <ActionButton
                                            variant="neutral"
                                            ariaLabel="Cancel subcategory rename"
                                            onClick={() => {
                                              setRenamingCategoryId(null)
                                              setRenamingValue('')
                                            }}
                                          >
                                            Cancel
                                          </ActionButton>
                                        </div>
                                      </div>
                                    ) : (
                                      <div className="flex items-center gap-2 min-w-0">
                                        <div className="truncate text-sm text-gray-900">↳ {child.name}</div>
                                        <span className="shrink-0 inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700 border border-gray-200">
                                          {childCount}
                                        </span>
                                      </div>
                                    )}
                                  </div>

                                  {!isChildRenaming ? (
                                    <div className="flex flex-wrap gap-2 justify-end">
                                      <ActionButton
                                        variant="neutral"
                                        ariaLabel="Move subcategory up"
                                        disabled={siblingIndex <= 0}
                                        onClick={async () => {
                                          const ordered = siblings.slice()
                                          const tmp = ordered[siblingIndex - 1]
                                          ordered[siblingIndex - 1] = ordered[siblingIndex]
                                          ordered[siblingIndex] = tmp
                                          const res = await reorderAdminToolkitCategories({ surgeryId, orderedCategoryIds: ordered.map((x) => x.id) })
                                          if (!res.ok) {
                                            toast.error(res.error.message)
                                            return
                                          }
                                          toast.success('Subcategory order updated')
                                          await refresh()
                                        }}
                                      >
                                        ↑
                                      </ActionButton>
                                      <ActionButton
                                        variant="neutral"
                                        ariaLabel="Move subcategory down"
                                        disabled={siblingIndex === -1 || siblingIndex >= siblings.length - 1}
                                        onClick={async () => {
                                          const ordered = siblings.slice()
                                          const tmp = ordered[siblingIndex + 1]
                                          ordered[siblingIndex + 1] = ordered[siblingIndex]
                                          ordered[siblingIndex] = tmp
                                          const res = await reorderAdminToolkitCategories({ surgeryId, orderedCategoryIds: ordered.map((x) => x.id) })
                                          if (!res.ok) {
                                            toast.error(res.error.message)
                                            return
                                          }
                                          toast.success('Subcategory order updated')
                                          await refresh()
                                        }}
                                      >
                                        ↓
                                      </ActionButton>
                                      <ActionButton
                                        variant="neutral"
                                        ariaLabel="Rename subcategory"
                                        onClick={() => {
                                          setRenamingCategoryId(child.id)
                                          setRenamingValue(child.name)
                                        }}
                                      >
                                        Rename
                                      </ActionButton>
                                      <ActionButton
                                        variant="danger"
                                        ariaLabel="Delete subcategory"
                                        onClick={async () => {
                                          const ok = confirm('Delete this category? You can only delete empty categories.')
                                          if (!ok) return
                                          const res = await deleteAdminToolkitCategory({ surgeryId, categoryId: child.id })
                                          if (!res.ok) {
                                            toast.error(res.error.message)
                                            return
                                          }
                                          toast.success('Category deleted')
                                          await refresh()
                                        }}
                                      >
                                        Delete
                                      </ActionButton>
                                    </div>
                                  ) : null}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      ) : null}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </section>

        {/* Pinned panel */}
        <section id="settings-pinned-panel" className="bg-white rounded-lg shadow-md border border-gray-200 scroll-mt-6">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-nhs-dark-blue">Pinned panel</h2>
            <p className="mt-1 text-sm text-nhs-grey">This appears at the bottom of the Admin Toolkit main page.</p>
          </div>
          <div className="p-6 grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Task buddy system</label>
                <p className="text-xs text-gray-500 mb-2">Short steps for staff, including who covers who.</p>
                <textarea
                  className="w-full nhs-input min-h-[120px]"
                  value={panelTaskBuddy}
                  onChange={(e) => setPanelTaskBuddy(e.target.value)}
                  placeholder="Add the steps and who covers who…"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Post route</label>
                <p className="text-xs text-gray-500 mb-2">What to do after the call (trays, handover, routing rules).</p>
                <textarea
                  className="w-full nhs-input min-h-[120px]"
                  value={panelPostRoute}
                  onChange={(e) => setPanelPostRoute(e.target.value)}
                  placeholder="Add the route / trays / handover rules…"
                />
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  className="nhs-button"
                  disabled={!pinnedDirty}
                  onClick={async () => {
                    const res = await upsertAdminToolkitPinnedPanel({
                      surgeryId,
                      taskBuddyText: panelTaskBuddy || null,
                      postRouteText: panelPostRoute || null,
                    })
                    if (!res.ok) {
                      toast.error(res.error.message)
                      return
                    }
                    toast.success('Pinned panel updated')
                    setPanelSaved({ taskBuddyText: panelTaskBuddy ?? '', postRouteText: panelPostRoute ?? '' })
                    await refresh()
                  }}
                >
                  Save pinned panel
                </button>
              </div>
            </div>

            <PinnedPanelPreview taskBuddyText={panelTaskBuddy} postRouteText={panelPostRoute} />
          </div>
        </section>

        {/* Rota */}
        <section id="settings-on-take" className="bg-white rounded-lg shadow-md border border-gray-200 scroll-mt-6">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-nhs-dark-blue">On-take rota (weekly)</h2>
                <p className="mt-1 text-sm text-nhs-grey">Set one GP for each week (Monday to Sunday).</p>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" className="nhs-button-secondary" onClick={() => setSelectedWeekCommencingIso(addDaysIso(selectedWeekCommencingIso, -7))}>
                  Prev
                </button>
                <button type="button" className="nhs-button-secondary" onClick={() => setSelectedWeekCommencingIso(currentWeekCommencingIso)}>
                  This week
                </button>
                <button type="button" className="nhs-button-secondary" onClick={() => setSelectedWeekCommencingIso(addDaysIso(selectedWeekCommencingIso, 7))}>
                  Next
                </button>
              </div>
            </div>
          </div>

          <div className="p-6 space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-4 items-end">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">This week (week commencing Monday)</label>
                <div className="flex items-center gap-3">
                  <input
                    type="date"
                    className="nhs-input"
                    value={selectedWeekCommencingIso}
                    onChange={(e) => {
                      const raw = e.target.value
                      if (!raw) return
                      const monday = weekStartMondayIso(raw)
                      setSelectedWeekCommencingIso(monday)
                    }}
                  />
                  <div className="text-sm text-gray-600">
                    {formatLondonDateNoWeekday(selectedWeekCommencingIso)} – {formatLondonDateNoWeekday(addDaysIso(selectedWeekCommencingIso, 6))}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">GP taking on</label>
                <div className="flex gap-2">
                  <input
                    value={onTakeGpName}
                    onChange={(e) => {
                      setOnTakeGpName(e.target.value)
                      setOnTakeDirty(true)
                    }}
                    className="w-full nhs-input"
                    placeholder="e.g. Dr Patel"
                    disabled={onTakeLoading}
                  />
                  <button
                    type="button"
                    className="nhs-button"
                    disabled={onTakeLoading || !onTakeDirty}
                    onClick={async () => {
                      const res = await setAdminToolkitOnTakeWeek({
                        surgeryId,
                        weekCommencingIso: selectedWeekCommencingIso,
                        gpName: onTakeGpName.trim() ? onTakeGpName.trim() : null,
                      })
                      if (!res.ok) {
                        toast.error(res.error.message)
                        return
                      }
                      toast.success('Saved')
                      setOnTakeDirty(false)
                      setUpcomingMap((prev) => ({ ...prev, [selectedWeekCommencingIso]: onTakeGpName.trim() || null }))
                      await refresh()
                    }}
                  >
                    Save
                  </button>
                </div>
                {onTakeLoading ? <p className="mt-1 text-xs text-gray-500">Loading…</p> : null}
              </div>
            </div>

            <RotaUpcomingAccordion
              upcomingWeeks={upcomingWeeks}
              selectedWeekCommencingIso={selectedWeekCommencingIso}
              onSelect={(iso) => setSelectedWeekCommencingIso(iso)}
              formatLondonDateNoWeekday={formatLondonDateNoWeekday}
            />
          </div>
        </section>
      </div>
    </div>
  )
}

