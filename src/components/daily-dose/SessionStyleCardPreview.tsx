'use client'

import LearningCardOptionCard from '@/components/daily-dose/LearningCardOptionCard'

/** Describes which part of the preview was clicked for inline editing */
export type InlineEditTarget =
  | { type: 'contentBlock'; blockIndex: number; field: 'text' | 'items'; label: string }
  | { type: 'interaction'; interactionIndex: number; field: 'question' | 'explanation'; label: string }
  | { type: 'interaction'; interactionIndex: number; field: 'options'; label: string; correctIndex: number }

export type SessionPreviewContentBlock =
  | { type: 'text' | 'callout'; text: string }
  | { type: 'steps' | 'do-dont'; items: string[] }

export type SessionPreviewInteraction = {
  question: string
  options: string[]
  correctIndex: number
  explanation: string
}

export type SessionPreviewSource = {
  title: string
  url: string | null
  publisher?: string
}

interface SessionStyleCardPreviewProps {
  title: string
  headerText?: string
  contentBlocks: SessionPreviewContentBlock[]
  interactions: SessionPreviewInteraction[]
  sources?: SessionPreviewSource[]
  reviewByDate?: string | null
  /** When set, only this frame is shown (0 = question, 1 = feedback+sources, 2 = additional content). Enables Back/Next navigation. */
  frameIndex?: number
  /** When true, content blocks and interactions are clickable; onEdit is called with target and current value */
  editable?: boolean
  onEdit?: (target: InlineEditTarget, value: string) => void
}

/** Number of frames for a card: 2 (question, feedback+sources) or 3 (+ additional content). */
export function getSessionPreviewFrameCount(contentBlocks: SessionPreviewContentBlock[]): number {
  return contentBlocks.length > 0 ? 3 : 2
}

/**
 * Renders a card in the same layout as the Daily Dose learning session,
 * for use in the editorial batch review. The correct answer is always
 * shown with green styling and a tick (review mode).
 * When frameIndex is provided, only that frame is shown (no scroll).
 */
function EditableRegion({
  children,
  onClick,
  editable,
  label,
}: {
  children: React.ReactNode
  onClick?: () => void
  editable?: boolean
  label: string
}) {
  if (!editable || !onClick) return <>{children}</>
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick()
        }
      }}
      className="w-full text-left rounded-md -m-1 p-1 hover:bg-nhs-light-blue/50 hover:ring-1 hover:ring-nhs-blue/30 transition-colors cursor-pointer group focus:outline-none focus-visible:ring-2 focus-visible:ring-nhs-blue focus-visible:ring-offset-1"
      aria-label={`Edit ${label}`}
      title={`Click to edit ${label}`}
    >
      {children}
      <span className="block mt-1 text-[10px] text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">Click to edit</span>
    </div>
  )
}

