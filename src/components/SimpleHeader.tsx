"use client"

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import SurgerySelector from './SurgerySelector'
import { Surgery } from '@prisma/client'
import LogoSizeControl from './LogoSizeControl'

interface DirectoryLinkOverride {
  href: string
  label: string
}

interface SimpleHeaderProps {
  surgeries: Surgery[]
  currentSurgeryId?: string
  directoryLinkOverride?: DirectoryLinkOverride
}

export default function SimpleHeader({
  surgeries,
  currentSurgeryId,
  directoryLinkOverride
}: SimpleHeaderProps) {
  const params = useParams()
  const { data: session } = useSession()
  const isSuperuser = session?.user && (session.user as any).globalRole === 'SUPERUSER'
  const isAdmin = session?.user && (session.user as any).memberships?.some((m: any) => m.role === 'ADMIN')
  const canSeeDocsLink = Boolean(isSuperuser || isAdmin)

  // Keep logo navigation inside the current surgery context when possible.
  // Going via `/` can lose `/s/[id]` context and (depending on host/middleware) intermittently bounce users to `/login`.
  const routeSurgeryIdRaw = (params as Record<string, string | string[] | undefined>)?.id
  const routeSurgeryId = Array.isArray(routeSurgeryIdRaw) ? routeSurgeryIdRaw[0] : routeSurgeryIdRaw
  const surgeryIdForHome = routeSurgeryId ?? currentSurgeryId
  const logoHref = surgeryIdForHome ? `/s/${surgeryIdForHome}` : '/s'

  const appointmentLinkHref =
    directoryLinkOverride?.href ??
    (currentSurgeryId ? `/s/${currentSurgeryId}/appointments` : '/')
  const appointmentLinkLabel = directoryLinkOverride?.label ?? 'Appointment Directory'

  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center">
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
          <div className="flex items-center space-x-6">
            <SurgerySelector 
              surgeries={surgeries} 
              currentSurgeryId={currentSurgeryId}
            />
            
            {/* Appointment Directory Link - visible when a surgery is selected */}
            {currentSurgeryId && (
              <Link 
                href={appointmentLinkHref}
                prefetch={false}
                className="text-sm text-nhs-grey hover:text-nhs-blue transition-colors"
              >
                {appointmentLinkLabel}
              </Link>
            )}
            
            {/* Admin Link */}
            <Link 
              href="/admin" 
              prefetch={false}
              className="text-sm text-nhs-grey hover:text-nhs-blue transition-colors"
            >
              Admin
            </Link>
            
            {/* Documentation Link for admins and superusers */}
            {canSeeDocsLink && (
              <a
                href="https://docs.signpostingtool.co.uk/"
                target="_blank"
                rel="noreferrer noopener"
                className="text-sm text-nhs-grey hover:text-nhs-blue transition-colors underline-offset-2 hover:underline"
              >
                Docs
              </a>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
