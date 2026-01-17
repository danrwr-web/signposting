'use client'

import { useEffect, useMemo, useState } from 'react'

type Topic = {
  id: string
  name: string
  roleScope: string[]
  ordering: number
  isActive: boolean
}

type Card = {
  id: string
  title: string
  status: string
  version: number
  reviewByDate?: string | null
  roleScope: string[]
  topicId: string
  topic?: { name: string }
  contentBlocks: Array<Record<string, any>>
  sources: Array<Record<string, any>>
  tags?: string[]
}

type Flag = {
  id: string
  reason: string
  status: string
  createdAt: string
  card: { title: string }
  user: { name: string | null; email: string }
}

type BlockState =
  | { type: 'paragraph'; text: string }
  | { type: 'reveal'; text: string }
  | {
      type: 'question'
      questionType: 'MCQ' | 'TRUE_FALSE' | 'SCENARIO'
      prompt: string
      optionsText: string
      correctAnswer: string
      rationale: string
      difficulty: number
    }

type SourceState = {
  title: string
  org: string
  url: string
  publishedDate?: string
}

const roleOptions = [
  { value: 'GP', label: 'GP / Prescriber' },
  { value: 'NURSE', label: 'Nurse / HCA' },
  { value: 'ADMIN', label: 'Admin / Reception' },
]

