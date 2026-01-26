'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import RichTextEditor from '@/components/rich-text/RichTextEditor'
import { sanitizeHtml } from '@/lib/sanitizeHtml'
import { getFooterTextBlock, getIntroTextBlock, getRoleCardsBlock, isHtmlEmpty } from '@/lib/adminToolkitContentBlocksShared'
import type { RoleCard, RoleCardsColumns, RoleCardsLayout } from '@/lib/adminToolkitContentBlocksShared'
import { updateAdminToolkitItem } from '../../../actions'

type InitialItem = {
  type: 'PAGE' | 'LIST'
  title: string
  warningLevel: string | null
  contentHtml: string | null
  contentJson: unknown | null
  lastReviewedAtIso: string // YYYY-MM-DD
}

type FormState = {
  title: string
  warningLevel: string
  introHtml: string
  footerHtml: string
  roleCardsEnabled: boolean
  roleCardsBlockId: string
  roleCardsTitle: string
  roleCardsLayout: RoleCardsLayout
  roleCardsColumns: RoleCardsColumns
  roleCardsCards: RoleCard[]
  lastReviewedDate: string
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

function RoleCardsEditor({
  form,
  setForm,
}: {
  form: FormState
  setForm: React.Dispatch<React.SetStateAction<FormState>>
}) {
  const enabled = form.roleCardsEnabled
  const hasRoleCards =
    enabled &&
    (((form.roleCardsCards ?? []).length > 0) ||
      (form.roleCardsTitle ?? '').trim().length > 0 ||
      form.roleCardsLayout === 'row')
  const defaultOpen = hasRoleCards
  const [open, setOpen] = useState(defaultOpen)

  useEffect(() => {
    if (hasRoleCards) setOpen(true)
  }, [hasRoleCards])

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
      roleCardsCards: [...prev.roleCardsCards, { id: newClientId(), title: '', body: '', orderIndex: prev.roleCardsCards.length }],
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
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
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
                  onChange={(e) => setForm((prev) => ({ ...prev, roleCardsLayout: e.target.value as RoleCardsLayout }))}
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
                  onChange={(e) => setForm((prev) => ({ ...prev, roleCardsColumns: Number(e.target.value) as RoleCardsColumns }))}
                >
                  <option value={2}>2</option>
                  <option value={3}>3</option>
                  <option value={4}>4</option>
                </select>
                {form.roleCardsLayout !== 'grid' ? <p className="mt-1 text-xs text-gray-500">Columns apply to grid layout only.</p> : null}
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
                              className="w-full nhs-input"
                              value={card.body}
                              onChange={(e) => updateCard(card.id, { body: e.target.value })}
                              rows={4}
                              placeholder={'Answer calls\nBook appointments\nSignpost to urgent care'}
                            />
                          </div>
                          <div className="flex flex-wrap gap-2 justify-end">
                            <button
                              type="button"
                              className="nhs-button-secondary"
                              disabled={idx <= 0}
                              onClick={() => reorderCards(idx, idx - 1)}
                              aria-label="Move card up"
                            >
                              ↑
                            </button>
                            <button
                              type="button"
                              className="nhs-button-secondary"
                              disabled={idx >= form.roleCardsCards.length - 1}
                              onClick={() => reorderCards(idx, idx + 1)}
                              aria-label="Move card down"
                            >
                              ↓
                            </button>
                            <button
                              type="button"
                              className="nhs-button-secondary"
                              onClick={() => {
                                const ok = confirm('Delete this card?')
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

export default function AdminToolkitItemEditClient({
  surgeryId,
  itemId,
  initial,
}: {
  surgeryId: string
  itemId: string
  initial: InitialItem
}) {
  const router = useRouter()
  const isPage = initial.type === 'PAGE'

  const initialForm = useMemo<FormState>(() => {
    const roleCards = initial.type === 'PAGE' ? getRoleCardsBlock(initial.contentJson ?? null) : null
    const introBlock = initial.type === 'PAGE' ? getIntroTextBlock(initial.contentJson ?? null) : null
    const footerBlock = initial.type === 'PAGE' ? getFooterTextBlock(initial.contentJson ?? null) : null
    const hasLegacyContent = initial.type === 'PAGE' && initial.contentHtml && !footerBlock && !isHtmlEmpty(initial.contentHtml)

    return {
      title: initial.title ?? '',
      warningLevel: initial.warningLevel ?? '',
      introHtml: introBlock?.html ?? '',
      footerHtml: footerBlock?.html ?? (hasLegacyContent ? initial.contentHtml ?? '' : ''),
      roleCardsEnabled: !!roleCards,
      roleCardsBlockId: roleCards?.id ?? '',
      roleCardsTitle: (roleCards?.title ?? '') || '',
      roleCardsLayout: roleCards?.layout === 'row' ? 'row' : 'grid',
      roleCardsColumns: (roleCards?.columns ?? 3) as RoleCardsColumns,
      roleCardsCards: (roleCards?.cards ?? []).slice().sort((a, b) => a.orderIndex - b.orderIndex),
      lastReviewedDate: initial.lastReviewedAtIso ?? '',
    }
  }, [initial])

  const [form, setForm] = useState<FormState>(initialForm)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setForm(initialForm)
  }, [initialForm])

  const canSave = form.title.trim().length > 0 && !saving

  return (
    <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
          <input className="w-full nhs-input" value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Warning badge (optional)</label>
          <input
            className="w-full nhs-input"
            value={form.warningLevel}
            onChange={(e) => setForm((p) => ({ ...p, warningLevel: e.target.value }))}
            placeholder="e.g. Urgent"
          />
        </div>
      </div>

      {isPage ? (
        <>
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700">Page content (optional)</label>
            <p className="mt-1 text-xs text-gray-500">Main guidance text shown above role cards.</p>
            <div className="mt-2">
              <RichTextEditor
                docId={`admin-toolkit:staff-edit:${itemId}:intro`}
                value={form.introHtml}
                onChange={(html) => setForm((prev) => ({ ...prev, introHtml: sanitizeHtml(html) }))}
                height={220}
                placeholder="Write guidance for staff…"
              />
            </div>
          </div>

          <RoleCardsEditor form={form} setForm={setForm} />

          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700">Additional notes (optional)</label>
            <p className="mt-1 text-xs text-gray-500">Optional extra guidance shown below role cards.</p>
            <div className="mt-2">
              <RichTextEditor
                docId={`admin-toolkit:staff-edit:${itemId}:footer`}
                value={form.footerHtml}
                onChange={(html) => setForm((prev) => ({ ...prev, footerHtml: sanitizeHtml(html) }))}
                height={220}
                placeholder="Optional extra guidance…"
              />
            </div>
          </div>
        </>
      ) : (
        <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
          <strong>This is a LIST page.</strong> You can edit list rows on the page.
        </div>
      )}

      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Last reviewed (optional)</label>
          <input
            type="date"
            className="w-full nhs-input"
            value={form.lastReviewedDate}
            onChange={(e) => setForm((p) => ({ ...p, lastReviewedDate: e.target.value }))}
          />
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-2 justify-end">
        <button
          type="button"
          className="nhs-button-secondary"
          onClick={() => router.push(`/s/${surgeryId}/admin-toolkit/${itemId}`)}
          disabled={saving}
        >
          Cancel
        </button>
        <button
          type="button"
          className="nhs-button"
          disabled={!canSave}
          onClick={async () => {
            setSaving(true)
            try {
              const res = await updateAdminToolkitItem({
                surgeryId,
                itemId,
                title: form.title,
                // Category changes are blocked server-side for non-admins.
                introHtml: isPage ? form.introHtml : undefined,
                footerHtml: isPage ? form.footerHtml : undefined,
                roleCardsBlock: isPage
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
                lastReviewedAt: form.lastReviewedDate ? new Date(`${form.lastReviewedDate}T00:00:00.000Z`).toISOString() : null,
              })
              if (!res.ok) {
                toast.error(res.error.message)
                return
              }
              toast.success('Page updated')
              router.push(`/s/${surgeryId}/admin-toolkit/${itemId}`)
              router.refresh()
            } finally {
              setSaving(false)
            }
          }}
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  )
}

