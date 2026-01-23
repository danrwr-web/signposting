import 'server-only'
import { requireSurgeryAccess } from '@/lib/rbac'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import SimpleHeader from '@/components/SimpleHeader'
import { startWorkflowInstance } from '../actions'
import StartWorkflowClient from './StartWorkflowClient'

interface StartWorkflowPageProps {
  params: Promise<{
    id: string
  }>
  searchParams: Promise<{
    error?: string
  }>
}

export default async function StartWorkflowPage({ params, searchParams }: StartWorkflowPageProps) {
  const { id: surgeryId } = await params
  const { error } = await searchParams

  try {
    await requireSurgeryAccess(surgeryId)

    // Get surgery details
    const surgery = await prisma.surgery.findUnique({
      where: { id: surgeryId },
      select: {
        id: true,
        name: true,
      }
    })

    if (!surgery) {
      redirect('/unauthorized')
    }

    // Get active templates
    const templates = await prisma.workflowTemplate.findMany({
      where: {
        surgeryId,
        isActive: true,
      },
      orderBy: {
        name: 'asc',
      },
      select: {
        id: true,
        name: true,
        description: true,
      }
    })

    return (
      <div className="min-h-screen bg-gray-50">
        <SimpleHeader surgeryId={surgeryId} surgeryName={surgery.name} />
        <StartWorkflowClient
          surgeryId={surgeryId}
          surgeryName={surgery.name}
          templates={templates}
          startAction={startWorkflowInstance.bind(null, surgeryId)}
          initialError={error}
        />
      </div>
    )
  } catch (error) {
    redirect('/unauthorized')
  }
}

