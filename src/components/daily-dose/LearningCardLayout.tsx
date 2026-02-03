'use client'

interface LearningCardLayoutProps {
  header: React.ReactNode
  prompt: React.ReactNode
  interactionBlock: React.ReactNode
  feedbackBlock?: React.ReactNode
  footer: React.ReactNode
  /** Optional class for the root container to constrain height (e.g. for no-scroll viewport) */
  containerClassName?: string
}

export default function LearningCardLayout({
  header,
  prompt,
  interactionBlock,
  feedbackBlock,
  footer,
  containerClassName = '',
}: LearningCardLayoutProps) {
  return (
    <div
      className={`flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm ${containerClassName}`}
    >
      {/* A) Header - small, muted, single line */}
      <header className="shrink-0 border-b border-slate-100 px-4 py-2">{header}</header>

      {/* B) Primary prompt - largest text */}
      <div className="shrink-0 px-4 pt-4">{prompt}</div>

      {/* C) Interaction block - visual anchor, can scroll internally */}
      <div className="min-h-0 flex-1 overflow-auto px-4 py-4">{interactionBlock}</div>

      {/* D) Feedback / rationale */}
      {feedbackBlock ? (
        <div className="shrink-0 border-t border-slate-100 px-4 py-3">{feedbackBlock}</div>
      ) : null}

      {/* E) Trust footer - placeholder */}
      <footer className="shrink-0 border-t border-slate-100 px-4 py-2">{footer}</footer>
    </div>
  )
}
