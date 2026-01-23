'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import toast from 'react-hot-toast'
import RichTextEditor from '@/components/rich-text/RichTextEditor'
import { sanitizeHtml } from '@/lib/sanitizeHtml'
import type { AdminToolkitCategory, AdminToolkitPageItem, AdminToolkitPinnedPanel } from '@/server/adminToolkit'
import type { AdminToolkitQuickAccessButton } from '@/lib/adminToolkitQuickAccessShared'
import { getRoleCardsBlock, getIntroTextBlock, getFooterTextBlock, isHtmlEmpty } from '@/lib/adminToolkitContentBlocksShared'
import type { RoleCard, RoleCardsColumns, RoleCardsLayout } from '@/lib/adminToolkitContentBlocksShared'
import {
  createAdminToolkitCategory,
  deleteAdminToolkitCategory,
  renameAdminToolkitCategory,
  reorderAdminToolkitCategories,
  setAdminToolkitCategoryVisibility,
  createAdminToolkitItem,
  updateAdminToolkitItem,
  deleteAdminToolkitItem,
  setAdminToolkitItemEditGrants,
  upsertAdminToolkitPinnedPanel,
  setAdminToolkitOnTakeWeek,
  getAdminToolkitOnTakeWeekValue,
  createAdminToolkitListColumn,
  updateAdminToolkitListColumn,
  deleteAdminToolkitListColumn,
  reorderAdminToolkitListColumns,
  setAdminToolkitQuickAccessButtons,
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
  initialQuickAccessButtons: AdminToolkitQuickAccessButton[]
  initialItemId?: string
  initialTab?: 'items' | 'settings' | 'engagement' | 'audit'
}

type PageEditorMode = 'create' | 'edit'

type PageFormState = {
  type: 'PAGE' | 'LIST'
  title: string
  categoryId: string | null
  warningLevel: string
  contentHtml: string // Legacy field, kept for backwards compatibility
  introHtml: string // New: intro text above role cards
  footerHtml: string // New: footer text below role cards
  roleCardsEnabled: boolean
  roleCardsBlockId: string
  roleCardsTitle: string
  roleCardsLayout: RoleCardsLayout
  roleCardsColumns: RoleCardsColumns
  roleCardsCards: RoleCard[]
  lastReviewedDate: string // YYYY-MM-DD (local input), stored as UTC midnight when saving
  additionalEditorUserIds: string[]
  allowAllStandardUsers: boolean
}

