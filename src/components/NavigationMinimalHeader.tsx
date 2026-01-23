'use client'

import Link from 'next/link'
import NavigationPanelTrigger from './NavigationPanelTrigger'

interface NavigationMinimalHeaderProps {
  backHref: string
  backLabel?: string
  children?: React.ReactNode
}

/**
 * A minimal header with the navigation panel trigger and back link.
 * Used on pages that don't have a full SimpleHeader or CompactToolbar.
 */
export default function NavigationMinimalHeader({
  backHref,
  backLabel = 'Back',
  children,
}: NavigationMinimalHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-6">
      <div className="flex items-center gap-4">
        <NavigationPanelTrigger />
        <Link
          href={backHref}
          className="text-sm font-medium text-gray-600 hover:text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded"
        >
          ← {backLabel}
        </Link>
      </div>
      {children && <div className="flex items-center gap-4">{children}</div>}
    </div>
  )
}
