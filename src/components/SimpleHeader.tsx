"use client"

import Link from 'next/link'
import { useParams, usePathname, useSearchParams } from 'next/navigation'
import SurgerySelector from './SurgerySelector'
import { Surgery } from '@prisma/client'
import LogoSizeControl from './LogoSizeControl'
import NavigationPanelTrigger from './NavigationPanelTrigger'

interface SimpleHeaderProps {
  surgeries: Surgery[]
  currentSurgeryId?: string
}

export default function SimpleHeader({
  surgeries,
  currentSurgeryId,
}: SimpleHeaderProps) {
  const pathname = usePathname()
  const params = useParams()
  const searchParams = useSearchParams()

  // `params.id` is ambiguous: it is the surgery id on `/s/[id]/...`, but it is the symptom id on `/symptom/[id]`.
  // Use the pathname to decide which value is safe to treat as a surgery id.
  const surgeryId =
    pathname.startsWith('/s/')
      ? ((params as Record<string, string | string[] | undefined>)?.id as string | undefined)
      : pathname.startsWith('/symptom/')
        ? (searchParams.get('surgery') || undefined)
        : undefined

  const logoHref = surgeryId ? `/s/${surgeryId}` : '/s'

  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Navigation Trigger + Logo */}
          <div className="flex items-center">
            <NavigationPanelTrigger className="mr-3" />
            <Link href={logoHref} className="flex items-center">
              <img
                src="/images/signposting_logo_head.png"
                alt="Signposting"
                style={{ height: 'var(--logo-height, 58px)' }}
                className="w-auto"
              />
            </Link>
            <LogoSizeControl />
          </div>

          {/* Surgery Selector */}
          <div className="flex items-center">
            <SurgerySelector 
              surgeries={surgeries} 
              currentSurgeryId={currentSurgeryId}
            />
          </div>
        </div>
      </div>
    </header>
  )
}
