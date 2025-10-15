import 'server-only'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/server/auth'
import AdminPageClient from './AdminPageClient'

interface AdminPageProps {
  searchParams: Promise<{
    surgery?: string
  }>
}

export default async function AdminPage({ searchParams }: AdminPageProps) {
  const resolvedSearchParams = await searchParams
  const surgerySlug = resolvedSearchParams.surgery

  // Require authentication
  const session = await requireAuth()

  // Get surgeries for header
  const surgeries = await prisma.surgery.findMany({
    orderBy: { name: 'asc' }
  })

  // Get base symptoms
  const symptoms = await prisma.baseSymptom.findMany({
    orderBy: { name: 'asc' }
  })

  return (
    <AdminPageClient 
      surgeries={surgeries} 
      symptoms={symptoms} 
      session={session}
      currentSurgerySlug={surgerySlug}
    />
  )
}
