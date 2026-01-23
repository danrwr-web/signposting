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

  // Fetch surgery name for the header
  // SimpleHeader will use SurgeryContext if surgery data is not provided,
  // but we fetch it here for consistency and to ensure it's available
  let surgeryName: string | undefined
  try {
    const surgery = await prisma.surgery.findUnique({
      where: { id: surgeryId },
      select: { name: true },
    })
    surgeryName = surgery?.name
  } catch (error) {
    // If DB query fails, SimpleHeader will fall back to SurgeryContext
    console.error('Error loading surgery in layout:', error)
  }

  return (
    <>
      <SimpleHeader surgeryId={surgeryId} surgeryName={surgeryName} />
      {children}
    </>
  )
}
