'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import RichTextEditor from '@/components/rich-text/RichTextEditor'
import { sanitizeHtml } from '@/lib/sanitizeHtml'
import type { AdminToolkitCategory, AdminToolkitDutyEntry, AdminToolkitPageItem, AdminToolkitPinnedPanel } from '@/server/adminToolkit'
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
  setAdminToolkitRotaWeek,
} from '../actions'

type EditorCandidate = { id: string; name: string | null; email: string }

interface AdminToolkitAdminClientProps {
  surgeryId: string
  weekStartUtcIso: string
  initialWeekDuty: AdminToolkitDutyEntry[]
  initialPanel: AdminToolkitPinnedPanel
  initialCategories: AdminToolkitCategory[]
  initialItems: AdminToolkitPageItem[]
  editorCandidates: EditorCandidate[]
  initialItemId?: string
}

const CREATE_PAGE_SENTINEL = '__create_page__'

function dayLabel(date: Date): string {
  return date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' })
}

export default function AdminToolkitAdminClient({
  surgeryId,
  weekStartUtcIso,
  initialWeekDuty,
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

  const weekStart = useMemo(() => new Date(weekStartUtcIso), [weekStartUtcIso])
  const dutyMap = useMemo(() => new Map(initialWeekDuty.map((e) => [new Date(e.date).toISOString(), e.name])), [initialWeekDuty])
  const [rotaNames, setRotaNames] = useState<string[]>(
    Array.from({ length: 7 }).map((_, idx) => {
      const d = new Date(weekStart.getTime())
      d.setUTCDate(d.getUTCDate() + idx)
      return dutyMap.get(d.toISOString()) || ''
    }),
  )

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
    const next = Array.from({ length: 7 }).map((_, idx) => {
      const d = new Date(weekStart.getTime())
      d.setUTCDate(d.getUTCDate() + idx)
      return dutyMap.get(d.toISOString()) || ''
    })
    setRotaNames(next)
  }, [dutyMap, weekStart])

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
      <section className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-lg font-semibold text-nhs-dark-blue">GP taking on rota</h2>
        <p className="mt-1 text-sm text-nhs-grey">Set who is taking on for each day (free text for now).</p>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
          {Array.from({ length: 7 }).map((_, idx) => {
            const d = new Date(weekStart.getTime())
            d.setUTCDate(d.getUTCDate() + idx)
            return (
              <div key={idx} className="rounded-lg border border-gray-200 p-3">
                <label className="block text-sm font-medium text-gray-700 mb-1">{dayLabel(d)}</label>
                <input
                  value={rotaNames[idx] || ''}
                  onChange={(e) =>
                    setRotaNames((prev) => {
                      const next = prev.slice()
                      next[idx] = e.target.value
                      return next
                    })
                  }
                  className="w-full nhs-input"
                  placeholder="e.g. Dr Patel"
                />
              </div>
            )
          })}
        </div>

        <div className="mt-4 flex justify-end">
          <button
            type="button"
            className="nhs-button"
            onClick={async () => {
              const entries = Array.from({ length: 7 }).map((_, idx) => {
                const d = new Date(weekStart.getTime())
                d.setUTCDate(d.getUTCDate() + idx)
                return { dateIso: d.toISOString(), name: rotaNames[idx] || '' }
              })
              const res = await setAdminToolkitRotaWeek({ surgeryId, weekStartIso: weekStart.toISOString(), entries })
              if (!res.ok) {
                toast.error(res.error.message)
                return
              }
              toast.success('Rota updated')
              await refresh()
            }}
          >
            Save rota
          </button>
        </div>
      </section>
    </div>
  )
}