const DEFAULT_PAGE_FORM: PageFormState = {
  type: 'PAGE',
  title: '',
  categoryId: null,
  warningLevel: '',
  contentHtml: '',
  introHtml: '',
  footerHtml: '',
  roleCardsEnabled: false,
  roleCardsBlockId: '',
  roleCardsTitle: '',
  roleCardsLayout: 'grid',
  roleCardsColumns: 3,
  roleCardsCards: [],
  lastReviewedDate: '',
  additionalEditorUserIds: [],
  allowAllStandardUsers: false,
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

function newClientId(): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const c: any = crypto
    if (c && typeof c.randomUUID === 'function') return c.randomUUID()
  } catch {
    // ignore
  }
  return `tmp-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

// Separate component to isolate the dynamic key from Next.js RSC compilation issues
// Uses mounted state to avoid hydration mismatch with TipTap editor
function CreateModePageEditor({
  editorInstanceKey,
  form,
  setForm,
}: {
  editorInstanceKey: number
  form: PageFormState
  setForm: React.Dispatch<React.SetStateAction<PageFormState>>
}) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
  }, [])

  const hasRoleCards = form.roleCardsEnabled && (
    ((form.roleCardsCards ?? []).length > 0) ||
    (form.roleCardsTitle ?? '').trim().length > 0 ||
    form.roleCardsLayout === 'row'
  )
  const hasFooter = !isHtmlEmpty(form.footerHtml)
  // Page content expanded by default (primary writing surface)
  const [introOpen, setIntroOpen] = useState(true)
  const [footerOpen, setFooterOpen] = useState(hasFooter)

  useEffect(() => {
    if (hasFooter) setFooterOpen(true)
  }, [hasFooter])

  return (
    <>
      <div className="space-y-4">
        {/* Page Content Editor */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-gray-700">Page content (optional)</label>
            <button
              type="button"
              onClick={() => setIntroOpen(!introOpen)}
              className="text-sm text-nhs-blue hover:underline"
            >
              {introOpen ? 'Collapse' : 'Expand'}
            </button>
          </div>
          {introOpen && (
            <div className="mt-2">
              <p className="mb-2 text-xs text-gray-500">
                {hasRoleCards
                  ? 'Main guidance text for this page. If role cards are used, this appears above them.'
                  : 'Main guidance text for this page.'}
              </p>
              {mounted ? (
                <RichTextEditor
                  key={`admin-create-intro-${editorInstanceKey}`}
                  docId="admin-toolkit:create:intro"
                  value={form.introHtml}
                  onChange={(html) => setForm((prev) => ({ ...prev, introHtml: sanitizeHtml(html) }))}
                  height={200}
                  placeholder="Write guidance for staff…"
                />
              ) : (
                <div className="h-[200px] border border-gray-200 rounded bg-gray-50 animate-pulse" />
              )}
            </div>
          )}
        </div>

        <RoleCardsEditor form={form} setForm={setForm} editorKey="create" />

        {/* Footer Text Editor */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-gray-700">Additional notes (optional)</label>
            <button
              type="button"
              onClick={() => setFooterOpen(!footerOpen)}
              className="text-sm text-nhs-blue hover:underline"
            >
              {footerOpen ? 'Collapse' : 'Expand'}
            </button>
          </div>
          {footerOpen && (
            <div className="mt-2">
              <p className="mb-2 text-xs text-gray-500">Optional extra guidance shown below role cards.</p>
              {mounted ? (
                <RichTextEditor
                  key={`admin-create-footer-${editorInstanceKey}`}
                  docId="admin-toolkit:create:footer"
                  value={form.footerHtml}
                  onChange={(html) => setForm((prev) => ({ ...prev, footerHtml: sanitizeHtml(html) }))}
                  height={200}
                  placeholder="Optional extra guidance…"
                />
              ) : (
                <div className="h-[200px] border border-gray-200 rounded bg-gray-50 animate-pulse" />
              )}
            </div>
          )}
        </div>
      </div>
    </>
  )
}

function PageEditorContent({
  form,
  setForm,
  selectedItemId,
  hasLegacyContent,
}: {
  form: PageFormState
  setForm: React.Dispatch<React.SetStateAction<PageFormState>>
  selectedItemId: string
  hasLegacyContent: boolean
}) {
  const hasRoleCards = form.roleCardsEnabled && (
    ((form.roleCardsCards ?? []).length > 0) ||
    (form.roleCardsTitle ?? '').trim().length > 0 ||
    form.roleCardsLayout === 'row'
  )
  const hasFooter = !isHtmlEmpty(form.footerHtml)
  // Page content expanded by default (primary writing surface)
  const [introOpen, setIntroOpen] = useState(true)
  const [footerOpen, setFooterOpen] = useState(hasFooter || hasLegacyContent)

  useEffect(() => {
    if (hasFooter || hasLegacyContent) setFooterOpen(true)
  }, [hasFooter, hasLegacyContent])

  const migrateLegacyContent = () => {
    if (hasLegacyContent && form.contentHtml) {
      setForm((prev) => ({
        ...prev,
        footerHtml: prev.contentHtml,
        contentHtml: '', // Clear legacy content after migration
      }))
    }
  }

  return (
    <div className="mt-2 space-y-4">
      {/* Page Content Editor */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium text-gray-700">Page content (optional)</label>
          <button
            type="button"
            onClick={() => setIntroOpen(!introOpen)}
            className="text-sm text-nhs-blue hover:underline"
          >
            {introOpen ? 'Collapse' : 'Expand'}
          </button>
        </div>
        {introOpen && (
          <>
            <p className="mb-2 text-xs text-gray-500">
              {hasRoleCards
                ? 'Main guidance text for this page. If role cards are used, this appears above them.'
                : 'Main guidance text for this page.'}
            </p>
            <RichTextEditor
              docId={`admin-toolkit:item:${selectedItemId}:intro`}
              value={form.introHtml}
              onChange={(html) => setForm((prev) => ({ ...prev, introHtml: sanitizeHtml(html) }))}
              height={200}
              placeholder="Write guidance for staff…"
            />
          </>
        )}
      </div>

      <RoleCardsEditor form={form} setForm={setForm} editorKey={`edit-${selectedItemId}`} />

      {/* Footer Text Editor */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium text-gray-700">Additional notes (optional)</label>
          <button
            type="button"
            onClick={() => setFooterOpen(!footerOpen)}
            className="text-sm text-nhs-blue hover:underline"
          >
            {footerOpen ? 'Collapse' : 'Expand'}
          </button>
        </div>
        {hasLegacyContent && !hasFooter && (
          <div className="mb-2 rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-800">
            <p className="mb-2">
              <strong>Legacy content detected:</strong> This page currently uses legacy content. Saving here will move it into &apos;Additional notes&apos;.
            </p>
            <button
              type="button"
              onClick={migrateLegacyContent}
              className="text-sm font-medium text-yellow-900 hover:text-yellow-700 underline"
            >
              Move legacy content to Additional notes
            </button>
          </div>
        )}
        {footerOpen && (
          <>
            <p className="mb-2 text-xs text-gray-500">Optional extra guidance shown below role cards.</p>
            <RichTextEditor
              docId={`admin-toolkit:item:${selectedItemId}:footer`}
              value={form.footerHtml}
              onChange={(html) => setForm((prev) => ({ ...prev, footerHtml: sanitizeHtml(html) }))}
              height={200}
              placeholder="Optional extra guidance…"
            />
          </>
        )}
      </div>
    </div>
  )
}

function RoleCardsEditor({
  form,
  setForm,
  editorKey,
}: {
  form: PageFormState
  setForm: React.Dispatch<React.SetStateAction<PageFormState>>
  editorKey: string
}) {
  if (form.type !== 'PAGE') return null

  const enabled = form.roleCardsEnabled
  const hasRoleCards =
    enabled &&
    (((form.roleCardsCards ?? []).length > 0) ||
      (form.roleCardsTitle ?? '').trim().length > 0 ||
      form.roleCardsLayout === 'row')
  const defaultOpen = hasRoleCards
  const [open, setOpen] = useState(defaultOpen)

  useEffect(() => {
    setOpen(defaultOpen)
    // Only re-evaluate default when switching items/contexts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editorKey])

  useEffect(() => {
    // If role cards exist (or load in after deep-link selection), auto-expand.
    // Do not force-close when empty.
    if (hasRoleCards) setOpen(true)
  }, [hasRoleCards, editorKey])

  const setEnabled = (next: boolean) => {
    setForm((prev) => {
      if (next) {
        return {
          ...prev,
          roleCardsEnabled: true,
          roleCardsBlockId: prev.roleCardsBlockId || newClientId(),
          roleCardsLayout: prev.roleCardsLayout || 'grid',
          roleCardsColumns: prev.roleCardsColumns || 3,
        }
      }
      return { ...prev, roleCardsEnabled: false }
    })
    if (next) setOpen(true)
  }

  const updateCard = (id: string, patch: Partial<RoleCard>) => {
    setForm((prev) => ({
      ...prev,
      roleCardsCards: prev.roleCardsCards.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    }))
  }

  const reorderCards = (from: number, to: number) => {
    setForm((prev) => {
      const next = prev.roleCardsCards.slice()
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      return {
        ...prev,
        roleCardsCards: next.map((c, idx) => ({ ...c, orderIndex: idx })),
      }
    })
  }

  const deleteCard = (id: string) => {
    setForm((prev) => ({
      ...prev,
      roleCardsCards: prev.roleCardsCards.filter((c) => c.id !== id).map((c, idx) => ({ ...c, orderIndex: idx })),
    }))
  }

  const addCard = () => {
    setForm((prev) => ({
      ...prev,
      roleCardsCards: [
        ...prev.roleCardsCards,
        { id: newClientId(), title: '', body: '', orderIndex: prev.roleCardsCards.length },
      ],
    }))
  }

  return (
    <details
      className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-4"
      open={open}
      onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}
    >
      <summary className="cursor-pointer select-none text-sm font-semibold text-gray-900">Role cards (optional)</summary>
      <div className="mt-3 space-y-4">
        <label className="flex items-center gap-2 text-sm text-gray-800">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
          />
          <span>Add role cards section</span>
        </label>

        {!enabled ? (
          <p className="text-sm text-gray-600">When enabled, this displays a grid of static responsibility cards on the page.</p>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
              <div className="md:col-span-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">Section heading (optional)</label>
                <input
                  className="w-full nhs-input"
                  value={form.roleCardsTitle}
                  onChange={(e) => setForm((prev) => ({ ...prev, roleCardsTitle: e.target.value }))}
                  placeholder="e.g. Roles"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Layout</label>
                <select
                  className="w-full nhs-input"
                  value={form.roleCardsLayout}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, roleCardsLayout: e.target.value as RoleCardsLayout }))
                  }
                >
                  <option value="grid">Grid</option>
                  <option value="row">Row</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Columns</label>
                <select
                  className="w-full nhs-input"
                  value={form.roleCardsColumns}
                  disabled={form.roleCardsLayout !== 'grid'}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, roleCardsColumns: Number(e.target.value) as RoleCardsColumns }))
                  }
                >
                  <option value={2}>2</option>
                  <option value={3}>3</option>
                  <option value={4}>4</option>
                </select>
                {form.roleCardsLayout !== 'grid' ? (
                  <p className="mt-1 text-xs text-gray-500">Columns apply to grid layout only.</p>
                ) : null}
              </div>
            </div>

            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h4 className="text-sm font-semibold text-gray-900">Cards</h4>
                  <p className="mt-1 text-sm text-gray-600">Each line in the body becomes a bullet point.</p>
                </div>
                <button type="button" className="nhs-button-secondary" onClick={addCard}>
                  Add card
                </button>
              </div>

              {(form.roleCardsCards ?? []).length === 0 ? (
                <p className="mt-3 text-sm text-gray-500">No cards yet.</p>
              ) : (
                <div className="mt-3 space-y-3">
                  {form.roleCardsCards
                    .slice()
                    .sort((a, b) => a.orderIndex - b.orderIndex)
                    .map((card, idx) => (
                      <div key={card.id} className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                        <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-3 items-end">
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Card title</label>
                            <input
                              className="w-full nhs-input"
                              value={card.title}
                              onChange={(e) => updateCard(card.id, { title: e.target.value })}
                              placeholder="e.g. Reception"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Responsibilities (one per line)</label>
                            <textarea
                              className="w-full nhs-input min-h-[72px]"
                              value={card.body}
                              onChange={(e) => updateCard(card.id, { body: e.target.value })}
                              placeholder={`One responsibility per line\nPhones\nPrescriptions\nTasks`}
                            />
                          </div>
                          <div className="flex gap-2 justify-end">
                            <button
                              type="button"
                              className="nhs-button-secondary"
                              disabled={idx === 0}
                              onClick={() => reorderCards(idx, idx - 1)}
                            >
                              ↑
                            </button>
                            <button
                              type="button"
                              className="nhs-button-secondary"
                              disabled={idx === (form.roleCardsCards.length - 1)}
                              onClick={() => reorderCards(idx, idx + 1)}
                            >
                              ↓
                            </button>
                            <button
                              type="button"
                              className="nhs-button-secondary"
                              onClick={() => {
                                const ok = confirm('Delete this role card?')
                                if (!ok) return
                                deleteCard(card.id)
                              }}
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </details>
  )
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
  initialQuickAccessButtons,
  initialItemId,
  initialTab = 'items',
}: AdminToolkitAdminClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const titleInputRef = useRef<HTMLInputElement>(null)
  
  // Tab state with URL query param persistence
  type TabId = 'items' | 'settings' | 'engagement' | 'audit'
  const [activeTab, setActiveTab] = useState<TabId>(() => {
    const tabParam = searchParams.get('tab')
    const validTabs: TabId[] = ['items', 'settings', 'engagement', 'audit']
    return validTabs.includes(tabParam as TabId) ? (tabParam as TabId) : initialTab
  })
  
  const handleTabChange = (tab: TabId) => {
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

  // Default behaviour: open in "Create page" mode unless a page is explicitly selected.
  const [mode, setMode] = useState<PageEditorMode>(() => (initialItemId ? 'edit' : 'create'))
  const [selectedItemId, setSelectedItemId] = useState<string | null>(() => initialItemId ?? null)
  const selectedItem = useMemo(() => (selectedItemId ? items.find((i) => i.id === selectedItemId) || null : null), [
    items,
    selectedItemId,
  ])
  const [form, setForm] = useState<PageFormState>(DEFAULT_PAGE_FORM)
  const [showAddAnotherHint, setShowAddAnotherHint] = useState(false)
  const [editorInstanceKey, setEditorInstanceKey] = useState(0) // remount TipTap on create resets
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
    const roleCards = item.type === 'PAGE' ? getRoleCardsBlock(item.contentJson ?? null) : null
    const introBlock = item.type === 'PAGE' ? getIntroTextBlock(item.contentJson ?? null) : null
    const footerBlock = item.type === 'PAGE' ? getFooterTextBlock(item.contentJson ?? null) : null
    // Legacy: if no footer block but contentHtml exists, treat it as footer
    const hasLegacyContent = item.type === 'PAGE' && item.contentHtml && !footerBlock && !isHtmlEmpty(item.contentHtml)
    return {
      type: item.type,
      title: item.title ?? '',
      categoryId: item.categoryId ?? null,
      warningLevel: item.warningLevel ?? '',
      contentHtml: hasLegacyContent ? item.contentHtml ?? '' : '', // Keep for migration hint
      introHtml: introBlock?.html ?? '',
      footerHtml: footerBlock?.html ?? (hasLegacyContent ? item.contentHtml ?? '' : ''),
      roleCardsEnabled: !!roleCards,
      roleCardsBlockId: roleCards?.id ?? '',
      roleCardsTitle: (roleCards?.title ?? '') || '',
      roleCardsLayout: roleCards?.layout === 'row' ? 'row' : 'grid',
      roleCardsColumns: (roleCards?.columns ?? 3) as RoleCardsColumns,
      roleCardsCards: (roleCards?.cards ?? []).slice().sort((a, b) => a.orderIndex - b.orderIndex),
      lastReviewedDate: item.lastReviewedAt ? new Date(item.lastReviewedAt).toISOString().slice(0, 10) : '',
      additionalEditorUserIds: (item.editGrants ?? [])
        .filter((g) => g.principalType === 'USER' && g.userId)
        .map((g) => g.userId as string),
      allowAllStandardUsers: (item.editGrants ?? []).some((g) => g.principalType === 'ROLE' && g.role === 'STANDARD'),
    }
  }

  function enterCreateMode() {
    setMode('create')
    setSelectedItemId(null)
    setShowAddAnotherHint(false)
    setForm(DEFAULT_PAGE_FORM)
    setEditorInstanceKey((k) => k + 1)
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
    // Populate the form ONLY when a page is explicitly selected in edit mode.
    if (mode !== 'edit') return
    if (!selectedItemId) return

    const item = items.find((i) => i.id === selectedItemId) || null
    if (!item) {
      // The selected page no longer exists (e.g. deleted). Return to a blank create form.
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
  // IMPORTANT: do not auto-select a page on refresh/navigation.
  // The editor should remain blank in create mode until the user explicitly selects a page.

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
              { id: 'items', label: 'Handbook Library' },
              { id: 'settings', label: 'Structure & Settings' },
              { id: 'engagement', label: 'Engagement' },
              { id: 'audit', label: 'Audit' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id as TabId)}
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
      {activeTab === 'items' && (
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
          editorInstanceKey={editorInstanceKey}
          setEditorInstanceKey={setEditorInstanceKey}
        />
      )}
      {activeTab === 'settings' && (
        <StructureSettingsTab
          surgeryId={surgeryId}
          categories={categories}
          items={items}
          userCandidates={editorCandidates}
          initialQuickAccessButtons={initialQuickAccessButtons}
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
      {activeTab === 'engagement' && <EngagementTab surgeryId={surgeryId} />}
      {activeTab === 'audit' && <AuditTab surgeryId={surgeryId} />}
    </div>
  )
}

// Engagement Tab Component
function EngagementTab({ surgeryId }: { surgeryId: string }) {
  const [timeWindow, setTimeWindow] = useState<'7d' | '30d' | '90d' | 'all'>('30d')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<{
    topItems: Array<{ id: string; title: string; type: string; categoryName: string; views: number }>
    topUsers: Array<{ id: string; name: string; views: number }>
  } | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    fetch(`/api/admin-toolkit/engagement?surgeryId=${surgeryId}&timeWindow=${timeWindow}`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch engagement data')
        return res.json()
      })
      .then((d) => {
        setData(d)
        setLoading(false)
      })
      .catch((e) => {
        setError(e.message)
        setLoading(false)
      })
  }, [surgeryId, timeWindow])

  const timeWindowOptions = [
    { value: '7d', label: 'Last 7 days' },
    { value: '30d', label: 'Last 30 days' },
    { value: '90d', label: 'Last 90 days' },
    { value: 'all', label: 'All time' },
  ] as const

  return (
    <div className="space-y-6">
      {/* Time window selector */}
      <div className="flex items-center gap-4">
        <label htmlFor="engagement-time-window" className="text-sm font-medium text-gray-700">
          Time period:
        </label>
        <select
          id="engagement-time-window"
          value={timeWindow}
          onChange={(e) => setTimeWindow(e.target.value as typeof timeWindow)}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-nhs-blue focus:outline-none focus:ring-1 focus:ring-nhs-blue"
        >
          {timeWindowOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-nhs-blue mx-auto" />
          <p className="mt-2 text-sm text-gray-500">Loading engagement data...</p>
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {/* Most viewed items */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="px-4 py-3 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">Most viewed pages</h3>
            </div>
            <div className="p-4">
              {data?.topItems && data.topItems.length > 0 ? (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left py-2 font-medium text-gray-600">Page title</th>
                      <th className="text-left py-2 font-medium text-gray-600">Category</th>
                      <th className="text-right py-2 font-medium text-gray-600">Views</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.topItems.map((item, idx) => (
                      <tr key={item.id} className={idx % 2 === 0 ? 'bg-gray-50' : ''}>
                        <td className="py-2 pr-2">{item.title}</td>
                        <td className="py-2 pr-2 text-gray-500">{item.categoryName}</td>
                        <td className="py-2 text-right font-medium">{item.views}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="text-sm text-gray-500 text-center py-4">No page views recorded yet.</p>
              )}
            </div>
          </div>

          {/* Most active users */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="px-4 py-3 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">Most active users</h3>
            </div>
            <div className="p-4">
              {data?.topUsers && data.topUsers.length > 0 ? (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left py-2 font-medium text-gray-600">Staff name</th>
                      <th className="text-right py-2 font-medium text-gray-600">Views</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.topUsers.map((user, idx) => (
                      <tr key={user.id} className={idx % 2 === 0 ? 'bg-gray-50' : ''}>
                        <td className="py-2">{user.name}</td>
                        <td className="py-2 text-right font-medium">{user.views}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="text-sm text-gray-500 text-center py-4">No user activity recorded yet.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Audit Tab Component
function AuditTab({ surgeryId }: { surgeryId: string }) {
  const [timeWindow, setTimeWindow] = useState<'7d' | '30d' | '90d' | 'all'>('30d')
  const [entityType, setEntityType] = useState<'all' | 'ADMIN_ITEM' | 'CATEGORY' | 'QUICK_ACCESS' | 'ROTA' | 'OP_PANEL'>('all')
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [events, setEvents] = useState<Array<{
    id: string
    action: string
    actionLabel: string
    entityType: string
    targetName: string | null
    targetId: string | null
    targetDeleted: boolean
    actorName: string
    actorId: string
    createdAt: string
  }>>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)

  const loadEvents = useCallback(async (cursor?: string) => {
    const isLoadMore = !!cursor
    if (isLoadMore) {
      setLoadingMore(true)
    } else {
      setLoading(true)
      setError(null)
    }

    try {
      const url = `/api/admin-toolkit/audit?surgeryId=${surgeryId}&timeWindow=${timeWindow}&entityType=${entityType}${cursor ? `&cursor=${cursor}` : ''}`
      const res = await fetch(url)
      if (!res.ok) throw new Error('Failed to fetch audit data')
      const data = await res.json()

      if (isLoadMore) {
        setEvents((prev) => [...prev, ...data.events])
      } else {
        setEvents(data.events)
      }
      setNextCursor(data.nextCursor)
      setHasMore(data.hasMore)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'An error occurred')
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [surgeryId, timeWindow, entityType])

  useEffect(() => {
    loadEvents()
  }, [loadEvents])

  const timeWindowOptions = [
    { value: '7d', label: 'Last 7 days' },
    { value: '30d', label: 'Last 30 days' },
    { value: '90d', label: 'Last 90 days' },
    { value: 'all', label: 'All time' },
  ] as const

  const entityTypeOptions = [
    { value: 'all', label: 'All types' },
    { value: 'ADMIN_ITEM', label: 'Pages' },
    { value: 'CATEGORY', label: 'Categories' },
    { value: 'QUICK_ACCESS', label: 'Quick Access' },
    { value: 'ROTA', label: 'Rota' },
    { value: 'OP_PANEL', label: 'Operational panel' },
  ] as const

  const formatRelativeTime = (isoDate: string) => {
    const date = new Date(isoDate)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / (1000 * 60))
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <label htmlFor="audit-time-window" className="text-sm font-medium text-gray-700">
            Time period:
          </label>
          <select
            id="audit-time-window"
            value={timeWindow}
            onChange={(e) => setTimeWindow(e.target.value as typeof timeWindow)}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-nhs-blue focus:outline-none focus:ring-1 focus:ring-nhs-blue"
          >
            {timeWindowOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="audit-entity-type" className="text-sm font-medium text-gray-700">
            Type:
          </label>
          <select
            id="audit-entity-type"
            value={entityType}
            onChange={(e) => setEntityType(e.target.value as typeof entityType)}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-nhs-blue focus:outline-none focus:ring-1 focus:ring-nhs-blue"
          >
            {entityTypeOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-nhs-blue mx-auto" />
          <p className="mt-2 text-sm text-gray-500">Loading audit history...</p>
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          {events.length > 0 ? (
            <>
              <ul className="divide-y divide-gray-200">
                {events.map((event) => (
                  <li key={event.id} className="p-4 hover:bg-gray-50">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-900">
                          {event.actionLabel}
                          {event.targetName && (
                            <>
                              {' '}
                              {event.targetId && !event.targetDeleted ? (
                                <a
                                  href={`/s/${surgeryId}/admin-toolkit/admin?tab=items&item=${event.targetId}`}
                                  className="text-nhs-blue hover:underline"
                                >
                                  &ldquo;{event.targetName}&rdquo;
                                </a>
                              ) : (
                                <span className={event.targetDeleted ? 'text-gray-400 line-through' : ''}>
                                  &ldquo;{event.targetName}&rdquo;
                                </span>
                              )}
                            </>
                          )}
                        </p>
                        <p className="mt-1 text-sm text-gray-500">
                          by <span className="font-medium">{event.actorName}</span>
                        </p>
                      </div>
                      <div className="text-right text-sm text-gray-500 whitespace-nowrap">
                        <span title={new Date(event.createdAt).toLocaleString('en-GB')}>
                          {formatRelativeTime(event.createdAt)}
                        </span>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
              {hasMore && (
                <div className="p-4 border-t border-gray-200 text-center">
                  <button
                    onClick={() => nextCursor && loadEvents(nextCursor)}
                    disabled={loadingMore}
                    className="text-sm font-medium text-nhs-blue hover:underline disabled:opacity-50"
                  >
                    {loadingMore ? 'Loading...' : 'Load more'}
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="p-8 text-center">
              <p className="text-sm text-gray-500">No audit events found for the selected filters.</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// Pages Tab Component
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
  editorInstanceKey,
  setEditorInstanceKey,
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
  editorInstanceKey: number
  setEditorInstanceKey: React.Dispatch<React.SetStateAction<number>>
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

      // If filtering by a parent category, include pages in its child categories.
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
      {/* Left Column: Pages List */}
      <aside className="bg-white rounded-lg shadow-md border border-gray-200 flex flex-col min-h-0 lg:sticky lg:top-4 lg:max-h-[calc(100vh-6rem)]">
        <div className="p-4 border-b border-gray-200 bg-white">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-nhs-dark-blue">Pages</h2>
            <button type="button" className="nhs-button" onClick={enterCreateMode}>
              Create new page
            </button>
          </div>

          <div className="mt-3">
            <label className="sr-only" htmlFor="admin-toolkit-item-search">
              Search pages
            </label>
            <input
              id="admin-toolkit-item-search"
              className="w-full nhs-input"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search pages…"
            />
          </div>

          <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Page type filter">
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
            <span className="font-medium text-gray-900">Blank editor (new page)</span>
            <div className="text-xs text-gray-500 mt-0.5">Ready to add a new PAGE or LIST</div>
          </button>

          {filteredItems.length === 0 ? (
            <p className="mt-2 px-1 text-sm text-gray-500">No pages match your filters.</p>
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
                                title={restricted ? 'Restricted page' : undefined}
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

      {/* Right Column: Page Editor */}
      <div className="bg-white rounded-lg shadow-md p-6">
        {mode === 'create' ? (
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-nhs-dark-blue">Create page</h3>
                <p className="mt-1 text-sm text-nhs-grey">Add a new Practice Handbook page. After saving, you can add another straight away.</p>
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
                <CreateModePageEditor
                  editorInstanceKey={editorInstanceKey}
                  form={form}
                  setForm={setForm}
                />
              ) : (
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
                  <strong>This is a LIST page.</strong> You can add and edit rows on the page after creating it.
                </div>
              )}
            </div>

            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <h4 className="text-sm font-semibold text-gray-900">Additional editors (optional)</h4>
              <p className="mt-1 text-sm text-gray-600">
                Choose people who can edit this page from the staff view. Surgery admins and superusers can always edit.
              </p>
              <label className="mt-3 flex items-center gap-2 text-sm text-gray-800">
                <input
                  type="checkbox"
                  checked={form.allowAllStandardUsers}
                  onChange={(e) => setForm((prev) => ({ ...prev, allowAllStandardUsers: e.target.checked }))}
                />
                <span>All standard users can edit</span>
              </label>
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                {editorCandidates.length === 0 ? (
                  <p className="text-sm text-gray-500">No users found for this surgery.</p>
                ) : (
                  editorCandidates.map((u) => {
                    const checked = form.additionalEditorUserIds.includes(u.id)
                    const label = u.name ? `${u.name} (${u.email})` : u.email
                    return (
                      <label key={u.id} className="flex items-center gap-2 text-sm text-gray-800">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            setForm((prev) => {
                              const nextIds = e.target.checked
                                ? Array.from(new Set([...prev.additionalEditorUserIds, u.id]))
                                : prev.additionalEditorUserIds.filter((x) => x !== u.id)
                              return { ...prev, additionalEditorUserIds: nextIds }
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
                  setEditorInstanceKey((k) => k + 1)
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
                    contentHtml: form.type === 'PAGE' ? form.contentHtml : '', // Legacy field
                    introHtml: form.type === 'PAGE' ? form.introHtml : undefined,
                    footerHtml: form.type === 'PAGE' ? form.footerHtml : undefined,
                    roleCardsBlock:
                      form.type === 'PAGE'
                        ? form.roleCardsEnabled
                          ? {
                              id: form.roleCardsBlockId || undefined,
                              title: form.roleCardsTitle.trim() || null,
                              layout: form.roleCardsLayout,
                              columns: form.roleCardsColumns,
                              cards: (form.roleCardsCards ?? []).map((c, idx) => ({
                                id: c.id || undefined,
                                title: c.title,
                                body: c.body,
                                orderIndex: idx,
                              })),
                            }
                          : null
                        : undefined,
                    warningLevel: form.warningLevel || null,
                    lastReviewedAt: form.lastReviewedDate ? toUtcMidnightIso(form.lastReviewedDate) : null,
                  })
                  if (!res.ok) {
                    toast.error(res.error.message)
                    return
                  }
                  // Optional: apply additional editors immediately after create.
                  if (form.additionalEditorUserIds.length > 0 || form.allowAllStandardUsers) {
                    const r = await setAdminToolkitItemEditGrants({
                      surgeryId,
                      itemId: res.data.id,
                      editorUserIds: form.additionalEditorUserIds,
                      allowAllStandardUsers: form.allowAllStandardUsers,
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
                          Open page
                        </a>
                      </div>
                    </div>
                  ))

                  // Reset to a blank "Create page" form for adding another.
                  setShowAddAnotherHint(false)
                  setForm(DEFAULT_PAGE_FORM)
                  setEditorInstanceKey((k) => k + 1)
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
            <p className="text-sm text-gray-500">Select a page to edit, or create a new one.</p>
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

// Page Edit Form Content (extracted for reuse)
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
          <PageEditorContent
            form={form}
            setForm={setForm}
            selectedItemId={selectedItem.id}
            hasLegacyContent={!isHtmlEmpty(form.contentHtml) && isHtmlEmpty(form.footerHtml)}
          />
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
        <h4 className="text-sm font-semibold text-gray-900">Additional editors (optional)</h4>
        <p className="mt-1 text-sm text-gray-600">
          Choose people who can edit this item from the staff view. Surgery admins and superusers can always edit.
        </p>
        <label className="mt-3 flex items-center gap-2 text-sm text-gray-800">
          <input
            type="checkbox"
            checked={form.allowAllStandardUsers}
            onChange={(e) => setForm((prev) => ({ ...prev, allowAllStandardUsers: e.target.checked }))}
          />
          <span>All standard users can edit</span>
        </label>
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
          {editorCandidates.length === 0 ? (
            <p className="text-sm text-gray-500">No users found for this surgery.</p>
          ) : (
            editorCandidates.map((u) => {
              const checked = form.additionalEditorUserIds.includes(u.id)
              const label = u.name ? `${u.name} (${u.email})` : u.email
              return (
                <label key={u.id} className="flex items-center gap-2 text-sm text-gray-800">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => {
                      setForm((prev) => {
                        const nextIds = e.target.checked
                          ? Array.from(new Set([...prev.additionalEditorUserIds, u.id]))
                          : prev.additionalEditorUserIds.filter((x) => x !== u.id)
                        return { ...prev, additionalEditorUserIds: nextIds }
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
              const res = await setAdminToolkitItemEditGrants({
                surgeryId,
                itemId: selectedItem.id,
                editorUserIds: form.additionalEditorUserIds,
                allowAllStandardUsers: form.allowAllStandardUsers,
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
              contentHtml: selectedItem.type === 'PAGE' ? form.contentHtml : undefined, // Legacy field
              introHtml: selectedItem.type === 'PAGE' ? form.introHtml : undefined,
              footerHtml: selectedItem.type === 'PAGE' ? form.footerHtml : undefined,
              roleCardsBlock:
                selectedItem.type === 'PAGE'
                  ? form.roleCardsEnabled
                    ? {
                        id: form.roleCardsBlockId || undefined,
                        title: form.roleCardsTitle.trim() || null,
                        layout: form.roleCardsLayout,
                        columns: form.roleCardsColumns,
                        cards: (form.roleCardsCards ?? []).map((c, idx) => ({
                          id: c.id || undefined,
                          title: c.title,
                          body: c.body,
                          orderIndex: idx,
                        })),
                      }
                    : null
                  : undefined,
              warningLevel: form.warningLevel || null,
              lastReviewedAt: form.lastReviewedDate ? toUtcMidnightIso(form.lastReviewedDate) : null,
            })
            if (!res.ok) {
              toast.error(res.error.message)
              return
            }
            toast.success('Page saved')
            await refresh()
          }}
        >
          Save page
        </button>
        <button
          type="button"
          className="rounded-md bg-nhs-red px-4 py-2 text-white transition-colors hover:bg-nhs-red-dark focus:outline-none focus:ring-2 focus:ring-nhs-red"
          onClick={async () => {
            const ok = confirm('Delete this page?')
            if (!ok) return
            const res = await deleteAdminToolkitItem({ surgeryId, itemId: selectedItem.id })
            if (!res.ok) {
              toast.error(res.error.message)
              return
            }
            toast.success('Page deleted')
            await refresh()
          }}
        >
          Delete page
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
      <p className="mt-3 text-xs text-gray-500">This is a simple mock-up of the pinned panel at the bottom of the Practice Handbook main page.</p>
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
  userCandidates,
  initialQuickAccessButtons,
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
  userCandidates: EditorCandidate[]
  initialQuickAccessButtons: AdminToolkitQuickAccessButton[]
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

  const userLabelById = useMemo(() => {
    const map = new Map<string, string>()
    for (const u of userCandidates) {
      map.set(u.id, u.name ? `${u.name} (${u.email})` : u.email)
    }
    return map
  }, [userCandidates])

  const CategoryVisibilityEditor = ({ category }: { category: AdminToolkitCategory }) => {
    const [mode, setMode] = useState<AdminToolkitCategory['visibilityMode']>(category.visibilityMode ?? 'ALL')
    const [roles, setRoles] = useState<Array<'ADMIN' | 'STANDARD'>>((category.visibilityRoles ?? []) as Array<'ADMIN' | 'STANDARD'>)
    const [visibleUserIds, setVisibleUserIds] = useState<string[]>(category.visibleUserIds ?? [])
    const [userQuery, setUserQuery] = useState('')
    const [saving, setSaving] = useState(false)

    useEffect(() => {
      setMode(category.visibilityMode ?? 'ALL')
      setRoles((category.visibilityRoles ?? []) as Array<'ADMIN' | 'STANDARD'>)
      setVisibleUserIds(category.visibleUserIds ?? [])
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [category.id, category.visibilityMode, JSON.stringify(category.visibilityRoles ?? []), JSON.stringify(category.visibleUserIds ?? [])])

    const effectiveRoles = mode === 'ROLES' || mode === 'ROLES_OR_USERS' ? roles : ([] as Array<'ADMIN' | 'STANDARD'>)
    const effectiveUsers = mode === 'USERS' || mode === 'ROLES_OR_USERS' ? visibleUserIds : ([] as string[])

    const summary = useMemo(() => {
      if (mode === 'ALL') return 'Everyone'
      if (mode === 'ROLES') return effectiveRoles.length ? `Roles: ${effectiveRoles.join(', ').toLowerCase()}` : 'Roles: none selected'
      if (mode === 'USERS') return effectiveUsers.length ? `People: ${effectiveUsers.length}` : 'People: none selected'
      if (mode === 'ROLES_OR_USERS') {
        const parts: string[] = []
        parts.push(effectiveRoles.length ? `Roles: ${effectiveRoles.join(', ').toLowerCase()}` : 'Roles: none')
        parts.push(effectiveUsers.length ? `People: ${effectiveUsers.length}` : 'People: none')
        return parts.join(' • ')
      }
      return 'Everyone'
    }, [mode, effectiveRoles, effectiveUsers])

    const filteredUsers = useMemo(() => {
      const q = userQuery.trim().toLowerCase()
      if (!q) return userCandidates
      return userCandidates.filter((u) => `${u.name ?? ''} ${u.email}`.toLowerCase().includes(q))
    }, [userCandidates, userQuery])

    return (
      <details className="mt-2 rounded-md border border-gray-200 bg-white">
        <summary className="cursor-pointer select-none px-3 py-2 text-sm text-gray-700">
          <span className="font-medium">Visible to:</span> <span className="text-gray-600">{summary}</span>
        </summary>
        <div className="border-t border-gray-200 px-3 py-3 space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Visibility</label>
            <select className="nhs-input w-full" value={mode} onChange={(e) => setMode(e.target.value as any)}>
              <option value="ALL">Everyone</option>
              <option value="ROLES">Roles</option>
              <option value="USERS">Specific people</option>
              <option value="ROLES_OR_USERS">Roles or people</option>
            </select>
          </div>

          {mode === 'ROLES' || mode === 'ROLES_OR_USERS' ? (
            <div>
              <div className="text-sm font-medium text-gray-700">Roles</div>
              <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                {(['ADMIN', 'STANDARD'] as const).map((r) => (
                  <label key={r} className="flex items-center gap-2 text-sm text-gray-800">
                    <input
                      type="checkbox"
                      checked={roles.includes(r)}
                      onChange={(e) => {
                        setRoles((prev) => (e.target.checked ? Array.from(new Set([...prev, r])) : prev.filter((x) => x !== r)))
                      }}
                    />
                    <span>{r === 'ADMIN' ? 'Admin' : 'Standard'}</span>
                  </label>
                ))}
              </div>
            </div>
          ) : null}

          {mode === 'USERS' || mode === 'ROLES_OR_USERS' ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">People</label>
              <input
                className="nhs-input w-full"
                value={userQuery}
                onChange={(e) => setUserQuery(e.target.value)}
                placeholder="Search people…"
              />

              {effectiveUsers.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {effectiveUsers
                    .slice()
                    .sort((a, b) => (userLabelById.get(a) ?? a).localeCompare(userLabelById.get(b) ?? b))
                    .map((id) => (
                      <span key={id} className="inline-flex items-center gap-2 rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-800 border border-gray-200">
                        <span className="truncate max-w-[240px]">{userLabelById.get(id) ?? id}</span>
                        <button
                          type="button"
                          className="text-gray-600 hover:text-gray-900"
                          onClick={() => setVisibleUserIds((prev) => prev.filter((x) => x !== id))}
                          aria-label="Remove person"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                </div>
              ) : (
                <p className="mt-2 text-xs text-gray-500">No people selected.</p>
              )}

              <div className="mt-2 max-h-48 overflow-y-auto rounded-md border border-gray-200 bg-gray-50 p-2">
                {filteredUsers.length === 0 ? (
                  <div className="text-sm text-gray-500 px-1 py-2">No matches.</div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {filteredUsers.slice(0, 80).map((u) => {
                      const checked = visibleUserIds.includes(u.id)
                      const label = u.name ? `${u.name} (${u.email})` : u.email
                      return (
                        <label key={u.id} className="flex items-center gap-2 text-sm text-gray-800">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              setVisibleUserIds((prev) =>
                                e.target.checked ? Array.from(new Set([...prev, u.id])) : prev.filter((x) => x !== u.id),
                              )
                            }}
                          />
                          <span className="truncate">{label}</span>
                        </label>
                      )
                    })}
                  </div>
                )}
              </div>
              <p className="mt-1 text-xs text-gray-500">Showing up to 80 people.</p>
            </div>
          ) : null}

          <div className="flex justify-end">
            <button
              type="button"
              className="nhs-button-secondary"
              disabled={saving}
              onClick={async () => {
                setSaving(true)
                try {
                  const res = await setAdminToolkitCategoryVisibility({
                    surgeryId,
                    categoryId: category.id,
                    visibilityMode: mode,
                    visibilityRoles: roles,
                    visibleUserIds,
                  })
                  if (!res.ok) {
                    toast.error(res.error.message)
                    return
                  }
                  toast.success('Category visibility updated')
                  await refresh()
                } finally {
                  setSaving(false)
                }
              }}
            >
              {saving ? 'Saving…' : 'Save visibility'}
            </button>
          </div>
        </div>
      </details>
    )
  }

  const pinnedDirty =
    (panelTaskBuddy ?? '') !== (panelSaved.taskBuddyText ?? '') || (panelPostRoute ?? '') !== (panelSaved.postRouteText ?? '')

  const sortQuickAccess = (buttons: AdminToolkitQuickAccessButton[]): AdminToolkitQuickAccessButton[] =>
    buttons
      .slice()
      .sort((a, b) => a.orderIndex - b.orderIndex)
      .map((b, idx) => ({ ...b, orderIndex: idx }))

  const reindexQuickAccess = (buttons: AdminToolkitQuickAccessButton[]): AdminToolkitQuickAccessButton[] =>
    buttons.map((b, idx) => ({ ...b, orderIndex: idx }))

  const [quickAccessButtons, setQuickAccessButtons] = useState<AdminToolkitQuickAccessButton[]>(() =>
    sortQuickAccess(initialQuickAccessButtons),
  )
  const [quickAccessSaveState, setQuickAccessSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const quickAccessLastSavedJsonRef = useRef<string>(JSON.stringify(sortQuickAccess(initialQuickAccessButtons)))
  const quickAccessSaveTimerRef = useRef<number | null>(null)

  const [newQuickLabel, setNewQuickLabel] = useState('')
  const [newQuickItemId, setNewQuickItemId] = useState('')
  const [newQuickBg, setNewQuickBg] = useState('#005EB8')
  const [newQuickText, setNewQuickText] = useState('#FFFFFF')

  useEffect(() => {
    const sorted = sortQuickAccess(initialQuickAccessButtons)
    setQuickAccessButtons(sorted)
    quickAccessLastSavedJsonRef.current = JSON.stringify(sorted)
    setQuickAccessSaveState('idle')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(initialQuickAccessButtons)])

  const persistQuickAccessButtons = async (
    nextButtons: AdminToolkitQuickAccessButton[],
    opts?: { successToast?: string; errorToast?: string },
  ): Promise<boolean> => {
    setQuickAccessSaveState('saving')
    try {
      const res = await setAdminToolkitQuickAccessButtons({
        surgeryId,
        buttons: nextButtons.map((b) => ({
          id: b.id.startsWith('tmp-') ? undefined : b.id,
          label: b.label.trim() ? b.label : undefined,
          itemId: b.itemId,
          backgroundColour: b.backgroundColour,
          textColour: b.textColour,
        })),
      })
      if (!res.ok) {
        toast.error(opts?.errorToast ?? res.error.message)
        setQuickAccessSaveState('error')
        return false
      }

      const sorted = sortQuickAccess(res.data.buttons)
      quickAccessLastSavedJsonRef.current = JSON.stringify(sorted)
      setQuickAccessButtons(sorted)
      setQuickAccessSaveState('saved')
      if (opts?.successToast) toast.success(opts.successToast)

      // Keep behaviour consistent with the rest of the settings page.
      await refresh()

      window.setTimeout(() => setQuickAccessSaveState('idle'), 1200)
      return true
    } finally {
      // no-op: state handled above
    }
  }

  // Debounced autosave for edits (label/colours/target), avoids toast spam.
  useEffect(() => {
    const json = JSON.stringify(quickAccessButtons)
    if (json === quickAccessLastSavedJsonRef.current) return

    if (quickAccessSaveTimerRef.current) window.clearTimeout(quickAccessSaveTimerRef.current)
    setQuickAccessSaveState('saving')
    quickAccessSaveTimerRef.current = window.setTimeout(() => {
      void persistQuickAccessButtons(quickAccessButtons)
    }, 500)

    return () => {
      if (quickAccessSaveTimerRef.current) window.clearTimeout(quickAccessSaveTimerRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quickAccessButtons])

  type QuickAccessTargetOption = {
    id: string
    title: string
    type: 'PAGE' | 'LIST'
    categoryLabel: string
  }

  const categoryLabelById = useMemo(() => {
    const map = new Map<string, string>()
    const walk = (cat: AdminToolkitCategory, parentPath?: string) => {
      const path = parentPath ? `${parentPath} › ${cat.name}` : cat.name
      map.set(cat.id, path)
      for (const child of cat.children ?? []) walk(child, path)
    }
    for (const top of categories) walk(top)
    return map
  }, [categories])

  const itemOptions = useMemo<QuickAccessTargetOption[]>(() => {
    return items
      .slice()
      .sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }))
      .map((it) => ({
        id: it.id,
        title: it.title,
        type: it.type,
        categoryLabel: it.categoryId ? categoryLabelById.get(it.categoryId) ?? 'Category' : 'Uncategorised',
      }))
  }, [items, categoryLabelById])

  const itemOptionById = useMemo(() => new Map(itemOptions.map((o) => [o.id, o])), [itemOptions])

  const QuickAccessItemPicker = ({
    inputId,
    value,
    onChange,
    placeholder = 'Search items…',
  }: {
    inputId: string
    value: string
    onChange: (id: string) => void
    placeholder?: string
  }) => {
    const [query, setQuery] = useState('')
    const [open, setOpen] = useState(false)
    const [activeIndex, setActiveIndex] = useState(0)
    const dropdownRef = useRef<HTMLDivElement>(null)
    const listboxId = `${inputId}-listbox`

    const selected = value ? itemOptionById.get(value) ?? null : null

    const filtered = useMemo(() => {
      const q = query.trim().toLowerCase()
      const base = q
        ? itemOptions.filter((it) => {
            const hay = `${it.title} ${it.type} ${it.categoryLabel}`.toLowerCase()
            return hay.includes(q)
          })
        : itemOptions
      return base.slice(0, 60)
    }, [itemOptions, query])

    useEffect(() => {
      const onDocMouseDown = (event: MouseEvent) => {
        if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
          setOpen(false)
        }
      }
      if (open) document.addEventListener('mousedown', onDocMouseDown)
      return () => document.removeEventListener('mousedown', onDocMouseDown)
    }, [open])

    useEffect(() => {
      setActiveIndex(0)
    }, [query])

    const pick = (id: string) => {
      onChange(id)
      setQuery('')
      setOpen(false)
      setActiveIndex(0)
    }

    return (
      <div className="relative min-w-0" ref={dropdownRef}>
        <input
          id={inputId}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          className="nhs-input w-full h-10"
          role="combobox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-autocomplete="list"
          onKeyDown={(e) => {
            if (!open) return
            if (e.key === 'Escape') {
              setOpen(false)
              return
            }
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              setActiveIndex((i) => Math.min(i + 1, Math.max(0, filtered.length - 1)))
            }
            if (e.key === 'ArrowUp') {
              e.preventDefault()
              setActiveIndex((i) => Math.max(0, i - 1))
            }
            if (e.key === 'Enter') {
              const hit = filtered[activeIndex]
              if (hit) {
                e.preventDefault()
                pick(hit.id)
              }
            }
          }}
        />

        {open && filtered.length > 0 ? (
          <div
            id={listboxId}
            className="absolute z-20 mt-1 w-full rounded-md border border-gray-200 bg-white shadow-lg max-h-64 overflow-y-auto"
            role="listbox"
            aria-label="Matching items"
            onClick={(e) => e.stopPropagation()}
          >
            {filtered.map((it, idx) => {
              const isActive = idx === activeIndex
              const isSelected = it.id === value
              return (
                <button
                  key={it.id}
                  type="button"
                  onMouseEnter={() => setActiveIndex(idx)}
                  onClick={() => pick(it.id)}
                  className={[
                    'w-full text-left px-3 py-2 text-sm',
                    isActive ? 'bg-nhs-light-blue' : 'hover:bg-gray-50',
                  ].join(' ')}
                  role="option"
                  aria-selected={isSelected}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-medium text-gray-900 truncate">{it.title}</div>
                      <div className="text-xs text-gray-500 truncate">{it.categoryLabel}</div>
                    </div>
                    <span className="shrink-0 inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-[11px] font-medium text-gray-700">
                      {it.type}
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
        ) : null}

        {selected ? (
          <p className="mt-1 text-xs text-gray-500">
            Selected: <span className="font-medium text-gray-700">{selected.title}</span>
          </p>
        ) : (
          <p className="mt-1 text-xs text-gray-500">Pick a target item to open.</p>
        )}
      </div>
    )
  }

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
            <a className={settingsLinkClass} href="#settings-quick-access">
              Quick access buttons
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
      <div className="space-y-6 min-w-0">
        {/* Categories */}
        <section id="settings-categories" className="bg-white rounded-lg shadow-md border border-gray-200 scroll-mt-6">
          <div className="p-6 border-b border-gray-200">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div className="min-w-0">
                <h2 className="text-lg font-semibold text-nhs-dark-blue">Categories</h2>
                <p className="mt-1 text-sm text-nhs-grey">Create and organise categories for Practice Handbook items.</p>
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
                            <CategoryVisibilityEditor category={parent} />
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
                            <CategoryVisibilityEditor category={child} />
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

        {/* Quick access */}
        <section id="settings-quick-access" className="bg-white rounded-lg shadow-md border border-gray-200 scroll-mt-6">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h2 className="text-lg font-semibold text-nhs-dark-blue">Quick access buttons</h2>
                <p className="mt-1 text-sm text-nhs-grey">
                  These buttons appear on the Practice Handbook main page and open a specific item. Colours here are always respected (including in blue cards mode).
                </p>
              </div>
              <div className="shrink-0 text-sm text-gray-500" aria-live="polite">
                {quickAccessSaveState === 'saving' ? 'Saving…' : quickAccessSaveState === 'saved' ? 'Saved' : quickAccessSaveState === 'error' ? 'Not saved' : null}
              </div>
            </div>
          </div>

          <div className="p-6 space-y-6">
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <div className="text-sm font-semibold text-gray-900">Add a button</div>
              <div className="mt-1 text-xs text-gray-500">Label is optional and defaults to the target item title.</div>
              <div className="mt-3 grid grid-cols-1 lg:grid-cols-2 gap-3 items-end">
                <div className="min-w-0">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Label (optional)</label>
                  <input
                    className="nhs-input w-full h-10"
                    value={newQuickLabel}
                    onChange={(e) => setNewQuickLabel(e.target.value)}
                    placeholder="Defaults to the target item title"
                  />
                  <p className="mt-1 text-xs text-gray-500">&nbsp;</p>
                </div>

                <div className="min-w-0">
                  <label className="block text-xs font-medium text-gray-600 mb-1" htmlFor="new-quick-access-item">
                    Target item
                  </label>
                  <QuickAccessItemPicker inputId="new-quick-access-item" value={newQuickItemId} onChange={setNewQuickItemId} />
                </div>

                <div className="flex flex-wrap items-end gap-6">
                  <div className="flex items-center gap-2">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Background</label>
                      <input type="color" value={newQuickBg} onChange={(e) => setNewQuickBg(e.target.value)} className="h-10 w-12" />
                    </div>
                    <code className="pt-5 text-xs text-gray-500 break-all">{newQuickBg}</code>
                  </div>
                  <div className="flex items-center gap-2">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Text</label>
                      <input type="color" value={newQuickText} onChange={(e) => setNewQuickText(e.target.value)} className="h-10 w-12" />
                    </div>
                    <code className="pt-5 text-xs text-gray-500 break-all">{newQuickText}</code>
                  </div>
                </div>

                <div className="flex justify-end items-end">
                  <button
                    type="button"
                    className="nhs-button"
                    disabled={quickAccessSaveState === 'saving' || !newQuickItemId}
                    onClick={async () => {
                      const next = sortQuickAccess([
                        ...quickAccessButtons,
                        {
                          id: `tmp-${Date.now()}-${Math.random().toString(16).slice(2)}`,
                          label: newQuickLabel,
                          itemId: newQuickItemId,
                          backgroundColour: newQuickBg,
                          textColour: newQuickText,
                          orderIndex: quickAccessButtons.length,
                        },
                      ])

                      const ok = await persistQuickAccessButtons(next, { successToast: 'Quick access button added' })
                      if (!ok) return

                      setNewQuickLabel('')
                      setNewQuickItemId('')
                      setNewQuickBg('#005EB8')
                      setNewQuickText('#FFFFFF')
                    }}
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>

            {quickAccessButtons.length === 0 ? (
              <p className="text-sm text-gray-500">No quick access buttons yet.</p>
            ) : (
              <div className="space-y-3">
                {quickAccessButtons.map((b, idx) => (
                  <div key={b.id} className="rounded-lg border border-gray-200 bg-white p-4">
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 items-end">
                      <div className="min-w-0">
                        <label className="block text-xs font-medium text-gray-600 mb-1">Label (optional)</label>
                        <input
                          className="nhs-input w-full h-10"
                          value={b.label}
                          onChange={(e) =>
                            setQuickAccessButtons((prev) =>
                              sortQuickAccess(prev.map((x) => (x.id === b.id ? { ...x, label: e.target.value } : x))),
                            )
                          }
                          placeholder="Defaults to the target item title"
                        />
                        <p className="mt-1 text-xs text-gray-500">&nbsp;</p>
                      </div>

                      <div className="min-w-0">
                        <label className="block text-xs font-medium text-gray-600 mb-1" htmlFor={`quick-access-item-${b.id}`}>
                          Target item
                        </label>
                        <QuickAccessItemPicker
                          inputId={`quick-access-item-${b.id}`}
                          value={b.itemId}
                          onChange={(id) =>
                            setQuickAccessButtons((prev) =>
                              sortQuickAccess(prev.map((x) => (x.id === b.id ? { ...x, itemId: id } : x))),
                            )
                          }
                        />
                      </div>

                      <div className="flex flex-wrap items-end gap-6">
                        <div className="flex items-center gap-2">
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Background</label>
                            <input
                              type="color"
                              value={b.backgroundColour}
                              onChange={(e) =>
                                setQuickAccessButtons((prev) =>
                                  sortQuickAccess(prev.map((x) => (x.id === b.id ? { ...x, backgroundColour: e.target.value } : x))),
                                )
                              }
                              className="h-10 w-12"
                            />
                          </div>
                          <code className="pt-5 text-xs text-gray-500 break-all">{b.backgroundColour}</code>
                        </div>
                        <div className="flex items-center gap-2">
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Text</label>
                            <input
                              type="color"
                              value={b.textColour}
                              onChange={(e) =>
                                setQuickAccessButtons((prev) =>
                                  sortQuickAccess(prev.map((x) => (x.id === b.id ? { ...x, textColour: e.target.value } : x))),
                                )
                              }
                              className="h-10 w-12"
                            />
                          </div>
                          <code className="pt-5 text-xs text-gray-500 break-all">{b.textColour}</code>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2 justify-end">
                        <ActionButton
                          variant="neutral"
                          ariaLabel="Move button up"
                          disabled={idx === 0}
                          onClick={async () => {
                            const prevButtons = quickAccessButtons
                            const prevSavedJson = quickAccessLastSavedJsonRef.current

                            const next = quickAccessButtons.slice()
                            const tmp = next[idx - 1]
                            next[idx - 1] = next[idx]
                            next[idx] = tmp
                            const ordered = reindexQuickAccess(next)

                            // Optimistic UI, and suppress the debounced autosave to avoid duplicate saves.
                            quickAccessLastSavedJsonRef.current = JSON.stringify(ordered)
                            setQuickAccessButtons(ordered)

                            const ok = await persistQuickAccessButtons(ordered)
                            if (!ok) {
                              quickAccessLastSavedJsonRef.current = prevSavedJson
                              setQuickAccessButtons(prevButtons)
                            }
                          }}
                        >
                          ↑
                        </ActionButton>
                        <ActionButton
                          variant="neutral"
                          ariaLabel="Move button down"
                          disabled={idx >= quickAccessButtons.length - 1}
                          onClick={async () => {
                            const prevButtons = quickAccessButtons
                            const prevSavedJson = quickAccessLastSavedJsonRef.current

                            const next = quickAccessButtons.slice()
                            const tmp = next[idx + 1]
                            next[idx + 1] = next[idx]
                            next[idx] = tmp
                            const ordered = reindexQuickAccess(next)

                            quickAccessLastSavedJsonRef.current = JSON.stringify(ordered)
                            setQuickAccessButtons(ordered)

                            const ok = await persistQuickAccessButtons(ordered)
                            if (!ok) {
                              quickAccessLastSavedJsonRef.current = prevSavedJson
                              setQuickAccessButtons(prevButtons)
                            }
                          }}
                        >
                          ↓
                        </ActionButton>
                        <ActionButton
                          variant="danger"
                          ariaLabel="Delete quick access button"
                          onClick={async () => {
                            const display = b.label.trim() || itemOptionById.get(b.itemId)?.title || 'this button'
                            const ok = confirm(`Delete "${display}"?`)
                            if (!ok) return
                            const prevButtons = quickAccessButtons
                            const prevSavedJson = quickAccessLastSavedJsonRef.current

                            const next = reindexQuickAccess(quickAccessButtons.filter((x) => x.id !== b.id))

                            quickAccessLastSavedJsonRef.current = JSON.stringify(next)
                            setQuickAccessButtons(next)

                            const saved = await persistQuickAccessButtons(next, { successToast: 'Quick access button deleted' })
                            if (!saved) {
                              quickAccessLastSavedJsonRef.current = prevSavedJson
                              setQuickAccessButtons(prevButtons)
                            }
                          }}
                        >
                          Delete
                        </ActionButton>
                      </div>
                    </div>

                    <div className="mt-3">
                      <div
                        className="inline-flex items-center rounded-md px-3 py-2 text-sm font-medium max-w-full break-words"
                        style={{ backgroundColor: b.backgroundColour, color: b.textColour }}
                      >
                        Preview:{' '}
                        {b.label.trim()
                          ? b.label.trim()
                          : itemOptionById.get(b.itemId)?.title
                            ? itemOptionById.get(b.itemId)!.title
                            : 'Button label'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Pinned panel */}
        <section id="settings-pinned-panel" className="bg-white rounded-lg shadow-md border border-gray-200 scroll-mt-6">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-nhs-dark-blue">Pinned panel</h2>
            <p className="mt-1 text-sm text-nhs-grey">This appears at the bottom of the Practice Handbook main page.</p>
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

