import 'server-only'

import { requireSurgeryAccess, getSessionUser } from '@/lib/rbac'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import TemplateStyleDefaultsEditor from '@/components/workflow/TemplateStyleDefaultsEditor'
import TemplateSelector from '@/components/workflow/TemplateSelector'
import { WorkflowNodeStyleDefault } from '@prisma/client'

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
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Breadcrumb */}
          <div className="mb-6">
            <Link
              href={`/s/${surgeryId}/workflow`}
              className="text-sm font-medium text-gray-600 hover:text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded"
            >
              ← Back to Workflow Guidance
            </Link>
          </div>

          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-semibold text-gray-900 mb-2 tracking-tight">
              Node Styling Defaults
            </h1>
            <p className="text-base text-gray-600 leading-relaxed">
              Set default styling for workflow nodes by template. These defaults apply to all nodes of each type unless individually customised.
            </p>
          </div>

          {/* Template Selector */}
          <TemplateSelector
            surgeryId={surgeryId}
            templates={templates}
            selectedTemplateId={templateId}
          />

          {/* Template Style Defaults Editor */}
          {selectedTemplate ? (
            <TemplateStyleDefaultsEditor
              surgeryId={surgeryId}
              templateId={selectedTemplate.id}
              styleDefaults={selectedTemplate.styleDefaults || []}
              isSuperuser={true}
            />
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

