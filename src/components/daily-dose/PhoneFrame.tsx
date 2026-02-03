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

const PHONE_STYLE = {
  height: 'calc(100dvh - 180px)',
  minHeight: 360,
  maxHeight: 720,
} as const

export default function PhoneFrame({ children, actions, className = '', alignActions = true }: PhoneFrameProps) {
  return (
    <div className={`flex flex-col items-center gap-4 p-4 ${className}`}>
      <div
        className="relative w-full max-w-[400px] overflow-hidden rounded-[2.5rem] border-[14px] border-slate-800 bg-slate-800 shadow-2xl"
        style={PHONE_STYLE}
      >
        <div className="h-full overflow-hidden bg-white">{children}</div>
      </div>
      {actions ? (
        <div
          className={`flex flex-wrap justify-center gap-2 ${alignActions ? 'w-full max-w-[400px]' : ''}`}
        >
          {actions}
        </div>
      ) : null}
    </div>
  )
}

export { PHONE_STYLE }
