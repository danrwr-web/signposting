import 'server-only'

import { prisma } from '@/lib/prisma'
import SimpleHeader from '@/components/SimpleHeader'
import { surgeriesForViewer, type ViewerSurgery } from '@/server/viewerSurgeries'
import { getSessionUser } from '@/lib/rbac'

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

  // Surgeries for the header selector (surgery switching for superusers), and
  // the current surgery for display.
  let surgeries: ViewerSurgery[] = []
  try {
    // Scoped to the viewer: this list is a client prop, so it lands in the
    // page source. A member of one practice has no need for the rest.
    surgeries = await surgeriesForViewer(await getSessionUser())
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
