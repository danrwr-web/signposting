'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { useSurgery } from '@/context/SurgeryContext'

interface DailyDoseNavigationProps {
  surgeryId: string
}

export default function DailyDoseNavigation({ surgeryId }: DailyDoseNavigationProps) {
  const pathname = usePathname()
  const { data: session } = useSession()
  const { canManageSurgery } = useSurgery()

  const isAdmin = canManageSurgery(surgeryId)
  const isSuperuser = session?.user && (session.user as any).globalRole === 'SUPERUSER'
  const canSeeAdmin = isAdmin || isSuperuser

  const basePath = `/s/${surgeryId}/daily-dose`

  const tabs = [
    { id: 'home', label: 'Home', href: basePath },
    { id: 'history', label: 'History', href: `${basePath}/history` },
    ...(canSeeAdmin
      ? [
          { id: 'insights', label: 'Insights', href: `${basePath}/insights` },
          { id: 'editorial', label: 'Editorial', href: `/editorial?surgery=${surgeryId}` },
        ]
      : []),
  ]

  // Determine active tab based on pathname
  const getActiveTab = () => {
    if (pathname === basePath || pathname === `${basePath}/`) return 'home'
    if (pathname?.startsWith(`${basePath}/history`)) return 'history'
    if (pathname?.startsWith(`${basePath}/insights`)) return 'insights'
    if (pathname?.startsWith('/editorial')) return 'editorial'
    return null
  }

  const activeTab = getActiveTab()

  return (
    <div className="bg-white rounded-lg shadow-sm mb-6">
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8 px-6" aria-label="Daily Dose navigation">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id
            return (
              <Link
                key={tab.id}
                href={tab.href}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  isActive
                    ? 'border-nhs-blue text-nhs-blue'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
                aria-current={isActive ? 'page' : undefined}
              >
                {tab.label}
              </Link>
            )
          })}
        </nav>
      </div>
    </div>
  )
}
