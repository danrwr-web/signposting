'use client'

import { useEffect, useState } from 'react'
import RichTextEditor from '@/components/rich-text/RichTextEditor'

interface Props {
  isOpen: boolean
  onClose: () => void
  isSuperuser: boolean
  currentSurgeryId: string | null
  surgeries: Array<{ id: string; name: string }>
  onCreated: (scope: 'BASE' | 'SURGERY') => void
}

export default function NewSymptomModal({ isOpen, onClose, isSuperuser, currentSurgeryId, surgeries, onCreated }: Props) {
  const [target, setTarget] = useState<'BASE' | 'SURGERY'>(isSuperuser ? 'SURGERY' : 'SURGERY')
  const [targetSurgeryId, setTargetSurgeryId] = useState<string | ''>(currentSurgeryId || '')
  const [name, setName] = useState('')
  const [briefInstruction, setBriefInstruction] = useState('')
  const [highlightedText, setHighlightedText] = useState('')
  const [linkToPage, setLinkToPage] = useState('')
  const [instructionsHtml, setInstructionsHtml] = useState('')
  const [instructionsJson, setInstructionsJson] = useState<any>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isSuperuser) {
      setTarget('SURGERY')
    }
  }, [isSuperuser])

  useEffect(() => {
    if (currentSurgeryId) setTargetSurgeryId(currentSurgeryId)
  }, [currentSurgeryId])

  if (!isOpen) return null

  const canSubmit = () => {
    if (!name.trim() || name.trim().length > 120) return false
    if (!instructionsHtml.trim()) return false
    if (isSuperuser && target === 'SURGERY' && !targetSurgeryId) return false
    if (!isSuperuser && !currentSurgeryId) return false
    return true
  }

  const handleSubmit = async () => {
    if (!canSubmit()) return
    setSubmitting(true)
    setError(null)
    try {
      const body: any = {
        target,
        surgeryId: target === 'SURGERY' ? (isSuperuser ? targetSurgeryId : currentSurgeryId) : undefined,
        name: name.trim(),
        briefInstruction: briefInstruction.trim() || null,
        highlightedText: highlightedText.trim() || undefined,
        linkToPage: linkToPage.trim() || undefined,
        instructionsHtml,
        instructionsJson: instructionsJson || undefined,
      }
      const res = await fetch('/api/symptoms/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      const data = await res.json().catch(() => ({}))
      if (res.status === 409 && data?.error === 'DUPLICATE') {
        setError('A symptom with this name already exists in the target scope.')
        return
      }
      if (!res.ok) {
        setError(data?.error || 'Failed to create symptom')
        return
      }
      onCreated(target)
      onClose()
    } catch (e) {
      setError('Failed to create symptom')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-lg shadow-lg w-full max-w-2xl p-6">
        <h3 className="text-lg font-semibold mb-4">Add Symptom</h3>

        {isSuperuser ? (
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Target</label>
            <div className="flex items-center gap-4 text-sm">
              <label className="inline-flex items-center gap-2">
                <input type="radio" checked={target === 'BASE'} onChange={() => setTarget('BASE')} />
                <span>Base (shared library)</span>
              </label>
              <label className="inline-flex items-center gap-2">
                <input type="radio" checked={target === 'SURGERY'} onChange={() => setTarget('SURGERY')} />
                <span>Surgery</span>
              </label>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              {target === 'BASE'
                ? 'Base (shared library): visible to any practice that enables it via their library.'
                : 'Surgery: visible only at the selected practice.'}
            </p>
            {target === 'SURGERY' && (
              <div className="mt-3">
                <label className="block text-sm font-medium text-gray-700 mb-1">Surgery</label>
                <select
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                  value={targetSurgeryId}
                  onChange={(e) => setTargetSurgeryId(e.target.value)}
                >
                  {surgeries.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        ) : (
          <div className="mb-4 text-sm text-gray-700">Target: This surgery</div>
        )}

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            placeholder="Symptom name"
          />
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Brief instruction (optional)</label>
          <input
            type="text"
            value={briefInstruction}
            onChange={(e) => setBriefInstruction(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            placeholder="e.g., Ask the patient to..."
          />
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Important notice (optional)</label>
          <textarea
            value={highlightedText}
            onChange={(e) => setHighlightedText(e.target.value)}
            rows={2}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            placeholder="Shown prominently in red. Keep concise."
          />
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Related information (optional)</label>
          <input
            type="text"
            value={linkToPage}
            onChange={(e) => setLinkToPage(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            placeholder="Name of another symptom to link to"
            aria-describedby="related-info-hint"
          />
          <p id="related-info-hint" className="text-xs text-gray-500 mt-1">Enter the exact name of the other symptom. Users can click through for more detail.</p>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Full instruction</label>
          <RichTextEditor
            initialHtml=""
            onChangeHtml={(html) => setInstructionsHtml(html)}
            onChangeJson={(json) => setInstructionsJson(json)}
          />
        </div>

        {error && (
          <div className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded p-2">{error}</div>
        )}

        <div className="flex justify-end gap-2 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-gray-50"
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="px-4 py-2 bg-nhs-green text-white rounded-md text-sm hover:bg-green-600 disabled:opacity-50"
            disabled={!canSubmit() || submitting}
          >
            {submitting ? 'Creating...' : 'Confirm & Create'}
          </button>
        </div>
      </div>
    </div>
  )
}


