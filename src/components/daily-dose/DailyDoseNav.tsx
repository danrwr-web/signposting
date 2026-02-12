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
  // Navigation is now handled by SimpleHeader - this component is kept for backward compatibility
  return null
}
