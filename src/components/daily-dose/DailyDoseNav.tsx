'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { useSurgery } from '@/context/SurgeryContext'

interface DailyDoseNavProps {
  currentSurgeryId?: string | null
}

const navItems = [
  { href: '/daily-dose', label: 'Home' },
  { href: '/daily-dose/session', label: 'Session' },
  { href: '/daily-dose/history', label: 'History' },
]

export default function DailyDoseNav({ currentSurgeryId }: DailyDoseNavProps) {
  const pathname = usePathname()
  const { data: session } = useSession()
  const { currentSurgeryId: contextSurgeryId } = useSurgery()

  const surgeryId = currentSurgeryId ?? contextSurgeryId ?? undefined
  const isSuperuser = session?.user && (session.user as any).globalRole === 'SUPERUSER'
  const isAdmin =
    session?.user &&
    (session.user as any).memberships?.some((membership: any) => membership.role === 'ADMIN')

  const withSurgery = (href: string) => (surgeryId ? `${href}?surgery=${surgeryId}` : href)

  const adminItems = isSuperuser || isAdmin
    ? [
        { href: '/daily-dose/admin', label: 'Editorial' },
        { href: '/daily-dose/insights', label: 'Insights' },
      ]
    : []

  const items = [...navItems, ...adminItems]

  return (
    <nav aria-label="Daily Dose" className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl flex-wrap gap-4 px-4 py-3 text-sm text-slate-600 sm:px-6 lg:px-8">
        {items.map((item) => {
          const active = pathname === item.href
          return (
            <Link
              key={item.href}
              href={withSurgery(item.href)}
              className={`rounded-full px-3 py-1 transition-colors ${
                active ? 'bg-nhs-blue text-white' : 'hover:text-nhs-dark-blue'
              }`}
              aria-current={active ? 'page' : undefined}
            >
              {item.label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
