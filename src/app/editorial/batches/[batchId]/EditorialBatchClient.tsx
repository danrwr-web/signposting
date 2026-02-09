'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import LearningCardPreview from '@/components/daily-dose/LearningCardPreview'
import PhoneFrame from '@/components/daily-dose/PhoneFrame'
import Modal from '@/components/appointments/Modal'

type Batch = {
  id: string
  promptText: string
  targetRole: string
  modelUsed?: string | null
  createdAt: string
}

type Card = {
  id: string
  title: string
  status: string
  riskLevel: string
  needsSourcing: boolean
  targetRole: string
  estimatedTimeMinutes: number
  reviewByDate: string | null
  tags: string[]
  contentBlocks: Array<any>
  interactions: Array<any>
  slotLanguage: { relevant: boolean; guidance: Array<{ slot: string; rule: string }> } | null
  safetyNetting: string[]
  sources: Array<{ title: string; url: string; publisher?: string; accessedDate?: string }>
  clinicianApproved: boolean
  clinicianApprovedBy?: { id: string; name: string | null; email: string } | null
  clinicianApprovedAt?: string | null
}

type Quiz = {
  id: string
  title: string
  questions: Array<{
    type: string
    question: string
    options: string[]
    correctIndex: number
    explanation: string
  }>
}

type BlockState =
  | { type: 'text' | 'callout'; text: string }
  | { type: 'steps' | 'do-dont'; itemsText: string }

type InteractionState = {
  type: 'mcq' | 'true_false' | 'choose_action'
  question: string
  optionsText: string
  correctIndex: number
  explanation: string
}

type SourceState = {
  title: string
  url: string
  publisher?: string
  accessedDate?: string
}

const riskBadgeStyles: Record<string, string> = {
  LOW: 'bg-emerald-100 text-emerald-800',
  MED: 'bg-amber-100 text-amber-800',
  HIGH: 'bg-red-100 text-red-700',
}

const sectionOptions = [
  { value: 'title', label: 'Title' },
  { value: 'scenario', label: 'Scenario' },
  { value: 'mcq', label: 'MCQ' },
  { value: 'answerOptions', label: 'Answer options' },
  { value: 'feedback', label: 'Feedback' },
  { value: 'safetyNetting', label: 'Safety netting' },
  { value: 'sources', label: 'Sources' },
  { value: 'slotLanguage', label: 'Slot language' },
]

