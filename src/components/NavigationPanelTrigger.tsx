'use client'

import { useNavigationPanel } from '@/context/NavigationPanelContext'

interface NavigationPanelTriggerProps {
  className?: string
}

export default function NavigationPanelTrigger({ className = '' }: NavigationPanelTriggerProps) {
  const { toggle, isOpen } = useNavigationPanel()

  return (
    <button
      onClick={toggle}
      className={`p-2 rounded-md text-nhs-grey hover:bg-nhs-light-grey hover:text-nhs-dark-grey transition-colors focus:outline-none focus:ring-2 focus:ring-nhs-blue focus:ring-offset-2 ${className}`}
      aria-label={isOpen ? 'Close navigation menu' : 'Open navigation menu'}
      aria-expanded={isOpen}
      aria-controls="navigation-panel"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
        className="w-6 h-6"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
        />
      </svg>
    </button>
  )
}
