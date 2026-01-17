'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface EditorialGeneratorClientProps {
  surgeryId: string
}

export default function EditorialGeneratorClient({ surgeryId }: EditorialGeneratorClientProps) {
  const router = useRouter()
  const [promptText, setPromptText] = useState('')
  const [targetRole, setTargetRole] = useState('ADMIN')
  const [count, setCount] = useState(5)
  const [tags, setTags] = useState('')
  const [interactiveFirst, setInteractiveFirst] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleGenerate = async (event: React.FormEvent) => {
    event.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/editorial/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          surgeryId,
          promptText,
          targetRole,
          count,
          tags: tags
            .split(',')
            .map((tag) => tag.trim())
            .filter(Boolean),
          interactiveFirst,
        }),
      })

      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(payload?.error?.message || 'Unable to generate drafts')
      }

      router.push(`/editorial/batches/${payload.batchId}?surgery=${surgeryId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  const handleClear = () => {
    setPromptText('')
    setTags('')
    setCount(5)
    setTargetRole('ADMIN')
    setInteractiveFirst(true)
    setError(null)
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <h1 className="text-2xl font-bold text-nhs-dark-blue">Editorial generator</h1>
        <p className="mt-2 text-sm text-slate-600">
          Draft Daily Dose cards with an AI prompt. Review and approve before publishing.
        </p>
        {error && (
          <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">
            {error}
          </div>
        )}
      </div>

      <form onSubmit={handleGenerate} className="rounded-lg border border-slate-200 bg-white p-6">
        <div className="grid gap-4 lg:grid-cols-[2fr,1fr]">
          <label className="block text-sm">
            Prompt
            <textarea
              rows={4}
              value={promptText}
              onChange={(event) => setPromptText(event.target.value)}
              className="mt-2 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
              placeholder='e.g. "Create 5 learning cards for the admin team about mental health crises"'
              required
            />
          </label>

          <div className="space-y-4">
            <label className="block text-sm">
              Target role
              <select
                value={targetRole}
                onChange={(event) => setTargetRole(event.target.value)}
                className="mt-2 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
              >
                <option value="ADMIN">Admin / Reception</option>
                <option value="GP">GP / Prescriber</option>
                <option value="NURSE">Nurse / HCA</option>
              </select>
            </label>

            <label className="block text-sm">
              Number of cards
              <input
                type="number"
                min={1}
                max={10}
                value={count}
                onChange={(event) => setCount(Number(event.target.value))}
                className="mt-2 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
              />
            </label>

            <label className="block text-sm">
              Tags (optional)
              <input
                type="text"
                value={tags}
                onChange={(event) => setTags(event.target.value)}
                className="mt-2 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                placeholder="e.g. mental health, escalation"
              />
            </label>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={interactiveFirst}
                onChange={(event) => setInteractiveFirst(event.target.checked)}
                className="accent-nhs-blue"
              />
              Interactive-first (default on)
            </label>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={loading}
            className="rounded-md bg-nhs-blue px-4 py-2 text-sm font-semibold text-white hover:bg-nhs-dark-blue disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loading ? 'Generating…' : 'Generate drafts'}
          </button>
          <button
            type="button"
            onClick={handleClear}
            className="rounded-md border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:border-nhs-blue"
          >
            Clear
          </button>
        </div>
      </form>
    </div>
  )
}
