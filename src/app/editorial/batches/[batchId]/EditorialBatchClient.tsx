'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

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
  clinicianApprovedBy?: string | null
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
    clinicianApproved: false,
    clinicianApprovedBy: '',
    status: 'DRAFT',
  })

  const loadBatch = useCallback(() => {
    setLoading(true)
    setError(null)
    fetch(`/api/editorial/batches/${batchId}?surgeryId=${surgeryId}`, { cache: 'no-store' })
      .then(async (res) => {
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
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Something went wrong'))
      .finally(() => setLoading(false))
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
      clinicianApproved: Boolean(activeCard.clinicianApproved),
      clinicianApprovedBy: activeCard.clinicianApprovedBy ?? '',
      status: activeCard.status,
    })
  }, [activeCard])

  const canApprove = useMemo(() => {
    const hasSources = cardForm.sources.filter((source) => source.title && source.url).length > 0
    const hasInteractions = cardForm.interactions.length > 0
    const hasReviewDate = Boolean(cardForm.reviewByDate)
    return hasSources && hasInteractions && hasReviewDate && !cardForm.needsSourcing
  }, [cardForm])

  const canPublish = useMemo(() => {
    const baseReady = cardForm.status === 'APPROVED' && canApprove
    if (cardForm.riskLevel === 'HIGH') {
      return baseReady && cardForm.clinicianApproved && Boolean(cardForm.clinicianApprovedBy)
    }
    return baseReady
  }, [cardForm, canApprove])

  const saveDraft = async () => {
    if (!cardForm.id) return
    setSaving(true)
    setError(null)
    try {
      const payload = {
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
        sources: cardForm.sources.filter((source) => source.title && source.url),
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
        clinicianApproved: cardForm.clinicianApproved,
        clinicianApprovedBy: cardForm.clinicianApprovedBy || undefined,
      }

      const response = await fetch(`/api/editorial/cards/${cardForm.id}?surgeryId=${surgeryId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const resPayload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(resPayload?.error?.message || 'Unable to save card')
      }
      await loadBatch()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  const approveCard = async () => {
    if (!cardForm.id) return
    setSaving(true)
    setError(null)
    try {
      const response = await fetch(`/api/editorial/cards/${cardForm.id}/approve?surgeryId=${surgeryId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ surgeryId }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(payload?.error?.message || 'Unable to approve card')
      }
      await loadBatch()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  const publishCard = async () => {
    if (!cardForm.id) return
    setSaving(true)
    setError(null)
    try {
      const response = await fetch(`/api/editorial/cards/${cardForm.id}/publish?surgeryId=${surgeryId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ surgeryId }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(payload?.error?.message || 'Unable to publish card')
      }
      await loadBatch()
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

        <section className="rounded-lg border border-slate-200 bg-white p-6">
          {activeType === 'quiz' && quiz ? (
            <div className="space-y-3">
              <h2 className="text-lg font-semibold text-nhs-dark-blue">Quiz</h2>
              <p className="text-sm text-slate-600">{quiz.title}</p>
              <ol className="space-y-3 text-sm text-slate-700">
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
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-semibold text-nhs-dark-blue">{activeCard.title}</h2>
                <span className={`rounded-full px-3 py-1 text-xs ${riskBadgeStyles[cardForm.riskLevel] || 'bg-slate-100 text-slate-600'}`}>
                  {cardForm.riskLevel} risk
                </span>
              </div>

              {cardForm.riskLevel === 'HIGH' && (
                <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
                  Clinician approval required before publishing.
                </div>
              )}

              <label className="block text-sm">
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
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={cardForm.needsSourcing}
                    onChange={(event) => setCardForm((prev) => ({ ...prev, needsSourcing: event.target.checked }))}
                    className="accent-nhs-blue"
                  />
                  Needs sourcing
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
                  <p className="text-sm font-semibold text-slate-700">Sources</p>
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
                  {cardForm.sources.map((source, index) => (
                    <div key={`source-${index}`} className="rounded-md border border-slate-200 p-3 text-xs">
                      <div className="flex items-center justify-between">
                        <span>Source {index + 1}</span>
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
                          className="w-full rounded-md border border-slate-200 px-2 py-1 text-xs"
                          placeholder="Title"
                        />
                        <input
                          type="url"
                          value={source.url}
                          onChange={(event) =>
                            setCardForm((prev) => ({
                              ...prev,
                              sources: prev.sources.map((item, idx) =>
                                idx === index ? { ...item, url: event.target.value } : item
                              ),
                            }))
                          }
                          className="w-full rounded-md border border-slate-200 px-2 py-1 text-xs"
                          placeholder="URL"
                        />
                        <input
                          type="text"
                          value={source.publisher}
                          onChange={(event) =>
                            setCardForm((prev) => ({
                              ...prev,
                              sources: prev.sources.map((item, idx) =>
                                idx === index ? { ...item, publisher: event.target.value } : item
                              ),
                            }))
                          }
                          className="w-full rounded-md border border-slate-200 px-2 py-1 text-xs"
                          placeholder="Publisher"
                        />
                        <input
                          type="text"
                          value={source.accessedDate}
                          onChange={(event) =>
                            setCardForm((prev) => ({
                              ...prev,
                              sources: prev.sources.map((item, idx) =>
                                idx === index ? { ...item, accessedDate: event.target.value } : item
                              ),
                            }))
                          }
                          className="w-full rounded-md border border-slate-200 px-2 py-1 text-xs"
                          placeholder="Accessed date"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {cardForm.riskLevel === 'HIGH' && (
                <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm">
                  <label className="flex items-center gap-2 text-sm text-amber-800">
                    <input
                      type="checkbox"
                      checked={cardForm.clinicianApproved}
                      onChange={(event) =>
                        setCardForm((prev) => ({ ...prev, clinicianApproved: event.target.checked }))
                      }
                      className="accent-nhs-blue"
                    />
                    Clinician approved
                  </label>
                  <input
                    type="text"
                    value={cardForm.clinicianApprovedBy}
                    onChange={(event) =>
                      setCardForm((prev) => ({ ...prev, clinicianApprovedBy: event.target.value }))
                    }
                    className="mt-2 w-full rounded-md border border-amber-200 px-3 py-2 text-sm"
                    placeholder="Clinician name or identifier"
                  />
                </div>
              )}

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={saveDraft}
                  disabled={saving}
                  className="rounded-md bg-nhs-blue px-4 py-2 text-sm font-semibold text-white hover:bg-nhs-dark-blue disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {saving ? 'Saving…' : 'Save draft'}
                </button>
                <button
                  type="button"
                  onClick={approveCard}
                  disabled={saving || !canApprove}
                  className="rounded-md border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:border-nhs-blue disabled:cursor-not-allowed disabled:opacity-70"
                >
                  Approve
                </button>
                <button
                  type="button"
                  onClick={publishCard}
                  disabled={saving || !canPublish}
                  className="rounded-md border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:border-nhs-blue disabled:cursor-not-allowed disabled:opacity-70"
                >
                  Publish
                </button>
              </div>

              <div className="rounded-md border border-slate-200 p-4">
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
          ) : (
            <p className="text-sm text-slate-600">Select a card to edit.</p>
          )}
        </section>
      </div>
    </div>
  )
}
