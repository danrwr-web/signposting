import 'server-only'

import { requireSurgeryAccess, getSessionUser } from '@/lib/rbac'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import SimpleHeader from '@/components/SimpleHeader'
import TemplateStyleDefaultsEditor from '@/components/workflow/TemplateStyleDefaultsEditor'
import SurgeryStyleDefaultsEditor from '@/components/workflow/SurgeryStyleDefaultsEditor'
import TemplateSelector from '@/components/workflow/TemplateSelector'
import { WorkflowNodeStyleDefault, WorkflowNodeStyleDefaultSurgery } from '@prisma/client'
import CopyDefaultsSection from '@/components/workflow/CopyDefaultsSection'

const GLOBAL_SURGERY_ID = 'global-default-buttons'

interface WorkflowAdminStylesPageProps {
  params: Promise<{
    id: string
  }>
  searchParams: Promise<{
    templateId?: string
  }>
}

export default async function WorkflowAdminStylesPage({ params, searchParams }: WorkflowAdminStylesPageProps) {
  const { id: surgeryId } = await params
  const { templateId } = await searchParams

  try {
    const user = await requireSurgeryAccess(surgeryId)
    const sessionUser = await getSessionUser()

    // Check superuser access
    if (!sessionUser || sessionUser.globalRole !== 'SUPERUSER') {
      redirect('/unauthorized')
    }

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

    // Get all templates for this surgery (for selector)
    const templates = await prisma.workflowTemplate.findMany({
      where: {
        surgeryId,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
      },
      orderBy: {
        name: 'asc',
      }
    })

    // Get surgery-level style defaults
    const surgeryDefaults = await prisma.workflowNodeStyleDefaultSurgery.findMany({
      where: { surgeryId },
      select: {
        nodeType: true,
        bgColor: true,
        textColor: true,
        borderColor: true,
      },
    })

    // If templateId is provided, fetch template with style defaults
    let selectedTemplate: {
      id: string
      name: string
      styleDefaults: WorkflowNodeStyleDefault[]
    } | null = null

    if (templateId) {
      const template = await prisma.workflowTemplate.findFirst({
        where: {
          id: templateId,
          surgeryId,
        },
        include: {
          styleDefaults: {
            select: {
              nodeType: true,
              bgColor: true,
              textColor: true,
              borderColor: true,
            },
          },
        },
      })

      if (template) {
        selectedTemplate = {
          id: template.id,
          name: template.name,
          styleDefaults: template.styleDefaults,
        }
      }
    }

    return (
      <div className="min-h-screen bg-gray-50">
        <SimpleHeader surgeryId={surgeryId} surgeryName={surgery.name} />
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-semibold text-gray-900 mb-2 tracking-tight">
              Node styling defaults
            </h1>
            <p className="text-base text-gray-600 leading-relaxed">
              Sets default colours per node type for this template. Individual nodes with custom colours won&apos;t change.
            </p>
          </div>

          {/* Surgery Defaults Editor */}
          <SurgeryStyleDefaultsEditor
            surgeryId={surgeryId}
            styleDefaults={surgeryDefaults || []}
            isSuperuser={true}
          />

          {/* Template Selector */}
          <TemplateSelector
            surgeryId={surgeryId}
            templates={templates}
            selectedTemplateId={templateId}
          />

          {/* Selected Template Info */}
          {selectedTemplate && (
            <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500 mb-1">Template:</p>
                  <p className="text-lg font-semibold text-gray-900">{selectedTemplate.name}</p>
                </div>
                <Link
                  href={`/s/${surgeryId}/workflow/templates/${selectedTemplate.id}/view`}
                  className="text-sm font-medium text-blue-600 hover:text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-md px-3 py-1.5 transition-colors"
                >
                  View this template →
                </Link>
              </div>
            </div>
          )}

          {/* Template Style Defaults Editor */}
          {selectedTemplate ? (
            <>
              <TemplateStyleDefaultsEditor
                surgeryId={surgeryId}
                templateId={selectedTemplate.id}
                styleDefaults={selectedTemplate.styleDefaults || []}
                isSuperuser={true}
              />
              
              {/* Copy Defaults Section */}
              <CopyDefaultsSection
                surgeryId={surgeryId}
                targetTemplateId={selectedTemplate.id}
                allTemplates={templates}
                isSuperuser={true}
              />
            </>
          ) : (
            <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
              <p className="text-gray-500">
                {templates.length === 0
                  ? 'No templates available. Create a template first.'
                  : 'Select a template above to manage its node styling defaults.'}
              </p>
            </div>
          )}
        </div>
      </div>
    )
  } catch (error) {
    console.error('Error loading workflow admin styles page:', error)
    redirect('/unauthorized')
  }
}

