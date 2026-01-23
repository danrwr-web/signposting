"use client"

import Link from 'next/link'
import { useParams, usePathname, useSearchParams } from 'next/navigation'
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
  adminToolkitEnabled?: boolean
}

export default function SimpleHeader({
  surgeries,
  currentSurgeryId,
  directoryLinkOverride,
  adminToolkitEnabled
}: SimpleHeaderProps) {
  const pathname = usePathname()
  const params = useParams()
  const searchParams = useSearchParams()
  const { data: session } = useSession()
  const isSuperuser = session?.user && (session.user as any).globalRole === 'SUPERUSER'
  const isAdmin = session?.user && (session.user as any).memberships?.some((m: any) => m.role === 'ADMIN')
  const canSeeDocsLink = Boolean(isSuperuser || isAdmin)

  // `params.id` is ambiguous: it is the surgery id on `/s/[id]/...`, but it is the symptom id on `/symptom/[id]`.
  // Use the pathname to decide which value is safe to treat as a surgery id.
  const surgeryId =
    pathname.startsWith('/s/')
      ? ((params as Record<string, string | string[] | undefined>)?.id as string | undefined)
      : pathname.startsWith('/symptom/')
        ? (searchParams.get('surgery') || undefined)
        : undefined

  const logoHref = surgeryId ? `/s/${surgeryId}` : '/s'

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

            {/* Practice Handbook Link - visible when enabled for this surgery */}
            {currentSurgeryId && adminToolkitEnabled && (
              <Link
                href={`/s/${currentSurgeryId}/admin-toolkit`}
                prefetch={false}
                className="text-sm text-nhs-grey hover:text-nhs-blue transition-colors"
              >
                Practice Handbook
              </Link>
            )}
            
            {/* Settings Link */}
            <Link 
              href="/admin" 
              prefetch={false}
              className="text-sm text-nhs-grey hover:text-nhs-blue transition-colors"
            >
              Settings
            </Link>
            
            {/* Help & Documentation Link for admins and superusers */}
            {canSeeDocsLink && (
              <a
                href="https://docs.signpostingtool.co.uk/"
                target="_blank"
                rel="noreferrer noopener"
                className="text-sm text-nhs-grey hover:text-nhs-blue transition-colors underline-offset-2 hover:underline"
              >
                Help & Documentation
              </a>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
