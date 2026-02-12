'use client'

interface PhoneFrameProps {
  children: React.ReactNode
  /** Optional actions to render outside/below the phone (e.g. Approve, Publish) */
  actions?: React.ReactNode
  /** Optional className for the outer wrapper */
  className?: string
  /** When true, actions stretch to max-w-[400px] to align with phone */
  alignActions?: boolean
}

export default function PhoneFrame({ children, actions, className = '', alignActions = true }: PhoneFrameProps) {
  return (
    <div className={`flex flex-col items-center gap-4 p-4 ${className}`}>
      <div
        className="relative w-full overflow-hidden rounded-[2.5rem] border-[14px] border-slate-800 bg-slate-800 shadow-2xl"
        style={{
          // Maintain phone aspect ratio (9:16 portrait) while fitting viewport
          // Width is constrained by: viewport width (90%), viewport height (accounting for header/actions ~250px), and max 400px
          width: 'min(90vw, calc((100vh - 250px) * 9 / 16), 400px)',
          aspectRatio: '9/16',
        }}
      >
        <div className="h-full overflow-hidden bg-white">{children}</div>
      </div>
      {actions ? (
        <div
          className={`flex flex-wrap justify-center gap-2 ${alignActions ? 'w-full' : ''}`}
          style={alignActions ? { maxWidth: 'min(90vw, calc((100vh - 250px) * 9 / 16), 400px)' } : undefined}
        >
          {actions}
        </div>
      ) : null}
    </div>
  )
}