export default function SessionStyleCardPreview({
  title,
  headerText,
  contentBlocks,
  interactions,
  sources = [],
  reviewByDate,
  frameIndex,
  editable = false,
  onEdit,
}: SessionStyleCardPreviewProps) {
  const totalFrames = contentBlocks.length > 0 ? 3 : 2
  const useFrames = frameIndex !== undefined
  const frame = useFrames ? Math.max(0, Math.min(frameIndex, totalFrames - 1)) : 0

  const header = (
    <>
      {headerText && <p className="mb-2 text-xs text-slate-500">{headerText}</p>}
      <h1 className="mb-4 text-xl font-bold leading-tight text-nhs-dark-blue">{title}</h1>
    </>
  )

  return (
    <div className={`flex h-full flex-col p-6 ${useFrames ? 'overflow-hidden' : 'overflow-auto'}`}>
      {(!useFrames || frame === 0) && (
        <>
          {header}
          {interactions.map((interaction, i) => (
            <div key={i} className="space-y-4">
              <EditableRegion
                editable={editable}
                label={`question ${i + 1}`}
                onClick={() =>
                  onEdit?.(
                    { type: 'interaction', interactionIndex: i, field: 'question', label: `Question ${i + 1}` },
                    interaction.question
                  )
                }
              >
                <p className="text-sm font-semibold text-slate-700">{interaction.question}</p>
              </EditableRegion>
              <EditableRegion
                editable={editable}
                label={`answer options ${i + 1}`}
                onClick={() =>
                  onEdit?.(
                    {
                      type: 'interaction',
                      interactionIndex: i,
                      field: 'options',
                      label: `Answer options ${i + 1}`,
                      correctIndex: interaction.correctIndex,
                    },
                    interaction.options.join('\n')
                  )
                }
              >
                <div className="space-y-2">
                  {interaction.options.map((option, j) => (
                    <LearningCardOptionCard
                      key={j}
                      label={option}
                      reviewCorrect={j === interaction.correctIndex}
                      static={editable}
                    />
                  ))}
                </div>
              </EditableRegion>
            </div>
          ))}
        </>
      )}

      {(!useFrames || frame === 1) && (
        <>
          {useFrames && header}
          {interactions.map((interaction, i) => (
            <EditableRegion
              key={i}
              editable={editable}
              label={`feedback ${i + 1}`}
              onClick={() =>
                onEdit?.(
                  { type: 'interaction', interactionIndex: i, field: 'explanation', label: `Feedback ${i + 1}` },
                  interaction.explanation
                )
              }
            >
              <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                <p className="text-sm font-medium text-emerald-800">
                  ✓ Correct. {interaction.explanation}
                </p>
              </div>
            </EditableRegion>
          ))}
          {sources.length > 0 && (
            <div className="border-t border-slate-200 pt-3">
              <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-slate-400">Sources</p>
              <ul className="space-y-0.5 text-[10px] text-slate-500">
                {sources.map((source, i) => {
                  const hasValidUrl = source.url && source.url !== '#' && source.url.trim() !== ''
                  return (
                    <li key={source.url ?? i}>
                      {hasValidUrl ? (
                        <a
                          href={source.url!}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="text-nhs-blue underline-offset-1 hover:underline"
                        >
                          {source.title} {source.publisher ? `(${source.publisher})` : ''}
                        </a>
                      ) : (
                        <span className="text-slate-500">
                          {source.title} {source.publisher ? `(${source.publisher})` : ''}
                        </span>
                      )}
                    </li>
                  )
                })}
              </ul>
              {reviewByDate && (
                <p className="mt-2 text-[10px] text-slate-500">Review due: {reviewByDate}</p>
              )}
            </div>
          )}
        </>
      )}

      {(!useFrames || frame === 2) && contentBlocks.length > 0 && (
        <>
          {useFrames && header}
          <div className="space-y-4">
            {contentBlocks.map((block, i) => {
              if (block.type === 'text' || block.type === 'callout') {
                return (
                  <EditableRegion
                    key={i}
                    editable={editable}
                    label={`scenario ${i + 1}`}
                    onClick={() =>
                      onEdit?.(
                        { type: 'contentBlock', blockIndex: i, field: 'text', label: `Scenario ${i + 1}` },
                        block.text
                      )
                    }
                  >
                    <div
                      className={`rounded-lg border p-4 ${
                        block.type === 'callout' ? 'border-amber-200 bg-amber-50/50' : 'border-slate-200 bg-white'
                      }`}
                    >
                      <p className="text-slate-700">{block.text}</p>
                    </div>
                  </EditableRegion>
                )
              }
              if (block.type === 'steps' || block.type === 'do-dont') {
                return (
                  <EditableRegion
                    key={i}
                    editable={editable}
                    label={`content block ${i + 1}`}
                    onClick={() =>
                      onEdit?.(
                        { type: 'contentBlock', blockIndex: i, field: 'items', label: `Content block ${i + 1}` },
                        block.items.join('\n')
                      )
                    }
                  >
                    <div className="rounded-lg border border-slate-200 bg-white p-4">
                      <ul className="space-y-2 text-slate-700">
                        {block.items.map((item, j) => (
                          <li key={j} className="flex gap-2">
                            <span className="text-nhs-blue">•</span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </EditableRegion>
                )
              }
              return null
            })}
          </div>
        </>
      )}
    </div>
  )
}