export default function DailyDoseAdminClient({ surgeryId }: { surgeryId: string }) {
  const [topics, setTopics] = useState<Topic[]>([])
  const [cards, setCards] = useState<Card[]>([])
  const [flags, setFlags] = useState<Flag[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [topicForm, setTopicForm] = useState({
    name: '',
    roleScope: ['ADMIN'],
    ordering: 0,
    isActive: true,
  })

  const [cardForm, setCardForm] = useState({
    id: '',
    title: '',
    topicId: '',
    roleScope: ['ADMIN'],
    blocks: [] as BlockState[],
    sources: [] as SourceState[],
    reviewByDate: '',
    tagsText: '',
    status: 'DRAFT',
  })

  const loadData = () => {
    setLoading(true)
    setError(null)
    Promise.all([
      fetch(`/api/daily-dose/admin/topics?surgeryId=${surgeryId}`, { cache: 'no-store' }),
      fetch(`/api/daily-dose/admin/cards?surgeryId=${surgeryId}`, { cache: 'no-store' }),
      fetch(`/api/daily-dose/admin/flags?surgeryId=${surgeryId}`, { cache: 'no-store' }),
    ])
      .then(async ([topicsRes, cardsRes, flagsRes]) => {
        if (!topicsRes.ok || !cardsRes.ok) {
          throw new Error('Unable to load Daily Dose editorial data')
        }
        const topicsJson = (await topicsRes.json()) as { topics: Topic[] }
        const cardsJson = (await cardsRes.json()) as { cards: Card[] }
        const flagsJson = flagsRes.ok ? ((await flagsRes.json()) as { flags: Flag[] }) : { flags: [] }
        setTopics(topicsJson.topics || [])
        setCards(cardsJson.cards || [])
        setFlags(flagsJson.flags || [])
        if (!cardForm.topicId && topicsJson.topics?.length) {
          setCardForm((prev) => ({ ...prev, topicId: topicsJson.topics[0].id }))
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Something went wrong'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [surgeryId])

  const topicRoleScopeText = useMemo(() => topicForm.roleScope.join(', ') || 'None', [topicForm.roleScope])

  const handleTopicSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setError(null)

    try {
      const response = await fetch(`/api/daily-dose/admin/topics?surgeryId=${surgeryId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(topicForm),
      })
      if (!response.ok) {
        throw new Error('Unable to create topic')
      }
      setTopicForm({ name: '', roleScope: ['ADMIN'], ordering: 0, isActive: true })
      loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  const resetCardForm = () => {
    setCardForm({
      id: '',
      title: '',
      topicId: topics[0]?.id ?? '',
      roleScope: ['ADMIN'],
      blocks: [],
      sources: [],
      reviewByDate: '',
      tagsText: '',
      status: 'DRAFT',
    })
  }

  const editCard = (card: Card) => {
    setCardForm({
      id: card.id,
      title: card.title,
      topicId: card.topicId,
      roleScope: card.roleScope ?? [],
      blocks: card.contentBlocks.map((block: any) => {
        if (block.type === 'question') {
          return {
            type: 'question',
            questionType: block.questionType ?? 'MCQ',
            prompt: block.prompt ?? '',
            optionsText: Array.isArray(block.options) ? block.options.join('\n') : '',
            correctAnswer: block.correctAnswer ?? '',
            rationale: block.rationale ?? '',
            difficulty: block.difficulty ?? 2,
          }
        }
        return {
          type: block.type === 'reveal' ? 'reveal' : 'paragraph',
          text: block.text ?? '',
        }
      }),
      sources: card.sources?.map((source) => ({
        title: source.title ?? '',
        org: source.org ?? '',
        url: source.url ?? '',
        publishedDate: source.publishedDate ?? '',
      })),
      reviewByDate: card.reviewByDate ? new Date(card.reviewByDate).toISOString().slice(0, 10) : '',
      tagsText: card.tags?.join(', ') ?? '',
      status: card.status,
    })
  }

  const saveCard = async (event: React.FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setError(null)

    try {
      const payload = {
        title: cardForm.title,
        topicId: cardForm.topicId,
        roleScope: cardForm.roleScope,
        contentBlocks: cardForm.blocks.map((block) => {
          if (block.type === 'question') {
            const options = block.optionsText
              .split('\n')
              .map((option) => option.trim())
              .filter(Boolean)
            return {
              type: 'question',
              questionType: block.questionType,
              prompt: block.prompt,
              options,
              correctAnswer: block.correctAnswer || options[0] || '',
              rationale: block.rationale,
              difficulty: block.difficulty,
            }
          }
          return block
        }),
        sources: cardForm.sources.filter((source) => source.title && source.url),
        reviewByDate: cardForm.reviewByDate || null,
        tags: cardForm.tagsText
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean),
        status: cardForm.status,
      }

      const response = await fetch(
        cardForm.id
          ? `/api/daily-dose/admin/cards/${cardForm.id}?surgeryId=${surgeryId}`
          : `/api/daily-dose/admin/cards?surgeryId=${surgeryId}`,
        {
          method: cardForm.id ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      )

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(payload?.error || 'Unable to save card')
      }

      resetCardForm()
      loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  const publishCard = async (cardId: string) => {
    setSaving(true)
    setError(null)
    try {
      const response = await fetch(
        `/api/daily-dose/admin/cards/${cardId}/publish?surgeryId=${surgeryId}`,
        { method: 'POST' }
      )
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(payload?.error || 'Unable to publish card')
      }
      loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  const retireCard = async (cardId: string) => {
    setSaving(true)
    setError(null)
    try {
      const response = await fetch(`/api/daily-dose/admin/cards/${cardId}?surgeryId=${surgeryId}`, {
        method: 'DELETE',
      })
      if (!response.ok) {
        throw new Error('Unable to retire card')
      }
      loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  const resolveFlag = async (flagId: string) => {
    setSaving(true)
    setError(null)
    try {
      const response = await fetch(`/api/daily-dose/admin/flags/${flagId}/resolve?surgeryId=${surgeryId}`, {
        method: 'POST',
      })
      if (!response.ok) {
        throw new Error('Unable to resolve flag')
      }
      loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-6" aria-live="polite">
        <p className="text-slate-600">Loading editorial workspace…</p>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <h1 className="text-2xl font-bold text-nhs-dark-blue">Daily Dose editorial</h1>
        <p className="mt-2 text-slate-600">Create and publish learning cards with local review controls.</p>
        {error && (
          <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">
            {error}
          </div>
        )}
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-nhs-dark-blue">Topics</h2>
        <div className="mt-3 grid gap-4 md:grid-cols-2">
          <form onSubmit={handleTopicSubmit} className="space-y-3 rounded-md border border-slate-200 p-4">
            <label className="block text-sm">
              Topic name
              <input
                type="text"
                value={topicForm.name}
                onChange={(event) => setTopicForm((prev) => ({ ...prev, name: event.target.value }))}
                className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                required
              />
            </label>
            <div className="text-sm">
              <p className="font-semibold text-slate-600">Role scope</p>
              <p className="text-xs text-slate-500">Current: {topicRoleScopeText}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {roleOptions.map((role) => (
                  <label key={role.value} className="flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={topicForm.roleScope.includes(role.value)}
                      onChange={() =>
                        setTopicForm((prev) => ({
                          ...prev,
                          roleScope: prev.roleScope.includes(role.value)
                            ? prev.roleScope.filter((value) => value !== role.value)
                            : [...prev.roleScope, role.value],
                        }))
                      }
                      className="accent-nhs-blue"
                    />
                    {role.label}
                  </label>
                ))}
              </div>
            </div>
            <label className="block text-sm">
              Ordering
              <input
                type="number"
                value={topicForm.ordering}
                onChange={(event) =>
                  setTopicForm((prev) => ({ ...prev, ordering: Number(event.target.value) }))
                }
                className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                min={0}
              />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={topicForm.isActive}
                onChange={(event) => setTopicForm((prev) => ({ ...prev, isActive: event.target.checked }))}
                className="accent-nhs-blue"
              />
              Active topic
            </label>
            <button
              type="submit"
              disabled={saving}
              className="w-full rounded-md bg-nhs-blue px-3 py-2 text-sm font-semibold text-white hover:bg-nhs-dark-blue disabled:cursor-not-allowed disabled:opacity-70"
            >
              {saving ? 'Saving…' : 'Add topic'}
            </button>
          </form>

          <div className="space-y-2 text-sm text-slate-700">
            {topics.length === 0 && <p className="text-slate-500">No topics created yet.</p>}
            {topics.map((topic) => (
              <div key={topic.id} className="rounded-md border border-slate-200 p-3">
                <p className="font-semibold">{topic.name}</p>
                <p className="text-xs text-slate-500">
                  Roles: {topic.roleScope.join(', ')} • Order {topic.ordering} •{' '}
                  {topic.isActive ? 'Active' : 'Hidden'}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-nhs-dark-blue">Cards</h2>
        <div className="mt-3 grid gap-6 lg:grid-cols-[1.2fr,1fr]">
          <div className="space-y-3 text-sm text-slate-700">
            {cards.length === 0 && <p className="text-slate-500">No cards created yet.</p>}
            {cards.map((card) => (
              <div key={card.id} className="rounded-md border border-slate-200 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold">{card.title}</p>
                    <p className="text-xs text-slate-500">
                      {card.topic?.name ?? 'Topic'} • {card.status} • v{card.version}
                    </p>
                  </div>
                  <div className="flex gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => editCard(card)}
                      className="rounded-md border border-slate-200 px-2 py-1 hover:border-nhs-blue"
                    >
                      Edit
                    </button>
                    {card.status === 'APPROVED' && (
                      <button
                        type="button"
                        onClick={() => publishCard(card.id)}
                        className="rounded-md bg-nhs-blue px-2 py-1 text-white hover:bg-nhs-dark-blue"
                      >
                        Publish
                      </button>
                    )}
                    {card.status !== 'RETIRED' && (
                      <button
                        type="button"
                        onClick={() => retireCard(card.id)}
                        className="rounded-md border border-red-200 px-2 py-1 text-red-700 hover:bg-red-50"
                      >
                        Retire
                      </button>
                    )}
                  </div>
                </div>
                {card.reviewByDate && (
                  <p className="text-xs text-slate-500">Review by {new Date(card.reviewByDate).toLocaleDateString()}</p>
                )}
              </div>
            ))}
          </div>

          <form onSubmit={saveCard} className="space-y-4 rounded-md border border-slate-200 p-4 text-sm">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-nhs-dark-blue">
                {cardForm.id ? 'Edit card' : 'Create card'}
              </h3>
              {cardForm.id && (
                <button type="button" onClick={resetCardForm} className="text-xs text-slate-500 hover:text-nhs-blue">
                  Clear
                </button>
              )}
            </div>

            <label className="block">
              Title
              <input
                type="text"
                value={cardForm.title}
                onChange={(event) => setCardForm((prev) => ({ ...prev, title: event.target.value }))}
                className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                required
              />
            </label>

            {topics.length === 0 ? (
              <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
                Create a topic before adding cards.
              </p>
            ) : (
              <label className="block">
                Topic
                <select
                  value={cardForm.topicId}
                  onChange={(event) => setCardForm((prev) => ({ ...prev, topicId: event.target.value }))}
                  className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                >
                  {topics.map((topic) => (
                    <option key={topic.id} value={topic.id}>
                      {topic.name}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <div>
              <p className="font-semibold text-slate-600">Role scope</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {roleOptions.map((role) => (
                  <label key={role.value} className="flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={cardForm.roleScope.includes(role.value)}
                      onChange={() =>
                        setCardForm((prev) => ({
                          ...prev,
                          roleScope: prev.roleScope.includes(role.value)
                            ? prev.roleScope.filter((value) => value !== role.value)
                            : [...prev.roleScope, role.value],
                        }))
                      }
                      className="accent-nhs-blue"
                    />
                    {role.label}
                  </label>
                ))}
              </div>
            </div>

            <label className="block">
              Status
              <select
                value={cardForm.status}
                onChange={(event) => setCardForm((prev) => ({ ...prev, status: event.target.value }))}
                className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
              >
                <option value="DRAFT">Draft</option>
                <option value="IN_REVIEW">In review</option>
                <option value="APPROVED">Approved</option>
                <option value="RETIRED">Retired</option>
              </select>
            </label>

            <label className="block">
              Review by date
              <input
                type="date"
                value={cardForm.reviewByDate}
                onChange={(event) => setCardForm((prev) => ({ ...prev, reviewByDate: event.target.value }))}
                className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
              />
            </label>

            <label className="block">
              Tags (comma separated)
              <input
                type="text"
                value={cardForm.tagsText}
                onChange={(event) => setCardForm((prev) => ({ ...prev, tagsText: event.target.value }))}
                className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
              />
            </label>

            <div className="rounded-md border border-slate-200 p-3">
              <p className="text-sm font-semibold text-slate-600">Content blocks</p>
              <div className="mt-3 space-y-3">
                {cardForm.blocks.length === 0 && <p className="text-xs text-slate-500">Add your first block.</p>}
                {cardForm.blocks.map((block, index) => (
                  <div key={`${block.type}-${index}`} className="rounded-md border border-slate-200 p-3">
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span>{block.type.toUpperCase()}</span>
                      <button
                        type="button"
                        onClick={() =>
                          setCardForm((prev) => ({
                            ...prev,
                            blocks: prev.blocks.filter((_, blockIndex) => blockIndex !== index),
                          }))
                        }
                        className="text-red-600 hover:underline"
                      >
                        Remove
                      </button>
                    </div>
                    {block.type === 'question' ? (
                      <div className="mt-3 space-y-2 text-sm">
                        <label className="block">
                          Question type
                          <select
                            value={block.questionType}
                            onChange={(event) =>
                              setCardForm((prev) => ({
                                ...prev,
                                blocks: prev.blocks.map((current, blockIndex) =>
                                  blockIndex === index && current.type === 'question'
                                    ? { ...current, questionType: event.target.value as any }
                                    : current
                                ),
                              }))
                            }
                            className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                          >
                            <option value="MCQ">Multiple choice</option>
                            <option value="TRUE_FALSE">True / False</option>
                            <option value="SCENARIO">Scenario</option>
                          </select>
                        </label>
                        <label className="block">
                          Prompt
                          <input
                            type="text"
                            value={block.prompt}
                            onChange={(event) =>
                              setCardForm((prev) => ({
                                ...prev,
                                blocks: prev.blocks.map((current, blockIndex) =>
                                  blockIndex === index && current.type === 'question'
                                    ? { ...current, prompt: event.target.value }
                                    : current
                                ),
                              }))
                            }
                            className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                          />
                        </label>
                        <label className="block">
                          Options (one per line)
                          <textarea
                            rows={3}
                            value={block.optionsText}
                            onChange={(event) =>
                              setCardForm((prev) => ({
                                ...prev,
                                blocks: prev.blocks.map((current, blockIndex) =>
                                  blockIndex === index && current.type === 'question'
                                    ? { ...current, optionsText: event.target.value }
                                    : current
                                ),
                              }))
                            }
                            className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                          />
                        </label>
                        <label className="block">
                          Correct answer (copy from options)
                          <input
                            type="text"
                            value={block.correctAnswer}
                            onChange={(event) =>
                              setCardForm((prev) => ({
                                ...prev,
                                blocks: prev.blocks.map((current, blockIndex) =>
                                  blockIndex === index && current.type === 'question'
                                    ? { ...current, correctAnswer: event.target.value }
                                    : current
                                ),
                              }))
                            }
                            className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                          />
                        </label>
                        <label className="block">
                          Rationale
                          <textarea
                            rows={2}
                            value={block.rationale}
                            onChange={(event) =>
                              setCardForm((prev) => ({
                                ...prev,
                                blocks: prev.blocks.map((current, blockIndex) =>
                                  blockIndex === index && current.type === 'question'
                                    ? { ...current, rationale: event.target.value }
                                    : current
                                ),
                              }))
                            }
                            className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                          />
                        </label>
                        <label className="block">
                          Difficulty (1–3)
                          <input
                            type="number"
                            min={1}
                            max={3}
                            value={block.difficulty}
                            onChange={(event) =>
                              setCardForm((prev) => ({
                                ...prev,
                                blocks: prev.blocks.map((current, blockIndex) =>
                                  blockIndex === index && current.type === 'question'
                                    ? { ...current, difficulty: Number(event.target.value) }
                                    : current
                                ),
                              }))
                            }
                            className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                          />
                        </label>
                      </div>
                    ) : (
                      <label className="block text-sm">
                        Text
                        <textarea
                          rows={2}
                          value={block.text}
                          onChange={(event) =>
                            setCardForm((prev) => ({
                              ...prev,
                              blocks: prev.blocks.map((current, blockIndex) =>
                                blockIndex === index && current.type !== 'question'
                                  ? { ...current, text: event.target.value }
                                  : current
                              ),
                            }))
                          }
                          className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                        />
                      </label>
                    )}
                  </div>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setCardForm((prev) => ({
                      ...prev,
                      blocks: [...prev.blocks, { type: 'paragraph', text: '' }],
                    }))
                  }
                  className="rounded-md border border-slate-200 px-3 py-1 text-xs hover:border-nhs-blue"
                >
                  Add paragraph
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setCardForm((prev) => ({
                      ...prev,
                      blocks: [
                        ...prev.blocks,
                        {
                          type: 'question',
                          questionType: 'MCQ',
                          prompt: '',
                          optionsText: '',
                          correctAnswer: '',
                          rationale: '',
                          difficulty: 2,
                        },
                      ],
                    }))
                  }
                  className="rounded-md border border-slate-200 px-3 py-1 text-xs hover:border-nhs-blue"
                >
                  Add question
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setCardForm((prev) => ({
                      ...prev,
                      blocks: [...prev.blocks, { type: 'reveal', text: '' }],
                    }))
                  }
                  className="rounded-md border border-slate-200 px-3 py-1 text-xs hover:border-nhs-blue"
                >
                  Add reveal
                </button>
              </div>
            </div>

            <div className="rounded-md border border-slate-200 p-3">
              <p className="text-sm font-semibold text-slate-600">Sources</p>
              <div className="mt-3 space-y-3">
                {cardForm.sources.length === 0 && <p className="text-xs text-slate-500">Add a source.</p>}
                {cardForm.sources.map((source, index) => (
                  <div key={`${source.url}-${index}`} className="rounded-md border border-slate-200 p-3">
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span>Source {index + 1}</span>
                      <button
                        type="button"
                        onClick={() =>
                          setCardForm((prev) => ({
                            ...prev,
                            sources: prev.sources.filter((_, sourceIndex) => sourceIndex !== index),
                          }))
                        }
                        className="text-red-600 hover:underline"
                      >
                        Remove
                      </button>
                    </div>
                    <div className="mt-3 space-y-2">
                      <input
                        type="text"
                        placeholder="Title"
                        value={source.title}
                        onChange={(event) =>
                          setCardForm((prev) => ({
                            ...prev,
                            sources: prev.sources.map((current, sourceIndex) =>
                              sourceIndex === index ? { ...current, title: event.target.value } : current
                            ),
                          }))
                        }
                        className="w-full rounded-md border border-slate-200 px-3 py-2 text-xs"
                      />
                      <input
                        type="text"
                        placeholder="Organisation"
                        value={source.org}
                        onChange={(event) =>
                          setCardForm((prev) => ({
                            ...prev,
                            sources: prev.sources.map((current, sourceIndex) =>
                              sourceIndex === index ? { ...current, org: event.target.value } : current
                            ),
                          }))
                        }
                        className="w-full rounded-md border border-slate-200 px-3 py-2 text-xs"
                      />
                      <input
                        type="url"
                        placeholder="URL"
                        value={source.url}
                        onChange={(event) =>
                          setCardForm((prev) => ({
                            ...prev,
                            sources: prev.sources.map((current, sourceIndex) =>
                              sourceIndex === index ? { ...current, url: event.target.value } : current
                            ),
                          }))
                        }
                        className="w-full rounded-md border border-slate-200 px-3 py-2 text-xs"
                      />
                      <input
                        type="text"
                        placeholder="Published date (optional)"
                        value={source.publishedDate ?? ''}
                        onChange={(event) =>
                          setCardForm((prev) => ({
                            ...prev,
                            sources: prev.sources.map((current, sourceIndex) =>
                              sourceIndex === index ? { ...current, publishedDate: event.target.value } : current
                            ),
                          }))
                        }
                        className="w-full rounded-md border border-slate-200 px-3 py-2 text-xs"
                      />
                    </div>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() =>
                  setCardForm((prev) => ({
                    ...prev,
                    sources: [...prev.sources, { title: '', org: '', url: '', publishedDate: '' }],
                  }))
                }
                className="mt-3 rounded-md border border-slate-200 px-3 py-1 text-xs hover:border-nhs-blue"
              >
                Add source
              </button>
            </div>

            <button
              type="submit"
              disabled={saving || topics.length === 0}
              className="w-full rounded-md bg-nhs-blue px-3 py-2 text-sm font-semibold text-white hover:bg-nhs-dark-blue disabled:cursor-not-allowed disabled:opacity-70"
            >
              {saving ? 'Saving…' : cardForm.id ? 'Update card' : 'Create card'}
            </button>
          </form>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-nhs-dark-blue">Flag queue</h2>
        {flags.length === 0 ? (
          <p className="mt-2 text-sm text-slate-600">No flagged content yet.</p>
        ) : (
          <ul className="mt-3 space-y-2 text-sm text-slate-700">
            {flags.map((flag) => (
              <li key={flag.id} className="rounded-md border border-slate-200 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold">{flag.card.title}</p>
                    <p className="text-xs text-slate-500">
                      {flag.reason} • {flag.user.name ?? flag.user.email}
                    </p>
                  </div>
                  {flag.status === 'OPEN' && (
                    <button
                      type="button"
                      onClick={() => resolveFlag(flag.id)}
                      className="rounded-md border border-slate-200 px-2 py-1 text-xs hover:border-nhs-blue"
                    >
                      Mark resolved
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
