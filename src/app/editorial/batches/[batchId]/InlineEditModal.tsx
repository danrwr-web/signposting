'use client'

import { useState, useRef } from 'react'
import Modal from '@/components/appointments/Modal'
import type { InlineEditTarget } from '@/components/daily-dose/SessionStyleCardPreview'

type InlineEditModalProps = {
  target: InlineEditTarget
  initialValue: string
  onApply: (value: string, target: InlineEditTarget) => void
  onCancel: () => void
}

/**
 * Modal for inline editing. Keeps its own state so typing doesn't cause parent re-renders
 * (which was stealing focus from the textarea).
 */
export function InlineEditModal({ target, initialValue, onApply, onCancel }: InlineEditModalProps) {
  const [value, setValue] = useState(initialValue)
  const [correctIndex, setCorrectIndex] = useState(
    target.type === 'interaction' && target.field === 'options' ? target.correctIndex : 0
  )
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const isOptionsField =
    target.type === 'interaction' && target.field === 'options'
  const isMultiline =
    target.field === 'options' || target.field === 'items'

  const lines = value.split('\n')
  const maxCorrectIdx = Math.max(0, lines.length - 1)
  const clampedCorrectIndex = Math.min(correctIndex, maxCorrectIdx)

  const handleApply = () => {
    const resolvedTarget: InlineEditTarget =
      isOptionsField
        ? { ...target, correctIndex: clampedCorrectIndex }
        : target
    onApply(value, resolvedTarget)
  }

  return (
    <Modal
      title={`Edit ${target.label}`}
      onClose={onCancel}
      widthClassName="max-w-xl"
      initialFocusRef={textareaRef}
    >
      <div className="space-y-4">
        <p className="text-sm text-slate-600">
          Changes update the preview below. Use Approve and publish to save to the card.
        </p>
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          rows={isMultiline ? 6 : 4}
          className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
          placeholder={isMultiline ? 'One item per line' : undefined}
        />
        {isOptionsField && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Which option is correct?
            </label>
            <select
              value={clampedCorrectIndex}
              onChange={(e) => setCorrectIndex(Number(e.target.value))}
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
            >
              {lines.length === 0 || lines.every((l) => !l.trim()) ? (
                <option value={0}>Option 1 (add options above)</option>
              ) : (
                lines.map((line, i) => (
                  <option key={i} value={i}>
                    {line.trim() || `Option ${i + 1}`}
                  </option>
                ))
              )}
            </select>
          </div>
        )}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-slate-200 px-4 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleApply}
            className="rounded-md bg-nhs-blue px-4 py-1.5 text-sm font-semibold text-white hover:bg-nhs-dark-blue"
          >
            Apply
          </button>
        </div>
      </div>
    </Modal>
  )
}
