import 'server-only'

import { prisma } from '@/lib/prisma'
import SimpleHeader from '@/components/SimpleHeader'

/**
 * Shared layout for all /s/[id]/... routes.
 * 
 * This layout ensures:
 * - Standard app header (SimpleHeader) is always present
 * - UniversalNavigationPanel is available (from root layout)
 * - Consistent app shell across all surgery-scoped pages
 * 
 * Pages under /s/[id]/... should NOT include SimpleHeader themselves.
 * They should focus on their content only.
 */
export default async function SurgeryLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ id: string }>
}) {
  const { id: surgeryId } = await params

  // Fetch all surgeries for the header selector (enables surgery switching for superusers)
  // and find the current surgery for display
  let surgeries: { id: string; slug: string | null; name: string }[] = []
  try {
    surgeries = await prisma.surgery.findMany({
      select: { id: true, slug: true, name: true },
      orderBy: { name: 'asc' },
    })
  } catch (error) {
    console.error('Error loading surgeries in layout:', error)
  }

  return (
    <>
      <SimpleHeader surgeries={surgeries} currentSurgeryId={surgeryId} />
      {children}
    </>
  )
}
