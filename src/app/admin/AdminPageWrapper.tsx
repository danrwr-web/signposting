'use client'

import { useEffect, useState } from 'react'
import AdminPageClient from './AdminPageClient'

interface AdminPageWrapperProps {
  surgeries: any[]
  symptoms: any[]
  session: any
  currentSurgerySlug?: string
}

export default function AdminPageWrapper({
  surgeries,
  symptoms,
  session,
  currentSurgerySlug
}: AdminPageWrapperProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-nhs-blue mx-auto mb-4"></div>
          <p className="text-gray-600">Loading settings...</p>
        </div>
      </div>
    )
  }

  return (
    <AdminPageClient 
      surgeries={surgeries} 
      symptoms={symptoms} 
      session={session}
      currentSurgerySlug={currentSurgerySlug}
    />
  )
}
