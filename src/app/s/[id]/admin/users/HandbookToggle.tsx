'use client'

import { hasHandbookAccess, type Membership } from './types'

interface HandbookToggleProps {
  membership: Membership
  onToggle: (userId: string, nextValue: boolean) => void
}

export default function HandbookToggle({ membership, onToggle }: HandbookToggleProps) {
  const isSurgeryAdmin = membership.role === 'ADMIN'
  const enabled = hasHandbookAccess(membership)
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        onToggle(membership.user.id, !enabled)
      }}
      disabled={isSurgeryAdmin}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
        enabled ? 'bg-nhs-green' : 'bg-gray-200'
      } ${isSurgeryAdmin ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
      aria-label={`Toggle Practice Handbook write for ${membership.user.name || membership.user.email}`}
      title={isSurgeryAdmin ? 'Practice admins can always edit.' : 'Practice Handbook write access'}
    >
      <span
        className="inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform"
        style={{ transform: enabled ? 'translateX(18px)' : 'translateX(2px)' }}
      />
    </button>
  )
}
