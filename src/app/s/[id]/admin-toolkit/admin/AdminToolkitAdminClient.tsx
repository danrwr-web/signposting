'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import RichTextEditor from '@/components/rich-text/RichTextEditor'
import { sanitizeHtml } from '@/lib/sanitizeHtml'
import type { AdminToolkitCategory, AdminToolkitPageItem, AdminToolkitPinnedPanel } from '@/server/adminToolkit'
import {
  createAdminToolkitCategory,
  deleteAdminToolkitCategory,
  renameAdminToolkitCategory,
  reorderAdminToolkitCategories,
  createAdminToolkitPageItem,
  updateAdminToolkitPageItem,
  deleteAdminToolkitItem,
  setAdminToolkitItemEditors,
  upsertAdminToolkitPinnedPanel,
  setAdminToolkitOnTakeWeek,
  getAdminToolkitOnTakeWeekValue,
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
}

const CREATE_PAGE_SENTINEL = '__create_page__'

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
}: AdminToolkitAdminClientProps) {
  const router = useRouter()
  const titleInputRef = useRef<HTMLInputElement>(null)
  const [categories, setCategories] = useState(initialCategories)
  const [items, setItems] = useState(initialItems)

  const [newCategoryName, setNewCategoryName] = useState('')
  const [renamingCategoryId, setRenamingCategoryId] = useState<string | null>(null)
  const [renamingValue, setRenamingValue] = useState('')

  const [selectedItemId, setSelectedItemId] = useState<string | null>(initialItemId || (items[0]?.id ?? null))
  const isCreateMode = selectedItemId === CREATE_PAGE_SENTINEL

  const selectedItem = useMemo(
    () => (isCreateMode ? null : items.find((i) => i.id === selectedItemId) || null),
    [items, selectedItemId, isCreateMode],
  )

  const [itemTitle, setItemTitle] = useState(selectedItem?.title ?? '')
  const [itemCategoryId, setItemCategoryId] = useState<string | null>(selectedItem?.categoryId ?? null)
  const [itemWarningLevel, setItemWarningLevel] = useState<string>(selectedItem?.warningLevel ?? '')
  const [itemContentHtml, setItemContentHtml] = useState<string>(selectedItem?.contentHtml ?? '')
  const [itemLastReviewedAt, setItemLastReviewedAt] = useState<string>(
    selectedItem?.lastReviewedAt ? new Date(selectedItem.lastReviewedAt).toISOString().slice(0, 10) : '',
  )
  const [itemEditorUserIds, setItemEditorUserIds] = useState<string[]>(selectedItem?.editors.map((e) => e.userId) ?? [])
  const [showAddAnotherHint, setShowAddAnotherHint] = useState(false)

  const [panelTaskBuddy, setPanelTaskBuddy] = useState(initialPanel.taskBuddyText ?? '')
  const [panelPostRoute, setPanelPostRoute] = useState(initialPanel.postRouteText ?? '')

  const [selectedWeekCommencingIso, setSelectedWeekCommencingIso] = useState<string>(initialWeekCommencingIso)
  const [onTakeGpName, setOnTakeGpName] = useState(initialOnTakeGpName ?? '')
  const [onTakeLoading, setOnTakeLoading] = useState(false)
  const [onTakeDirty, setOnTakeDirty] = useState(false)
  const [upcomingMap, setUpcomingMap] = useState<Record<string, string | null>>(() => {
    const map: Record<string, string | null> = {}
    for (const w of upcomingWeeks) map[w.weekCommencingIso] = w.gpName
    return map
  })

  function syncSelectedItemToForm(id: string | null, sourceItems: AdminToolkitPageItem[] = items) {
    setSelectedItemId(id)
    if (id === CREATE_PAGE_SENTINEL) {
      return
    }
    const item = sourceItems.find((i) => i.id === id) || null
    setItemTitle(item?.title ?? '')
    setItemCategoryId(item?.categoryId ?? null)
    setItemWarningLevel(item?.warningLevel ?? '')
    setItemContentHtml(item?.contentHtml ?? '')
    setItemLastReviewedAt(item?.lastReviewedAt ? new Date(item.lastReviewedAt).toISOString().slice(0, 10) : '')
    setItemEditorUserIds(item?.editors.map((e) => e.userId) ?? [])
  }

  function resetCreateForm(focusTitle = false) {
    setItemTitle('')
    setItemCategoryId(null)
    setItemWarningLevel('')
    setItemContentHtml('')
    setItemLastReviewedAt('')
    setItemEditorUserIds([])
    if (focusTitle) {
      requestAnimationFrame(() => titleInputRef.current?.focus())
    }
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
    setPanelTaskBuddy(initialPanel.taskBuddyText ?? '')
    setPanelPostRoute(initialPanel.postRouteText ?? '')
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
  useEffect(() => {
    // Ensure selection remains valid after refresh
    if (selectedItemId === CREATE_PAGE_SENTINEL) {
      // In create mode we keep the user's in-progress inputs as-is.
      return
    }
    if (!selectedItemId) {
      if (initialItems[0]?.id) {
        syncSelectedItemToForm(initialItems[0].id, initialItems)
      }
      return
    }
    const exists = initialItems.some((i) => i.id === selectedItemId)
    if (!exists) {
      syncSelectedItemToForm(initialItems[0]?.id ?? null, initialItems)
      return
    }
    // Keep form in sync with latest server item
    syncSelectedItemToForm(selectedItemId, initialItems)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialItems, selectedItemId])

  const refresh = async () => {
    router.refresh()
  }

  return (
    <div className="space-y-6">
      {/* Categories */}
      <section className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-lg font-semibold text-nhs-dark-blue">Categories</h2>
        <p className="mt-1 text-sm text-nhs-grey">Create and organise categories for Admin Toolkit items.</p>

        <div className="mt-4 flex flex-col md:flex-row gap-3">
          <input
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            className="flex-1 nhs-input"
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

        <div className="mt-4 space-y-2">
          {categories.length === 0 ? (
            <p className="text-sm text-gray-500">No categories yet.</p>
          ) : (
            categories.map((c, idx) => {
              const isRenaming = renamingCategoryId === c.id
              return (
                <div key={c.id} className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 px-3 py-2">
                  <div className="min-w-0 flex-1">
                    {isRenaming ? (
                      <input
                        className="w-full nhs-input"
                        value={renamingValue}
                        onChange={(e) => setRenamingValue(e.target.value)}
                      />
                    ) : (
                      <div className="font-medium text-gray-900 truncate">{c.name}</div>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="text-sm text-gray-700 hover:text-gray-900"
                      disabled={idx === 0}
                      onClick={async () => {
                        const ordered = categories.slice()
                        const tmp = ordered[idx - 1]
                        ordered[idx - 1] = ordered[idx]
                        ordered[idx] = tmp
                        const res = await reorderAdminToolkitCategories({
                          surgeryId,
                          orderedCategoryIds: ordered.map((x) => x.id),
                        })
                        if (!res.ok) {
                          toast.error(res.error.message)
                          return
                        }
                        toast.success('Category order updated')
                        await refresh()
                      }}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className="text-sm text-gray-700 hover:text-gray-900"
                      disabled={idx === categories.length - 1}
                      onClick={async () => {
                        const ordered = categories.slice()
                        const tmp = ordered[idx + 1]
                        ordered[idx + 1] = ordered[idx]
                        ordered[idx] = tmp
                        const res = await reorderAdminToolkitCategories({
                          surgeryId,
                          orderedCategoryIds: ordered.map((x) => x.id),
                        })
                        if (!res.ok) {
                          toast.error(res.error.message)
                          return
                        }
                        toast.success('Category order updated')
                        await refresh()
                      }}
                    >
                      ↓
                    </button>

                    {isRenaming ? (
                      <>
                        <button
                          type="button"
                          className="text-sm text-nhs-blue hover:underline"
                          onClick={async () => {
                            const res = await renameAdminToolkitCategory({ surgeryId, categoryId: c.id, name: renamingValue })
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
                        </button>
                        <button
                          type="button"
                          className="text-sm text-gray-600 hover:underline"
                          onClick={() => {
                            setRenamingCategoryId(null)
                            setRenamingValue('')
                          }}
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          className="text-sm text-nhs-blue hover:underline"
                          onClick={() => {
                            setRenamingCategoryId(c.id)
                            setRenamingValue(c.name)
                          }}
                        >
                          Rename
                        </button>
                        <button
                          type="button"
                          className="text-sm text-red-700 hover:underline"
                          onClick={async () => {
                            const ok = confirm('Delete this category? You can only delete empty categories.')
                            if (!ok) return
                            const res = await deleteAdminToolkitCategory({ surgeryId, categoryId: c.id })
                            if (!res.ok) {
                              toast.error(res.error.message)
                              return
                            }
                            toast.success('Category deleted')
                            await refresh()
                          }}
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </section>

      {/* Items */}
      <section className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-nhs-dark-blue">PAGE items</h2>
            <p className="mt-1 text-sm text-nhs-grey">Create and edit guidance pages.</p>
          </div>
          <button
            type="button"
            className="nhs-button"
            onClick={() => {
              setShowAddAnotherHint(false)
              syncSelectedItemToForm(CREATE_PAGE_SENTINEL)
              resetCreateForm(true)
            }}
          >
            New PAGE
          </button>
        </div>

        <div className="mt-4 grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">
          <aside className="rounded-lg border border-gray-200 bg-gray-50 p-3">
            <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide">Items</h3>
            <div className="mt-2 space-y-1">
              <button
                type="button"
                onClick={() => {
                  setShowAddAnotherHint(false)
                  syncSelectedItemToForm(CREATE_PAGE_SENTINEL)
                  resetCreateForm(true)
                }}
                className={[
                  'w-full text-left rounded-md px-3 py-2 text-sm border',
                  isCreateMode ? 'bg-white border-gray-200' : 'bg-white/70 border-transparent hover:border-gray-200',
                ].join(' ')}
              >
                <span className="font-medium text-gray-900">+ Create new page</span>
                <div className="text-xs text-gray-500 mt-0.5">Add another item</div>
              </button>

              {items.length === 0 ? (
                <p className="mt-2 text-sm text-gray-500">No items yet.</p>
              ) : (
                items.map((it) => {
                  const isSelected = it.id === selectedItemId
                  const restricted = it.editors.length > 0
                  return (
                    <button
                      key={it.id}
                      type="button"
                      onClick={() => {
                        setShowAddAnotherHint(false)
                        syncSelectedItemToForm(it.id)
                      }}
                      className={[
                        'w-full text-left rounded-md px-3 py-2 text-sm border',
                        isSelected ? 'bg-white border-gray-200' : 'bg-white/70 border-transparent hover:border-gray-200',
                      ].join(' ')}
                      title={restricted ? 'Restricted item' : undefined}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-gray-900 truncate">{it.title}</span>
                        {restricted ? (
                          <span className="text-[11px] rounded-full bg-gray-200 px-2 py-0.5 text-gray-700">Restricted</span>
                        ) : null}
                      </div>
                    </button>
                  )
                })
              )}
            </div>
          </aside>

          <div className="rounded-lg border border-gray-200 bg-white p-4">
            {isCreateMode ? (
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold text-nhs-dark-blue">Create PAGE</h3>
                    <p className="mt-1 text-sm text-nhs-grey">Add a new guidance page. After saving, you can add another straight away.</p>
                  </div>
                </div>

                {showAddAnotherHint ? (
                  <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
                    <strong>Page created.</strong> Add another item?
                  </div>
                ) : null}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                    <input
                      ref={titleInputRef}
                      className="w-full nhs-input"
                      value={itemTitle}
                      onChange={(e) => setItemTitle(e.target.value)}
                      placeholder="e.g. How to process discharge summaries"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                    <select
                      className="w-full nhs-input"
                      value={itemCategoryId ?? ''}
                      onChange={(e) => setItemCategoryId(e.target.value ? e.target.value : null)}
                    >
                      <option value="">Uncategorised</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Warning badge (optional)</label>
                    <input
                      className="w-full nhs-input"
                      value={itemWarningLevel}
                      onChange={(e) => setItemWarningLevel(e.target.value)}
                      placeholder="e.g. Urgent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Last reviewed (optional)</label>
                    <input
                      type="date"
                      className="w-full nhs-input"
                      value={itemLastReviewedAt}
                      onChange={(e) => setItemLastReviewedAt(e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Content</label>
                  <div className="mt-2">
                    <RichTextEditor
                      value={itemContentHtml}
                      onChange={(html) => setItemContentHtml(sanitizeHtml(html))}
                      height={260}
                      placeholder="Write guidance for staff…"
                    />
                  </div>
                </div>

                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                  <h4 className="text-sm font-semibold text-gray-900">Restricted editors (optional)</h4>
                  <p className="mt-1 text-sm text-gray-600">
                    You can set restrictions after creating, or tick names now and we’ll apply them after the page is created.
                  </p>
                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {editorCandidates.length === 0 ? (
                      <p className="text-sm text-gray-500">No editor candidates yet. Grant write access first.</p>
                    ) : (
                      editorCandidates.map((u) => {
                        const checked = itemEditorUserIds.includes(u.id)
                        const label = u.name ? `${u.name} (${u.email})` : u.email
                        return (
                          <label key={u.id} className="flex items-center gap-2 text-sm text-gray-800">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => {
                                setItemEditorUserIds((prev) => {
                                  if (e.target.checked) return Array.from(new Set([...prev, u.id]))
                                  return prev.filter((x) => x !== u.id)
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
                      resetCreateForm(true)
                    }}
                  >
                    Clear
                  </button>
                  <button
                    type="button"
                    className="nhs-button"
                    disabled={!itemTitle.trim()}
                    onClick={async () => {
                      const res = await createAdminToolkitPageItem({
                        surgeryId,
                        title: itemTitle,
                        categoryId: itemCategoryId,
                        contentHtml: itemContentHtml,
                        warningLevel: itemWarningLevel || null,
                        lastReviewedAt: itemLastReviewedAt ? toUtcMidnightIso(itemLastReviewedAt) : null,
                      })
                      if (!res.ok) {
                        toast.error(res.error.message)
                        return
                      }
                      // Optional: apply restrictions immediately after create.
                      if (itemEditorUserIds.length > 0) {
                        const r = await setAdminToolkitItemEditors({
                          surgeryId,
                          itemId: res.data.id,
                          editorUserIds: itemEditorUserIds,
                        })
                        if (!r.ok) {
                          toast.error(r.error.message)
                          return
                        }
                      }

                      toast.success('Page created')
                      setShowAddAnotherHint(true)
                      resetCreateForm(true)
                      await refresh()
                    }}
                  >
                    Create page
                  </button>
                </div>
              </div>
            ) : !selectedItem ? (
              <p className="text-sm text-gray-500">Select an item to edit, or create a new page.</p>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                    <input
                      ref={titleInputRef}
                      className="w-full nhs-input"
                      value={itemTitle}
                      onChange={(e) => setItemTitle(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                    <select
                      className="w-full nhs-input"
                      value={itemCategoryId ?? ''}
                      onChange={(e) => setItemCategoryId(e.target.value ? e.target.value : null)}
                    >
                      <option value="">Uncategorised</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Warning badge (optional)</label>
                    <input
                      className="w-full nhs-input"
                      value={itemWarningLevel}
                      onChange={(e) => setItemWarningLevel(e.target.value)}
                      placeholder="e.g. Urgent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Last reviewed (optional)</label>
                    <input
                      type="date"
                      className="w-full nhs-input"
                      value={itemLastReviewedAt}
                      onChange={(e) => setItemLastReviewedAt(e.target.value)}
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
                  <div className="mt-2">
                    <RichTextEditor
                      value={itemContentHtml}
                      onChange={(html) => setItemContentHtml(sanitizeHtml(html))}
                      height={260}
                      placeholder="Write guidance for staff…"
                    />
                  </div>
                </div>

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
                        const checked = itemEditorUserIds.includes(u.id)
                        const label = u.name ? `${u.name} (${u.email})` : u.email
                        return (
                          <label key={u.id} className="flex items-center gap-2 text-sm text-gray-800">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => {
                                setItemEditorUserIds((prev) => {
                                  if (e.target.checked) return Array.from(new Set([...prev, u.id]))
                                  return prev.filter((x) => x !== u.id)
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
                          editorUserIds: itemEditorUserIds,
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
                    onClick={() => syncSelectedItemToForm(selectedItem.id)}
                  >
                    Reset changes
                  </button>
                  <button
                    type="button"
                    className="nhs-button"
                    onClick={async () => {
                      const res = await updateAdminToolkitPageItem({
                        surgeryId,
                        itemId: selectedItem.id,
                        title: itemTitle,
                        categoryId: itemCategoryId,
                        contentHtml: itemContentHtml,
                        warningLevel: itemWarningLevel || null,
                        lastReviewedAt: itemLastReviewedAt ? new Date(itemLastReviewedAt).toISOString() : null,
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
            )}
          </div>
        </div>
      </section>

      {/* Pinned panel */}
      <section className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-lg font-semibold text-nhs-dark-blue">Pinned panel</h2>
        <p className="mt-1 text-sm text-nhs-grey">This appears at the bottom of Admin Toolkit pages.</p>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Task buddy system</label>
            <textarea
              className="w-full nhs-input min-h-[120px]"
              value={panelTaskBuddy}
              onChange={(e) => setPanelTaskBuddy(e.target.value)}
              placeholder="Add the steps and who covers who…"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Post route</label>
            <textarea
              className="w-full nhs-input min-h-[120px]"
              value={panelPostRoute}
              onChange={(e) => setPanelPostRoute(e.target.value)}
              placeholder="Add the route / trays / handover rules…"
            />
          </div>
        </div>

        <div className="mt-4 flex justify-end">
          <button
            type="button"
            className="nhs-button"
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
              await refresh()
            }}
          >
            Save pinned panel
          </button>
        </div>
      </section>

      {/* Rota */}
      <section id="on-take" className="bg-white rounded-lg shadow-md p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-nhs-dark-blue">On-Take GP rota (weekly)</h2>
            <p className="mt-1 text-sm text-nhs-grey">One GP applies to the full week (Monday to Sunday).</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="nhs-button-secondary"
              onClick={() => setSelectedWeekCommencingIso(addDaysIso(selectedWeekCommencingIso, -7))}
            >
              Prev
            </button>
            <button
              type="button"
              className="nhs-button-secondary"
              onClick={() => setSelectedWeekCommencingIso(currentWeekCommencingIso)}
            >
              This week
            </button>
            <button
              type="button"
              className="nhs-button-secondary"
              onClick={() => setSelectedWeekCommencingIso(addDaysIso(selectedWeekCommencingIso, 7))}
            >
              Next
            </button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-4 items-end">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Week commencing (Monday)</label>
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
                Week of {formatLondonDateNoWeekday(selectedWeekCommencingIso)} to{' '}
                {formatLondonDateNoWeekday(addDaysIso(selectedWeekCommencingIso, 6))}
              </div>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">GP taking on</label>
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
            {onTakeLoading ? <p className="mt-1 text-xs text-gray-500">Loading…</p> : null}
          </div>
        </div>

        <div className="mt-4 flex justify-between gap-3 flex-wrap">
          <div className="text-sm text-gray-600">
            <span className="font-medium">Upcoming weeks</span>
            <span className="text-gray-400"> (next 8)</span>
            <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
              {upcomingWeeks.map((w) => {
                const label = formatLondonDateNoWeekday(w.weekCommencingIso)
                const value = w.gpName || 'Not set'
                return (
                  <button
                    key={w.weekCommencingIso}
                    type="button"
                    onClick={() => setSelectedWeekCommencingIso(w.weekCommencingIso)}
                    className={[
                      'rounded-lg border px-3 py-2 text-left transition-colors',
                      selectedWeekCommencingIso === w.weekCommencingIso
                        ? 'border-nhs-blue bg-nhs-light-blue'
                        : 'border-gray-200 bg-white hover:bg-gray-50',
                    ].join(' ')}
                  >
                    <div className="text-xs text-gray-500">W/C {label}</div>
                    <div className={w.gpName ? 'text-sm font-semibold text-gray-900' : 'text-sm text-gray-500'}>
                      {value}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          <button
            type="button"
            className="nhs-button"
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
      </section>
    </div>
  )
}

