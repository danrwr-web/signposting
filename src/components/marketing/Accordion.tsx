'use client'

import { useId, useState } from 'react'

export type AccordionItem = {
  id: string
  question: string
  answer: string
}

type AccordionProps = {
  items: AccordionItem[]
  allowMultipleOpen?: boolean
}

export default function Accordion({ items, allowMultipleOpen = true }: AccordionProps) {
  const baseId = useId()
  const [openIds, setOpenIds] = useState<Set<string>>(() => new Set())

  const toggle = (id: string) => {
    setOpenIds((prev) => {
      const next = new Set(prev)
      const isOpen = next.has(id)
      if (!allowMultipleOpen) next.clear()
      if (isOpen) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="space-y-3">
      {items.map((item) => {
        const isOpen = openIds.has(item.id)
        const buttonId = `${baseId}-button-${item.id}`
        const panelId = `${baseId}-panel-${item.id}`

        return (
          <div key={item.id} className="rounded-lg border border-slate-200 bg-white">
            <h3 className="m-0">
              <button
                type="button"
                id={buttonId}
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => toggle(item.id)}
                className="w-full flex items-start justify-between gap-6 text-left px-5 py-4 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
              >
                <span className="text-base font-semibold text-gray-900 leading-snug">
                  {item.question}
                </span>
                <span aria-hidden="true" className="mt-1 text-blue-700">
                  <svg
                    className={`h-5 w-5 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.25a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z"
                      clipRule="evenodd"
                    />
                  </svg>
                </span>
              </button>
            </h3>
            <div
              id={panelId}
              role="region"
              aria-labelledby={buttonId}
              hidden={!isOpen}
              className="px-5 pb-5"
            >
              <div className="space-y-3">
                {item.answer
                  .split(/\n\s*\n/g)
                  .map((p) => p.trim())
                  .filter(Boolean)
                  .map((paragraph, idx) => (
                    <p key={`${item.id}-${idx}`} className="text-gray-700 leading-relaxed max-w-prose">
                      {paragraph}
                    </p>
                  ))}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