export default function EditorialBatchClient({ batchId, surgeryId }: { batchId: string; surgeryId: string }) {
  const router = useRouter()
  const [batch, setBatch] = useState<Batch | null>(null)
  const [cards, setCards] = useState<Card[]>([])
  const [quiz, setQuiz] = useState<Quiz | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [activeType, setActiveType] = useState<'card' | 'quiz'>('card')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [regenSection, setRegenSection] = useState('mcq')
  const [regenNote, setRegenNote] = useState('')
  const [showCompletionModal, setShowCompletionModal] = useState(false)
  const [nextBatchId, setNextBatchId] = useState<string | null>(null)

  const [cardForm, setCardForm] = useState({
    id: '',
    title: '',
    targetRole: 'ADMIN',
    estimatedTimeMinutes: 5,
    tagsText: '',
    riskLevel: 'LOW',
    needsSourcing: false,
    reviewByDate: '',
    blocks: [] as BlockState[],
    interactions: [] as InteractionState[],
    slotRelevant: false,
    slotGuidance: [] as Array<{ slot: string; rule: string }>,
    safetyNettingText: '',
    sources: [] as SourceState[],
    status: 'DRAFT',
  })

  const loadBatch = useCallback(async (onComplete?: (cards: Card[]) => void) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/editorial/batches/${batchId}?surgeryId=${surgeryId}`, { cache: 'no-store' })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(payload?.error?.message || 'Unable to load batch')
      }
      setBatch(payload.batch)
      const normalisedCards = (payload.cards || []).map((card: Card) => ({
        ...card,
        tags: Array.isArray(card.tags) ? card.tags : [],
        contentBlocks: Array.isArray(card.contentBlocks) ? card.contentBlocks : [],
        interactions: Array.isArray(card.interactions) ? card.interactions : [],
        safetyNetting: Array.isArray(card.safetyNetting) ? card.safetyNetting : [],
        sources: Array.isArray(card.sources) ? card.sources : [],
        slotLanguage: card.slotLanguage ?? { relevant: false, guidance: [] },
      }))
      setCards(normalisedCards)
      setQuiz(payload.quiz || null)
      if (normalisedCards.length && !activeId) {
        setActiveId(normalisedCards[0].id)
        setActiveType('card')
      }
      if (onComplete) {
        onComplete(normalisedCards)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }, [batchId, surgeryId, activeId])

  useEffect(() => {
    loadBatch()
  }, [loadBatch])

  const activeCard = useMemo(
    () => (activeType === 'card' ? cards.find((card) => card.id === activeId) ?? null : null),
    [cards, activeId, activeType]
  )

  useEffect(() => {
    if (!activeCard) return
    setCardForm({
      id: activeCard.id,
      title: activeCard.title,
      targetRole: activeCard.targetRole ?? 'ADMIN',
      estimatedTimeMinutes: activeCard.estimatedTimeMinutes ?? 5,
      tagsText: (activeCard.tags || []).join(', '),
      riskLevel: activeCard.riskLevel ?? 'LOW',
      needsSourcing: Boolean(activeCard.needsSourcing),
      reviewByDate: activeCard.reviewByDate ? activeCard.reviewByDate.slice(0, 10) : '',
      blocks: (activeCard.contentBlocks || []).map((block: any) => {
        if (block.type === 'steps' || block.type === 'do-dont') {
          return {
            type: block.type,
            itemsText: Array.isArray(block.items) ? block.items.join('\n') : '',
          }
        }
        return {
          type: block.type === 'callout' ? 'callout' : 'text',
          text: block.text ?? '',
        }
      }),
      interactions: (activeCard.interactions || []).map((interaction: any) => ({
        type: interaction.type ?? 'mcq',
        question: interaction.question ?? '',
        optionsText: Array.isArray(interaction.options) ? interaction.options.join('\n') : '',
        correctIndex: interaction.correctIndex ?? 0,
        explanation: interaction.explanation ?? '',
      })),
      slotRelevant: activeCard.slotLanguage?.relevant ?? false,
      slotGuidance: activeCard.slotLanguage?.guidance ?? [],
      safetyNettingText: (activeCard.safetyNetting || []).join('\n'),
      sources: (activeCard.sources || []).map((source) => ({
        title: source.title ?? '',
        url: source.url ?? '',
        publisher: source.publisher ?? '',
        accessedDate: source.accessedDate ?? '',
      })),
      status: activeCard.status,
    })
  }, [activeCard])

  // Readiness checklist - detailed requirements for approval
  const readinessChecks = useMemo(() => {
    const hasSources = cardForm.sources.filter((source) => source.title?.trim()).length > 0
    const hasInteractions = cardForm.interactions.length > 0
    const hasReviewDate = Boolean(cardForm.reviewByDate)
    const sourcesVerified = !cardForm.needsSourcing
    const hasContentBlocks = cardForm.blocks.length > 0
    const hasSafetyNetting = cardForm.safetyNettingText.trim().length > 0

    return {
      hasContentBlocks,
      hasSources,
      sourcesVerified,
      hasInteractions,
      hasSafetyNetting,
      hasReviewDate,
      isHighRisk: cardForm.riskLevel === 'HIGH',
      clinicianApproved: activeCard?.clinicianApproved ?? false,
    }
  }, [cardForm, activeCard])

  const canApprove = useMemo(() => {
    const { hasSources, sourcesVerified, hasInteractions, hasReviewDate } = readinessChecks
    return hasSources && sourcesVerified && hasInteractions && hasReviewDate
  }, [readinessChecks])

  // Note: canPublish is no longer used since we have a single "Approve and publish" button.
  // Editors with access to the editorial section are clinical approvers by default,
  // so clinician approval is not a gate for publishing.

  // Build the save payload from current form state
  const buildSavePayload = () => ({
    surgeryId,
    title: cardForm.title,
    targetRole: cardForm.targetRole,
    estimatedTimeMinutes: cardForm.estimatedTimeMinutes,
    tags: cardForm.tagsText
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean),
    riskLevel: cardForm.riskLevel,
    needsSourcing: cardForm.needsSourcing,
    reviewByDate: cardForm.reviewByDate || null,
    sources: cardForm.sources
      .filter((source) => source.title && source.title.trim())
      .map((source) => ({
        ...source,
        url: source.url && source.url.trim() ? source.url.trim() : null,
      })),
    contentBlocks: cardForm.blocks.map((block) => {
      if (block.type === 'steps' || block.type === 'do-dont') {
        return {
          type: block.type,
          items: block.itemsText
            .split('\n')
            .map((item) => item.trim())
            .filter(Boolean),
        }
      }
      return block
    }),
    interactions: cardForm.interactions.map((interaction) => ({
      type: interaction.type,
      question: interaction.question,
      options: interaction.optionsText
        .split('\n')
        .map((option) => option.trim())
        .filter(Boolean),
      correctIndex: interaction.correctIndex,
      explanation: interaction.explanation,
    })),
    slotLanguage: {
      relevant: cardForm.slotRelevant,
      guidance: cardForm.slotRelevant
        ? cardForm.slotGuidance.filter((item) => item.slot && item.rule)
        : [],
    },
    safetyNetting: cardForm.safetyNettingText
      .split('\n')
      .map((item) => item.trim())
      .filter(Boolean),
  })

  // Save draft and return success status
  const doSave = async (): Promise<boolean> => {
    if (!cardForm.id) return false
    try {
      const response = await fetch(`/api/editorial/cards/${cardForm.id}?surgeryId=${surgeryId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildSavePayload()),
      })
      const resPayload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(resPayload?.error?.message || 'Unable to save card')
      }
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      return false
    }
  }

  const handleApproveAndPublish = async () => {
    if (!cardForm.id) return
    setSaving(true)
    setError(null)
    try {
      // First, save the current form state to persist any changes
      const saveSuccess = await doSave()
      if (!saveSuccess) {
        return // Error already set by doSave
      }

      // Then approve
      const approveResponse = await fetch(`/api/editorial/cards/${cardForm.id}/approve?surgeryId=${surgeryId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ surgeryId }),
      })
      const approvePayload = await approveResponse.json().catch(() => ({}))
      if (!approveResponse.ok) {
        throw new Error(approvePayload?.error?.message || 'Unable to approve card')
      }

      // Then publish
      const publishResponse = await fetch(`/api/editorial/cards/${cardForm.id}/publish?surgeryId=${surgeryId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ surgeryId }),
      })
      const publishPayload = await publishResponse.json().catch(() => ({}))
      if (!publishResponse.ok) {
        throw new Error(publishPayload?.error?.message || 'Unable to publish card')
      }

      // Reload batch to get updated card statuses
      await loadBatch((updatedCards) => {
        // Check if there are any unpublished cards
        const unpublishedCards = updatedCards.filter((card) => card.status !== 'PUBLISHED')
        
        if (unpublishedCards.length === 0) {
          // All cards published - find next batch with unpublished cards
          findNextUnapprovedBatch()
        } else {
          // Move to the first unpublished card
          setActiveId(unpublishedCards[0].id)
          setActiveType('card')
        }
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  const findNextUnapprovedBatch = async () => {
    try {
      // Fetch library to find batches with unpublished cards
      const response = await fetch(`/api/editorial/library?surgeryId=${surgeryId}&status=DRAFT`, {
        cache: 'no-store',
      })
      const payload = await response.json().catch(() => ({}))
      if (response.ok && payload.cards && payload.cards.length > 0) {
        // Find first batch ID that's not the current batch
        const nextBatch = payload.cards.find((card: Card) => card.batchId !== batchId)
        if (nextBatch) {
          setNextBatchId(nextBatch.batchId)
        }
      }
      setShowCompletionModal(true)
    } catch (err) {
      // If we can't find next batch, still show modal
      setShowCompletionModal(true)
    }
  }

  const handleDelete = async () => {
    if (!cardForm.id) return
    if (!window.confirm('Delete this card permanently? This cannot be undone.')) {
      return
    }
    setSaving(true)
    setError(null)
    try {
      const response = await fetch(`/api/editorial/cards/${cardForm.id}?surgeryId=${surgeryId}`, {
        method: 'DELETE',
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(payload?.error?.message || 'Failed to delete card')
      }
      // Navigate back or reload batch
      await loadBatch()
      // Clear active card if it was deleted
      const remainingCards = cards.filter((c) => c.id !== cardForm.id)
      if (remainingCards.length > 0) {
        setActiveId(remainingCards[0].id)
        setActiveType('card')
      } else {
        setActiveId(null)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  const generateVariations = async () => {
    if (!cardForm.id) return
    const rawCount = window.prompt('How many variations?', '3')
    const variationsCount = Number(rawCount ?? 3)
    if (Number.isNaN(variationsCount)) return
    setSaving(true)
    setError(null)
    try {
      const response = await fetch('/api/editorial/variations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ surgeryId, cardId: cardForm.id, variationsCount }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(payload?.error?.message || 'Unable to generate variations')
      }
      await loadBatch()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  const regenerateSection = async () => {
    if (!cardForm.id) return
    setSaving(true)
    setError(null)
    try {
      const response = await fetch('/api/editorial/regenerate-section', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          surgeryId,
          cardId: cardForm.id,
          section: regenSection,
          userInstruction: regenNote || undefined,
        }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(payload?.error?.message || 'Unable to regenerate section')
      }
      setRegenNote('')
      await loadBatch()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-6" aria-live="polite">
        <p className="text-slate-600">Loading batch…</p>
      </div>
    )
  }

  if (!batch) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <p className="text-slate-600">Batch not found.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <h1 className="text-2xl font-bold text-nhs-dark-blue">Generation batch</h1>
        <p className="mt-2 text-sm text-slate-600">{batch.promptText}</p>
        <p className="mt-1 text-xs text-slate-500">
          Role: {batch.targetRole} • Model: {batch.modelUsed || 'AI'} • Created{' '}
          {new Date(batch.createdAt).toLocaleString()}
        </p>
        {error && (
          <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">
            {error}
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[300px,1fr]">
        <aside className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-600">Drafts</h2>
          <div className="space-y-2">
            {cards.map((card) => (
              <button
                key={card.id}
                type="button"
                onClick={() => {
                  setActiveId(card.id)
                  setActiveType('card')
                }}
                className={`w-full rounded-lg border px-3 py-2 text-left text-sm ${
                  activeId === card.id && activeType === 'card'
                    ? 'border-nhs-blue bg-nhs-light-blue'
                    : 'border-slate-200 bg-white'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-slate-700">{card.title}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] ${riskBadgeStyles[card.riskLevel] || 'bg-slate-100 text-slate-600'}`}>
                    {card.riskLevel}
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  {card.status} {card.needsSourcing ? '• Needs sourcing' : ''}
                </p>
              </button>
            ))}
          </div>
          {quiz && (
            <button
              type="button"
              onClick={() => {
                setActiveId(quiz.id)
                setActiveType('quiz')
              }}
              className={`w-full rounded-lg border px-3 py-2 text-left text-sm ${
                activeType === 'quiz' ? 'border-nhs-blue bg-nhs-light-blue' : 'border-slate-200 bg-white'
              }`}
            >
              <span className="font-semibold text-slate-700">Quiz</span>
              <p className="text-xs text-slate-500">{quiz.questions.length} questions</p>
            </button>
          )}
        </aside>

        <section className="flex flex-col gap-6">
          {activeType === 'quiz' && quiz ? (
            <div className="rounded-lg border border-slate-200 bg-white p-6">
              <h2 className="text-lg font-semibold text-nhs-dark-blue">Quiz</h2>
              <p className="text-sm text-slate-600">{quiz.title}</p>
              <ol className="mt-3 space-y-3 text-sm text-slate-700">
                {quiz.questions.map((question, index) => (
                  <li key={`${quiz.id}-${index}`} className="rounded-md border border-slate-200 p-3">
                    <p className="font-semibold">{question.question}</p>
                    <ul className="mt-2 space-y-1 text-xs text-slate-500">
                      {question.options.map((option, optionIndex) => (
                        <li key={`${quiz.id}-${index}-${optionIndex}`}>
                          {optionIndex + 1}. {option}
                        </li>
                      ))}
                    </ul>
                    <p className="mt-2 text-xs text-slate-500">Explanation: {question.explanation}</p>
                  </li>
                ))}
              </ol>
            </div>
          ) : activeCard ? (
            <>
              <div className="flex flex-col items-center">
                <PhoneFrame
                  alignActions={false}
                  actions={
                    <div className="flex flex-col items-center gap-3">
                      <div className="flex flex-wrap justify-center gap-2">
                        {cardForm.status !== 'PUBLISHED' && (
                          <button
                            type="button"
                            onClick={handleApproveAndPublish}
                            disabled={saving || !canApprove}
                            className={`rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
                              canApprove
                                ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                            } disabled:cursor-not-allowed disabled:opacity-70`}
                            title={canApprove ? 'Approve and publish this card' : 'Complete all checklist items first'}
                          >
                            {saving ? 'Processing…' : 'Approve and publish'}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={handleDelete}
                          disabled={saving}
                          className="rounded-xl border border-red-600 bg-white px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-70"
                          title="Delete this card permanently"
                        >
                          Delete
                        </button>
                      </div>
                      {cardForm.status !== 'PUBLISHED' && (
                        <label className="flex items-center gap-2 cursor-pointer text-sm">
                          <input
                            type="checkbox"
                            checked={!cardForm.needsSourcing}
                            onChange={(event) => setCardForm((prev) => ({ ...prev, needsSourcing: !event.target.checked }))}
                            className="accent-emerald-600"
                          />
                          <span className={readinessChecks.sourcesVerified ? 'text-slate-700' : 'text-slate-600 font-medium'}>
                            Sources verified and accurate
                          </span>
                        </label>
                      )}
                    </div>
                  }
                >
                  <LearningCardPreview
                    title={cardForm.title}
                    headerText={`${cardForm.targetRole} · ${cardForm.riskLevel} risk`}
                    contentBlocks={cardForm.blocks.map((b) => {
                      if (b.type === 'steps' || b.type === 'do-dont') {
                        return {
                          type: b.type,
                          items: b.itemsText.split('\n').filter(Boolean),
                        } as { type: 'steps' | 'do-dont'; items: string[] }
                      }
                      if (b.type === 'text' || b.type === 'callout') {
                        return {
                          type: b.type,
                          text: b.text,
                        } as { type: 'text' | 'callout'; text: string }
                      }
                      return null
                    }).filter((b): b is { type: 'steps' | 'do-dont'; items: string[] } | { type: 'text' | 'callout'; text: string } => b !== null)}
                    interactions={cardForm.interactions.map((i) => ({
                      question: i.question,
                      options: i.optionsText.split('\n').filter(Boolean),
                      correctIndex: i.correctIndex,
                    }))}
                    sources={cardForm.sources.filter((s) => s.title?.trim()).map((s) => ({
                      title: s.title,
                      url: s.url || null,
                      publisher: s.publisher,
                    }))}
                    reviewByDate={cardForm.reviewByDate || null}
                  />
                </PhoneFrame>
              </div>

              {cardForm.riskLevel === 'HIGH' && (
                <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
                  Clinician approval required before publishing.
                </div>
              )}

              <div className="rounded-lg border border-slate-200 bg-white p-6">
                <h3 className="text-lg font-semibold text-nhs-dark-blue">Edit card</h3>
                <label className="mt-4 block text-sm">
                  Title
                  <input
                    type="text"
                    value={cardForm.title}
                    onChange={(event) => setCardForm((prev) => ({ ...prev, title: event.target.value }))}
                    className="mt-2 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                  />
                </label>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="block text-sm">
                  Target role
                  <select
                    value={cardForm.targetRole}
                    onChange={(event) => setCardForm((prev) => ({ ...prev, targetRole: event.target.value }))}
                    className="mt-2 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                  >
                    <option value="ADMIN">Admin / Reception</option>
                    <option value="GP">GP / Prescriber</option>
                    <option value="NURSE">Nurse / HCA</option>
                  </select>
                </label>
                <label className="block text-sm">
                  Estimated time (minutes)
                  <input
                    type="number"
                    min={3}
                    max={10}
                    value={cardForm.estimatedTimeMinutes}
                    onChange={(event) =>
                      setCardForm((prev) => ({ ...prev, estimatedTimeMinutes: Number(event.target.value) }))
                    }
                    className="mt-2 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                  />
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="block text-sm">
                  Review by date
                  <input
                    type="date"
                    value={cardForm.reviewByDate}
                    onChange={(event) => setCardForm((prev) => ({ ...prev, reviewByDate: event.target.value }))}
                    className="mt-2 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                  />
                </label>
                <label className="block text-sm">
                  Tags (comma separated)
                  <input
                    type="text"
                    value={cardForm.tagsText}
                    onChange={(event) => setCardForm((prev) => ({ ...prev, tagsText: event.target.value }))}
                    className="mt-2 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                  />
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="block text-sm">
                  Risk level
                  <select
                    value={cardForm.riskLevel}
                    onChange={(event) => setCardForm((prev) => ({ ...prev, riskLevel: event.target.value }))}
                    className="mt-2 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                  >
                    <option value="LOW">Low</option>
                    <option value="MED">Medium</option>
                    <option value="HIGH">High</option>
                  </select>
                </label>
              </div>

              <div className="rounded-md border border-slate-200 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-slate-700">Content blocks</p>
                  <button
                    type="button"
                    onClick={() =>
                      setCardForm((prev) => ({
                        ...prev,
                        blocks: [...prev.blocks, { type: 'text', text: '' }],
                      }))
                    }
                    className="text-xs text-nhs-blue hover:underline"
                  >
                    Add block
                  </button>
                </div>
                <div className="mt-3 space-y-3">
                  {cardForm.blocks.map((block, index) => (
                    <div key={`block-${index}`} className="rounded-md border border-slate-200 p-3 text-sm">
                      <div className="flex items-center justify-between">
                        <select
                          value={block.type}
                          onChange={(event) => {
                            const nextType = event.target.value as BlockState['type']
                            setCardForm((prev) => ({
                              ...prev,
                              blocks: prev.blocks.map((item, idx) =>
                                idx === index
                                  ? nextType === 'steps' || nextType === 'do-dont'
                                    ? { type: nextType, itemsText: '' }
                                    : { type: nextType, text: '' }
                                  : item
                              ),
                            }))
                          }}
                          className="rounded-md border border-slate-200 px-2 py-1 text-xs"
                        >
                          <option value="text">Text</option>
                          <option value="callout">Callout</option>
                          <option value="steps">Steps</option>
                          <option value="do-dont">Do / Don’t</option>
                        </select>
                        <button
                          type="button"
                          onClick={() =>
                            setCardForm((prev) => ({
                              ...prev,
                              blocks: prev.blocks.filter((_, idx) => idx !== index),
                            }))
                          }
                          className="text-xs text-red-600 hover:underline"
                        >
                          Remove
                        </button>
                      </div>
                      {block.type === 'steps' || block.type === 'do-dont' ? (
                        <textarea
                          rows={3}
                          value={block.itemsText}
                          onChange={(event) =>
                            setCardForm((prev) => ({
                              ...prev,
                              blocks: prev.blocks.map((item, idx) =>
                                idx === index ? { ...item, itemsText: event.target.value } : item
                              ),
                            }))
                          }
                          className="mt-2 w-full rounded-md border border-slate-200 px-2 py-1 text-xs"
                          placeholder="One item per line"
                        />
                      ) : (
                        <textarea
                          rows={2}
                          value={block.text}
                          onChange={(event) =>
                            setCardForm((prev) => ({
                              ...prev,
                              blocks: prev.blocks.map((item, idx) =>
                                idx === index ? { ...item, text: event.target.value } : item
                              ),
                            }))
                          }
                          className="mt-2 w-full rounded-md border border-slate-200 px-2 py-1 text-xs"
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-md border border-slate-200 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-slate-700">Interactions</p>
                  <button
                    type="button"
                    onClick={() =>
                      setCardForm((prev) => ({
                        ...prev,
                        interactions: [
                          ...prev.interactions,
                          { type: 'mcq', question: '', optionsText: '', correctIndex: 0, explanation: '' },
                        ],
                      }))
                    }
                    className="text-xs text-nhs-blue hover:underline"
                  >
                    Add interaction
                  </button>
                </div>
                <div className="mt-3 space-y-3">
                  {cardForm.interactions.map((interaction, index) => (
                    <div key={`interaction-${index}`} className="rounded-md border border-slate-200 p-3 text-sm">
                      <div className="flex items-center justify-between">
                        <select
                          value={interaction.type}
                          onChange={(event) =>
                            setCardForm((prev) => ({
                              ...prev,
                              interactions: prev.interactions.map((item, idx) =>
                                idx === index ? { ...item, type: event.target.value as InteractionState['type'] } : item
                              ),
                            }))
                          }
                          className="rounded-md border border-slate-200 px-2 py-1 text-xs"
                        >
                          <option value="mcq">MCQ</option>
                          <option value="true_false">True / False</option>
                          <option value="choose_action">Choose action</option>
                        </select>
                        <button
                          type="button"
                          onClick={() =>
                            setCardForm((prev) => ({
                              ...prev,
                              interactions: prev.interactions.filter((_, idx) => idx !== index),
                            }))
                          }
                          className="text-xs text-red-600 hover:underline"
                        >
                          Remove
                        </button>
                      </div>
                      <input
                        type="text"
                        value={interaction.question}
                        onChange={(event) =>
                          setCardForm((prev) => ({
                            ...prev,
                            interactions: prev.interactions.map((item, idx) =>
                              idx === index ? { ...item, question: event.target.value } : item
                            ),
                          }))
                        }
                        className="mt-2 w-full rounded-md border border-slate-200 px-2 py-1 text-xs"
                        placeholder="Question"
                      />
                      <textarea
                        rows={3}
                        value={interaction.optionsText}
                        onChange={(event) =>
                          setCardForm((prev) => ({
                            ...prev,
                            interactions: prev.interactions.map((item, idx) =>
                              idx === index ? { ...item, optionsText: event.target.value } : item
                            ),
                          }))
                        }
                        className="mt-2 w-full rounded-md border border-slate-200 px-2 py-1 text-xs"
                        placeholder="Options (one per line)"
                      />
                      <div className="mt-2 grid gap-2 md:grid-cols-2">
                        <input
                          type="number"
                          min={0}
                          value={interaction.correctIndex}
                          onChange={(event) =>
                            setCardForm((prev) => ({
                              ...prev,
                              interactions: prev.interactions.map((item, idx) =>
                                idx === index ? { ...item, correctIndex: Number(event.target.value) } : item
                              ),
                            }))
                          }
                          className="rounded-md border border-slate-200 px-2 py-1 text-xs"
                          placeholder="Correct index"
                        />
                        <input
                          type="text"
                          value={interaction.explanation}
                          onChange={(event) =>
                            setCardForm((prev) => ({
                              ...prev,
                              interactions: prev.interactions.map((item, idx) =>
                                idx === index ? { ...item, explanation: event.target.value } : item
                              ),
                            }))
                          }
                          className="rounded-md border border-slate-200 px-2 py-1 text-xs"
                          placeholder="Explanation"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-md border border-slate-200 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-slate-700">Slot language</p>
                  <label className="flex items-center gap-2 text-xs text-slate-600">
                    <input
                      type="checkbox"
                      checked={cardForm.slotRelevant}
                      onChange={(event) => setCardForm((prev) => ({ ...prev, slotRelevant: event.target.checked }))}
                      className="accent-nhs-blue"
                    />
                    Relevant
                  </label>
                </div>
                {cardForm.slotRelevant && (
                  <div className="mt-3 space-y-2">
                    {cardForm.slotGuidance.map((item, index) => (
                      <div key={`slot-${index}`} className="flex gap-2">
                        <select
                          value={item.slot}
                          onChange={(event) =>
                            setCardForm((prev) => ({
                              ...prev,
                              slotGuidance: prev.slotGuidance.map((row, idx) =>
                                idx === index ? { ...row, slot: event.target.value } : row
                              ),
                            }))
                          }
                          className="rounded-md border border-slate-200 px-2 py-1 text-xs"
                        >
                          <option value="Red">Red</option>
                          <option value="Orange">Orange</option>
                          <option value="Pink-Purple">Pink-Purple</option>
                          <option value="Green">Green</option>
                        </select>
                        <input
                          type="text"
                          value={item.rule}
                          onChange={(event) =>
                            setCardForm((prev) => ({
                              ...prev,
                              slotGuidance: prev.slotGuidance.map((row, idx) =>
                                idx === index ? { ...row, rule: event.target.value } : row
                              ),
                            }))
                          }
                          className="flex-1 rounded-md border border-slate-200 px-2 py-1 text-xs"
                          placeholder="Guidance"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setCardForm((prev) => ({
                              ...prev,
                              slotGuidance: prev.slotGuidance.filter((_, idx) => idx !== index),
                            }))
                          }
                          className="text-xs text-red-600 hover:underline"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() =>
                        setCardForm((prev) => ({
                          ...prev,
                          slotGuidance: [...prev.slotGuidance, { slot: 'Red', rule: '' }],
                        }))
                      }
                      className="text-xs text-nhs-blue hover:underline"
                    >
                      Add slot rule
                    </button>
                  </div>
                )}
              </div>

              <label className="block text-sm">
                Safety netting (one per line)
                <textarea
                  rows={3}
                  value={cardForm.safetyNettingText}
                  onChange={(event) => setCardForm((prev) => ({ ...prev, safetyNettingText: event.target.value }))}
                  className="mt-2 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                />
              </label>

              <div className="rounded-md border border-slate-200 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-700">Sources</p>
                    <p className="text-xs text-slate-500">At least one source required. URL optional for internal sources.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setCardForm((prev) => ({
                        ...prev,
                        sources: [...prev.sources, { title: '', url: '', publisher: '', accessedDate: '' }],
                      }))
                    }
                    className="text-xs text-nhs-blue hover:underline"
                  >
                    Add source
                  </button>
                </div>
                <div className="mt-3 space-y-3">
                  {cardForm.sources.length === 0 && (
                    <p className="text-xs text-slate-500 italic">No sources added yet. Click "Add source" above.</p>
                  )}
                  {cardForm.sources.map((source, index) => (
                    <div key={`source-${index}`} className="rounded-md border border-slate-200 p-3 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">Source {index + 1}</span>
                        <button
                          type="button"
                          onClick={() =>
                            setCardForm((prev) => ({
                              ...prev,
                              sources: prev.sources.filter((_, idx) => idx !== index),
                            }))
                          }
                          className="text-red-600 hover:underline"
                        >
                          Remove
                        </button>
                      </div>
                      <div className="mt-2 space-y-2">
                        <label className="block">
                          <span className="text-slate-600">Title <span className="text-red-500">*</span></span>
                          <input
                            type="text"
                            value={source.title}
                            onChange={(event) =>
                              setCardForm((prev) => ({
                                ...prev,
                                sources: prev.sources.map((item, idx) =>
                                  idx === index ? { ...item, title: event.target.value } : item
                                ),
                              }))
                            }
                            className="mt-1 w-full rounded-md border border-slate-200 px-2 py-1 text-xs"
                            placeholder="e.g. NHS website, NICE guidelines, Signposting Toolkit"
                          />
                        </label>
                        <label className="block">
                          <span className="text-slate-600">URL <span className="text-slate-400">(optional)</span></span>
                          <input
                            type="text"
                            value={source.url || ''}
                            onChange={(event) =>
                              setCardForm((prev) => ({
                                ...prev,
                                sources: prev.sources.map((item, idx) =>
                                  idx === index ? { ...item, url: event.target.value } : item
                                ),
                              }))
                            }
                            className="mt-1 w-full rounded-md border border-slate-200 px-2 py-1 text-xs"
                            placeholder="https://... (leave blank for internal sources)"
                          />
                        </label>
                        <label className="block">
                          <span className="text-slate-600">Publisher <span className="text-slate-400">(optional)</span></span>
                          <input
                            type="text"
                            value={source.publisher || ''}
                            onChange={(event) =>
                              setCardForm((prev) => ({
                                ...prev,
                                sources: prev.sources.map((item, idx) =>
                                  idx === index ? { ...item, publisher: event.target.value } : item
                                ),
                              }))
                            }
                            className="mt-1 w-full rounded-md border border-slate-200 px-2 py-1 text-xs"
                            placeholder="e.g. NHS, NICE"
                          />
                        </label>
                        <label className="block">
                          <span className="text-slate-600">Accessed date <span className="text-slate-400">(optional)</span></span>
                          <input
                            type="text"
                            value={source.accessedDate || ''}
                            onChange={(event) =>
                              setCardForm((prev) => ({
                                ...prev,
                                sources: prev.sources.map((item, idx) =>
                                  idx === index ? { ...item, accessedDate: event.target.value } : item
                                ),
                              }))
                            }
                            className="mt-1 w-full rounded-md border border-slate-200 px-2 py-1 text-xs"
                            placeholder="e.g. January 2026"
                          />
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Readiness Checklist */}
              <div className={`rounded-md border p-4 ${canApprove ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-slate-50'}`}>
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-slate-700">
                    {canApprove ? '✓ Ready for approval' : 'Checklist for approval'}
                  </p>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    cardForm.status === 'PUBLISHED' ? 'bg-emerald-100 text-emerald-700' :
                    cardForm.status === 'APPROVED' ? 'bg-blue-100 text-blue-700' :
                    'bg-slate-100 text-slate-600'
                  }`}>
                    {cardForm.status}
                  </span>
                </div>
                <div className="mt-3 space-y-2 text-sm">
                  <div className={`flex items-center gap-2 ${readinessChecks.hasContentBlocks ? 'text-emerald-700' : 'text-slate-500'}`}>
                    <span>{readinessChecks.hasContentBlocks ? '✓' : '○'}</span>
                    <span>Content blocks added</span>
                  </div>
                  <div className={`flex items-center gap-2 ${readinessChecks.hasInteractions ? 'text-emerald-700' : 'text-slate-500'}`}>
                    <span>{readinessChecks.hasInteractions ? '✓' : '○'}</span>
                    <span>At least one question/interaction</span>
                  </div>
                  <div className={`flex items-center gap-2 ${readinessChecks.hasSafetyNetting ? 'text-emerald-700' : 'text-slate-500'}`}>
                    <span>{readinessChecks.hasSafetyNetting ? '✓' : '○'}</span>
                    <span>Safety netting guidance</span>
                  </div>
                  <div className={`flex items-center gap-2 ${readinessChecks.hasSources ? 'text-emerald-700' : 'text-slate-500'}`}>
                    <span>{readinessChecks.hasSources ? '✓' : '○'}</span>
                    <span>At least one source</span>
                  </div>
                  <div className={`flex items-center gap-2 ${readinessChecks.sourcesVerified ? 'text-emerald-700' : 'text-amber-600'}`}>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!cardForm.needsSourcing}
                        onChange={(event) => setCardForm((prev) => ({ ...prev, needsSourcing: !event.target.checked }))}
                        className="accent-emerald-600"
                      />
                      <span className={readinessChecks.sourcesVerified ? '' : 'font-medium'}>
                        Sources verified and accurate
                      </span>
                    </label>
                  </div>
                  <div className={`flex items-center gap-2 ${readinessChecks.hasReviewDate ? 'text-emerald-700' : 'text-slate-500'}`}>
                    <span>{readinessChecks.hasReviewDate ? '✓' : '○'}</span>
                    <span>Review-by date set</span>
                  </div>
                  {readinessChecks.isHighRisk && (
                    <div className="flex items-center gap-2 text-slate-500">
                      <span>ℹ</span>
                      <span className="text-xs">
                        HIGH risk card — clinician approval will be set automatically when you approve
                        {readinessChecks.clinicianApproved && activeCard?.clinicianApprovedBy && (
                          <span className="text-slate-400">
                            {' '}(approved by {activeCard.clinicianApprovedBy.name || activeCard.clinicianApprovedBy.email})
                          </span>
                        )}
                      </span>
                    </div>
                  )}
                </div>
                {!canApprove && (
                  <p className="mt-3 text-xs text-slate-500">
                    Complete all required items above, then click <strong>Approve and publish</strong>.
                  </p>
                )}
              </div>

              <div className="mt-6 rounded-md border border-slate-200 p-4">
                <p className="text-sm font-semibold text-slate-700">AI tools</p>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={generateVariations}
                    disabled={saving}
                    className="rounded-md border border-slate-200 px-3 py-2 text-xs text-slate-600 hover:border-nhs-blue"
                  >
                    Generate variations
                  </button>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                    <select
                      value={regenSection}
                      onChange={(event) => setRegenSection(event.target.value)}
                      className="rounded-md border border-slate-200 px-2 py-1 text-xs"
                    >
                      {sectionOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <input
                      type="text"
                      value={regenNote}
                      onChange={(event) => setRegenNote(event.target.value)}
                      className="rounded-md border border-slate-200 px-2 py-1 text-xs"
                      placeholder="Optional note"
                    />
                    <button
                      type="button"
                      onClick={regenerateSection}
                      disabled={saving}
                      className="rounded-md border border-slate-200 px-3 py-1 text-xs text-slate-600 hover:border-nhs-blue"
                    >
                      Regenerate section
                    </button>
                  </div>
                </div>
              </div>
            </div>
            </>
          ) : (
            <p className="text-sm text-slate-600">Select a card to edit.</p>
          )}
        </section>
      </div>

      {showCompletionModal && (
        <Modal
          title="All cards published!"
          onClose={() => setShowCompletionModal(false)}
          widthClassName="max-w-md"
        >
          <div className="space-y-4">
            <p className="text-slate-700">
              All cards in this batch have been published. What would you like to do next?
            </p>
            <div className="flex flex-col gap-3">
              {nextBatchId && (
                <button
                  type="button"
                  onClick={() => {
                    setShowCompletionModal(false)
                    router.push(`/editorial/batches/${nextBatchId}?surgery=${surgeryId}`)
                  }}
                  className="w-full rounded-xl bg-nhs-blue px-4 py-3 text-sm font-semibold text-white hover:bg-nhs-dark-blue"
                >
                  Review next unapproved batch
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setShowCompletionModal(false)
                  router.push(`/editorial?surgery=${surgeryId}`)
                }}
                className="w-full rounded-xl border border-nhs-blue bg-white px-4 py-3 text-sm font-semibold text-nhs-blue hover:bg-nhs-blue hover:text-white"
              >
                Create a new batch
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowCompletionModal(false)
                  router.push(`/daily-dose/session?surgery=${surgeryId}`)
                }}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Start a learning session
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
