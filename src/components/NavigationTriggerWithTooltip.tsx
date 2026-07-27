'use client'

import { useRef } from 'react'
import NavigationPanelTrigger from './NavigationPanelTrigger'
import NavUpdateTooltip from './NavUpdateTooltip'
import SuggestFeatureCalloutTooltip from './SuggestFeatureCalloutTooltip'

interface NavigationTriggerWithTooltipProps {
  className?: string
}

/**
 * Navigation panel trigger with first-time tooltip.
 * Shows a one-time coach mark for new navigation on first use.
 */
export default function NavigationTriggerWithTooltip({
  className,
}: NavigationTriggerWithTooltipProps) {
  const triggerRef = useRef<HTMLButtonElement>(null)

  return (
    <>
      <NavigationPanelTrigger ref={triggerRef} className={className} />
      <NavUpdateTooltip triggerRef={triggerRef} />
      <SuggestFeatureCalloutTooltip triggerRef={triggerRef} />
    </>
  )
}
