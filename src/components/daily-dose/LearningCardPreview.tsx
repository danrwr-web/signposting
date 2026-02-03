'use client'

type ContentBlock =
  | { type: 'paragraph' | 'text' | 'callout'; text: string }
  | { type: 'steps' | 'do-dont'; items: string[] }
  | { type: 'question'; prompt: string; options: string[] }
  | { type: 'reveal'; text: string }

type Interaction = {
  question: string
  options: string[]
}

type Source = { title: string; url: string; org?: string; publisher?: string }

interface LearningCardPreviewProps {
  title: string
  headerText?: string
  contentBlocks: ContentBlock[]
  interactions?: Interaction[]
  sources?: Source[]
  reviewByDate?: string | null
}

export default function LearningCardPreview({
  title,
  headerText,
  contentBlocks,
  interactions = [],
  sources = [],
  reviewByDate,
}: LearningCardPreviewProps) {
  return (
    <div className="flex h-full flex-col overflow-auto p-6">
      {headerText && <p className="text-xs text-slate-500">{headerText}</p>}
      <h1 className="mt-2 text-xl font-bold leading-tight text-nhs-dark-blue">{title}</h1>

      <div className="mt-4 space-y-4">
        {interactions.map((interaction, i) => (
          <div key={`int-${i}`} className="rounded-lg border border-slate-200 bg-slate-50/50 p-4">
            <p className="text-sm font-semibold text-slate-700">{interaction.question}</p>
            <ul className="mt-2 space-y-1 text-sm text-slate-600">
              {interaction.options.map((opt, j) => (
                <li key={j} className="flex gap-2">
                  <span className="text-nhs-blue">•</span>
                  {opt}
                </li>
              ))}
            </ul>
          </div>
        ))}
        {contentBlocks.map((block, i) => {
          if (block.type === 'paragraph' || block.type === 'text' || block.type === 'callout') {
            return (
              <div
                key={i}
                className={`rounded-lg border p-3 text-sm text-slate-700 ${
                  block.type === 'callout' ? 'border-amber-200 bg-amber-50/50' : 'border-slate-200 bg-white'
                }`}
              >
                {block.text}
              </div>
            )
          }
          if (block.type === 'steps' || block.type === 'do-dont') {
            return (
              <div key={i} className="rounded-lg border border-slate-200 bg-white p-3">
                <ul className="space-y-1.5 text-sm text-slate-700">
                  {block.items.map((item, j) => (
                    <li key={j} className="flex gap-2">
                      <span className="text-nhs-blue">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )
          }
          if (block.type === 'question') {
            return (
              <div key={i} className="rounded-lg border border-slate-200 bg-slate-50/50 p-4">
                <p className="text-sm font-semibold text-slate-700">{block.prompt}</p>
                <ul className="mt-2 space-y-1 text-sm text-slate-600">
                  {block.options.map((opt, j) => (
                    <li key={j} className="flex gap-2">
                      <span className="text-nhs-blue">•</span>
                      {opt}
                    </li>
                  ))}
                </ul>
              </div>
            )
          }
          if (block.type === 'reveal') {
            return (
              <div key={i} className="rounded-lg border border-slate-200 bg-white p-3">
                <p className="text-sm text-slate-700">{block.text}</p>
              </div>
            )
          }
          return null
        })}
        {sources.length > 0 && (
          <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3 text-sm text-slate-600">
            <p className="font-semibold text-slate-700">Sources</p>
            <ul className="mt-2 space-y-1">
              {sources.map((s, i) => (
                <li key={i}>
                  <a href={s.url} target="_blank" rel="noreferrer noopener" className="text-nhs-blue hover:underline">
                    {s.title} ({s.org ?? s.publisher ?? 'UK source'})
                  </a>
                </li>
              ))}
            </ul>
            {reviewByDate && <p className="mt-2 text-xs text-slate-500">Review due: {reviewByDate}</p>}
          </div>
        )}
      </div>
    </div>
  )
}
