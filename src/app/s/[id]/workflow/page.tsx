import 'server-only'
import { requireSurgeryAccess, can } from '@/lib/rbac'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { getEffectiveWorkflows } from '@/server/effectiveWorkflows'
import { isFeatureEnabledForSurgery } from '@/lib/features'
import { CustomiseWorkflowButton } from '@/components/workflow/CustomiseWorkflowButton'
import type { ReactNode } from 'react'

const GLOBAL_SURGERY_ID = 'global-default-buttons'

type WorkflowFrontPageMeta = {
  whenToUse: string
  icon: (props: { className?: string }) => ReactNode
}

function normaliseWorkflowName(name: string) {
  return name.trim().toLowerCase()
}

function getWorkflowFrontPageMeta(name: string): WorkflowFrontPageMeta {
  const n = normaliseWorkflowName(name)

  // These icons use Heroicons-style outline SVG paths (inlined to avoid extra deps).
  // Keep this mapping easy to extend.
  const icons = {
    chatBubble: ({ className }: { className?: string }) => (
      <svg
        className={className}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M8 10h8M8 14h5" />
        <path d="M21 12a8 8 0 0 1-8 8H7l-4 3V12a8 8 0 0 1 8-8h2a8 8 0 0 1 8 8Z" />
      </svg>
    ),
    documentText: ({ className }: { className?: string }) => (
      <svg
        className={className}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M19.5 14.25V6.75a2.25 2.25 0 0 0-2.25-2.25h-7.5A2.25 2.25 0 0 0 7.5 6.75v10.5a2.25 2.25 0 0 0 2.25 2.25H15" />
        <path d="M12 8.25h3.75M12 12h3.75M9.75 15.75H15" />
      </svg>
    ),
    arrowDownTray: ({ className }: { className?: string }) => (
      <svg
        className={className}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M12 3v10.5m0 0 3.75-3.75M12 13.5 8.25 9.75" />
        <path d="M4.5 15.75v3A2.25 2.25 0 0 0 6.75 21h10.5a2.25 2.25 0 0 0 2.25-2.25v-3" />
      </svg>
    ),
    briefcase: ({ className }: { className?: string }) => (
      <svg
        className={className}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M9 6.75A2.25 2.25 0 0 1 11.25 4.5h1.5A2.25 2.25 0 0 1 15 6.75V7.5H9v-.75Z" />
        <path d="M3.75 7.5h16.5A1.5 1.5 0 0 1 21.75 9v9.75A2.25 2.25 0 0 1 19.5 21H4.5a2.25 2.25 0 0 1-2.25-2.25V9A1.5 1.5 0 0 1 3.75 7.5Z" />
        <path d="M8.25 12h7.5" />
      </svg>
    ),
    beaker: ({ className }: { className?: string }) => (
      <svg
        className={className}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M9 3h6" />
        <path d="M10 3v6.5l-4.6 7.6A3.75 3.75 0 0 0 8.6 22h6.8a3.75 3.75 0 0 0 3.2-4.9L14 9.5V3" />
        <path d="M8.25 14.25h7.5" />
      </svg>
    ),
    shieldCheck: ({ className }: { className?: string }) => (
      <svg
        className={className}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M12 3 20 7v5c0 5-3.5 9-8 10-4.5-1-8-5-8-10V7l8-4Z" />
        <path d="m9 12 2 2 4-4" />
      </svg>
    ),
    clipboard: ({ className }: { className?: string }) => (
      <svg
        className={className}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M9 5.25A2.25 2.25 0 0 1 11.25 3h1.5A2.25 2.25 0 0 1 15 5.25V6h1.5A2.25 2.25 0 0 1 18.75 8.25v10.5A2.25 2.25 0 0 1 16.5 21h-9A2.25 2.25 0 0 1 5.25 18.75V8.25A2.25 2.25 0 0 1 7.5 6H9v-.75Z" />
        <path d="M9.75 11.25h4.5M9.75 15h4.5" />
      </svg>
    ),
  } as const

  if (n === 'advice & guidance' || n === 'advice and guidance') {
    return { icon: icons.chatBubble, whenToUse: 'When you receive an Advice & Guidance response or request.' }
  }
  if (n === 'clinic letters' || n === 'clinic letter') {
    return { icon: icons.documentText, whenToUse: 'When a hospital or community clinic letter arrives.' }
  }
  if (n === 'discharge summaries' || n === 'discharge summary') {
    return { icon: icons.arrowDownTray, whenToUse: 'When a patient is discharged and paperwork needs actioning.' }
  }
  if (n === 'private provider requests' || n === 'private provider request') {
    return { icon: icons.briefcase, whenToUse: 'When a private provider asks for information or next steps.' }
  }
  if (n === 'blood test requests' || n === 'blood test request') {
    return { icon: icons.beaker, whenToUse: 'When a blood test request needs booking, filing, or review.' }
  }
  if (n === 'firearms licensing request' || n === 'firearms licensing') {
    return { icon: icons.shieldCheck, whenToUse: 'When a firearms licensing form or request is received.' }
  }
  if (n === 'gp review' || n === 'gp review workflow') {
    return { icon: icons.clipboard, whenToUse: 'When a document needs a GP to review and decide next steps.' }
  }

  return { icon: icons.documentText, whenToUse: 'When you need step-by-step guidance for this document.' }
}

interface WorkflowDashboardPageProps {
  params: Promise<{
    id: string
  }>
}

interface WorkflowTemplateWithCategory {
  id: string
  name: string
  description: string | null
  landingCategory: string
  isDependent: boolean
  source: 'global' | 'override' | 'custom'
  sourceTemplateId: string | null
  approvalStatus: string
}

export default async function WorkflowDashboardPage({ params }: WorkflowDashboardPageProps) {
  const { id: surgeryId } = await params

  try {
    const user = await requireSurgeryAccess(surgeryId)

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

    // Check if workflow guidance feature is enabled for this surgery
    const workflowsEnabled = await isFeatureEnabledForSurgery(surgeryId, 'workflow_guidance')
    const isAdmin = can(user).isAdminOfSurgery(surgeryId)
    const isSuperuser = user.globalRole === 'SUPERUSER'
    const isGlobalSurgery = surgeryId === GLOBAL_SURGERY_ID
    
    // Allow admins to access even if workflows aren't enabled (so they can enable them)
    // For non-admins, show a message if workflows aren't enabled
    if (!workflowsEnabled && !isAdmin) {
      return (
        <div className="min-h-screen bg-white">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-yellow-700">
                    <strong>Workflows are not enabled for {surgery.name}.</strong> Please contact an administrator to enable the workflow module.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )
    }

    // Get effective workflows (resolves global defaults, overrides, and custom)
    // 
    // Draft visibility rules:
    // - Admins: Can see both DRAFT and APPROVED workflows (includeDrafts=true)
    // - Staff: Can only see APPROVED workflows (includeDrafts=false)
    // This ensures staff never see unapproved content, while admins can manage drafts safely.
    const effectiveWorkflows = await getEffectiveWorkflows(surgeryId, {
      includeDrafts: isAdmin, // Admins can see drafts, staff cannot
      includeInactive: false,
    })

    // Defensive de-duplication (and protects Global Default surgery view).
    // We always want each workflow to appear once on the landing page.
    const uniqueEffectiveWorkflows = Array.from(
      new Map(effectiveWorkflows.map((w) => [w.id, w])).values(),
    )

    // Get linkedFromNodes count for each workflow to identify dependent workflows
    const workflowIds = uniqueEffectiveWorkflows.map(w => w.id)
    const linkedCounts = await prisma.workflowNodeLink.groupBy({
      by: ['templateId'],
      where: {
        templateId: { in: workflowIds },
      },
      _count: {
        _all: true,
      },
    })
    const linkedCountMap = new Map(linkedCounts.map(l => [l.templateId, l._count._all]))

    // Classify workflows using workflowType field
    const workflows: WorkflowTemplateWithCategory[] = uniqueEffectiveWorkflows.map((template) => {
      const isDependent = (linkedCountMap.get(template.id) ?? 0) > 0
      const workflowType = (template.workflowType as 'PRIMARY' | 'SUPPORTING' | 'MODULE') || 'SUPPORTING'

      return {
        id: template.id,
        name: template.name,
        description: template.description,
        landingCategory: workflowType,
        isDependent,
        source: template.source,
        sourceTemplateId: template.sourceTemplateId,
        approvalStatus: template.approvalStatus,
      }
    })

    // Separate workflows by type - workflowType is the single source of truth
    const primaryWorkflows = workflows.filter(w => w.landingCategory === 'PRIMARY')
    const supportingWorkflows = workflows.filter(w => w.landingCategory === 'SUPPORTING')
    const moduleWorkflows = workflows.filter(w => w.landingCategory === 'MODULE')

    const dailyWorkflowNames = new Set([
      'advice & guidance',
      'advice and guidance',
      'clinic letters',
      'discharge summaries',
      'private provider requests',
    ])

    const specialistWorkflowNames = new Set([
      'blood test requests',
      'firearms licensing request',
      'gp review',
    ])

    const mainWorkflows = [...primaryWorkflows, ...supportingWorkflows]
    const dailyWorkflows = mainWorkflows.filter(w => dailyWorkflowNames.has(normaliseWorkflowName(w.name)))
    const specialistWorkflows = mainWorkflows.filter(w => specialistWorkflowNames.has(normaliseWorkflowName(w.name)))
    const otherMainWorkflows = mainWorkflows.filter(
      (w) =>
        !dailyWorkflowNames.has(normaliseWorkflowName(w.name)) &&
        !specialistWorkflowNames.has(normaliseWorkflowName(w.name)),
    )

    return (
      <div className="min-h-screen bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
          <div className="mb-6">
            <Link
              href={`/s/${surgeryId}`}
              className="text-sm font-medium text-gray-600 hover:text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded"
            >
              ← Back to Signposting
            </Link>
          </div>
          {/* Admin warning if workflows not enabled */}
          {isAdmin && !workflowsEnabled && (
            <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mb-6">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-blue-700">
                    <strong>Workflows are not enabled for {surgery.name}.</strong> Workflows will not be visible to staff until enabled. You can still manage workflows as an admin.
                  </p>
                </div>
              </div>
            </div>
          )}
          
          {/* Header */}
          <div className="mb-10">
            <h1 className="text-3xl sm:text-4xl font-semibold text-gray-900 mb-3 tracking-tight">
              What type of document are you processing?
            </h1>
            <p className="text-base sm:text-lg text-gray-600 max-w-2xl leading-relaxed">
              Choose a workflow below to see the exact steps to follow.
            </p>
          </div>

          {/* Main workflow sections */}
          {dailyWorkflows.length > 0 && (
            <section className="mb-12" aria-labelledby="daily-workflows-heading">
              <div className="flex items-baseline justify-between gap-4 mb-4">
                <h2 id="daily-workflows-heading" className="text-lg font-semibold text-gray-900">
                  Common documents (daily)
                </h2>
                <p className="text-sm text-gray-500">
                  {surgery.name}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {dailyWorkflows.map((workflow) => {
                  const meta = getWorkflowFrontPageMeta(workflow.name)
                  const Icon = meta.icon
                  const isCustomised = !isGlobalSurgery && (workflow.source === 'override' || workflow.source === 'custom')
                  const isGlobalDefault = !isGlobalSurgery && workflow.source === 'global'
                  const whenToUse = workflow.description?.trim() ? workflow.description : meta.whenToUse

                  return (
                    <div
                      key={workflow.id}
                      className="group bg-white rounded-xl border border-gray-200 p-5 hover:border-gray-300 hover:shadow-sm transition-all"
                    >
                      <div className="flex items-start gap-4">
                        <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-lg bg-gray-50 text-gray-700 border border-gray-100">
                          <Icon className="h-5 w-5" />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-base sm:text-lg font-semibold text-gray-900 group-hover:text-blue-700 transition-colors">
                              {workflow.name}
                            </h3>

                            {workflow.landingCategory === 'PRIMARY' && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100">
                                Primary
                              </span>
                            )}

                            {workflow.approvalStatus === 'DRAFT' && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                                Draft (not visible to staff)
                              </span>
                            )}

                            {isCustomised && (
                              <span
                                title="This workflow has been adapted for your surgery."
                                className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200"
                              >
                                Customised
                              </span>
                            )}

                            {isGlobalDefault && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700">
                                Global default
                              </span>
                            )}
                          </div>

                          <p className="mt-1 text-sm text-gray-600 line-clamp-1">
                            {whenToUse}
                          </p>

                          <div className="mt-4 flex items-center gap-3">
                            <Link
                              href={`/s/${surgeryId}/workflow/templates/${workflow.id}/view`}
                              className="inline-flex items-center justify-center px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                            >
                              Start workflow
                              <svg className="ml-2 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                            </Link>

                            {isAdmin && !isGlobalSurgery && workflow.source === 'global' && (
                              <CustomiseWorkflowButton
                                surgeryId={surgeryId}
                                globalTemplateId={workflow.id}
                                workflowName={workflow.name}
                              />
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          )}

          {(specialistWorkflows.length > 0 || otherMainWorkflows.length > 0) && (
            <section className="mb-12" aria-labelledby="specialist-workflows-heading">
              <h2 id="specialist-workflows-heading" className="text-lg font-semibold text-gray-900 mb-4">
                Less common / specialist
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[...specialistWorkflows, ...otherMainWorkflows].map((workflow) => {
                  const meta = getWorkflowFrontPageMeta(workflow.name)
                  const Icon = meta.icon
                  const isCustomised = !isGlobalSurgery && (workflow.source === 'override' || workflow.source === 'custom')
                  const isGlobalDefault = !isGlobalSurgery && workflow.source === 'global'
                  const whenToUse = workflow.description?.trim() ? workflow.description : meta.whenToUse

                  return (
                    <div
                      key={workflow.id}
                      className="group bg-white rounded-xl border border-gray-200 p-5 hover:border-gray-300 hover:shadow-sm transition-all"
                    >
                      <div className="flex items-start gap-4">
                        <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-lg bg-gray-50 text-gray-700 border border-gray-100">
                          <Icon className="h-5 w-5" />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-base sm:text-lg font-semibold text-gray-900 group-hover:text-blue-700 transition-colors">
                              {workflow.name}
                            </h3>

                            {workflow.landingCategory === 'PRIMARY' && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100">
                                Primary
                              </span>
                            )}

                            {workflow.approvalStatus === 'DRAFT' && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                                Draft (not visible to staff)
                              </span>
                            )}

                            {isCustomised && (
                              <span
                                title="This workflow has been adapted for your surgery."
                                className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200"
                              >
                                Customised
                              </span>
                            )}

                            {isGlobalDefault && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700">
                                Global default
                              </span>
                            )}
                          </div>

                          <p className="mt-1 text-sm text-gray-600 line-clamp-1">
                            {whenToUse}
                          </p>

                          <div className="mt-4 flex items-center gap-3">
                            <Link
                              href={`/s/${surgeryId}/workflow/templates/${workflow.id}/view`}
                              className="inline-flex items-center justify-center px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                            >
                              Start workflow
                              <svg className="ml-2 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                            </Link>

                            {isAdmin && !isGlobalSurgery && workflow.source === 'global' && (
                              <CustomiseWorkflowButton
                                surgeryId={surgeryId}
                                globalTemplateId={workflow.id}
                                workflowName={workflow.name}
                              />
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          )}

          {/* Linked Modules - Very Subdued */}
          {moduleWorkflows.length > 0 && (
            <section className="mb-16" aria-labelledby="module-workflows-heading">
              <h2 id="module-workflows-heading" className="text-sm font-medium text-gray-400 mb-4 uppercase tracking-wide">
                Linked Modules
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {moduleWorkflows.map((template) => (
                  <div
                    key={template.id}
                    className="group bg-gray-50 rounded-lg border border-gray-100 p-4 hover:bg-white hover:border-gray-200 transition-all duration-200"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Link
                            href={`/s/${surgeryId}/workflow/templates/${template.id}/view`}
                            className="text-sm font-medium text-gray-700 group-hover:text-gray-900 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded"
                          >
                            {template.name}
                          </Link>
                          {template.approvalStatus === 'DRAFT' && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                              Draft
                            </span>
                          )}
                          {!isGlobalSurgery && template.source === 'global' && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">
                              Global Default
                            </span>
                          )}
                          {template.source === 'override' && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-700">
                              Customised
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-gray-400 group-hover:text-gray-600 transition-colors">
                          View →
                        </span>
                      </div>
                      {isAdmin && !isGlobalSurgery && template.source === 'global' && (
                        <CustomiseWorkflowButton
                          surgeryId={surgeryId}
                          globalTemplateId={template.id}
                          workflowName={template.name}
                        />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Empty State */}
          {primaryWorkflows.length === 0 && supportingWorkflows.length === 0 && moduleWorkflows.length === 0 && (
            <div className="bg-gray-50 rounded-xl border border-gray-200 p-12 text-center">
              <p className="text-gray-500 mb-4">No workflow templates available.</p>
              {isAdmin && (
                <Link
                  href={`/s/${surgeryId}/workflow/templates`}
                  className="inline-flex items-center text-sm font-medium text-blue-600 hover:text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-md px-4 py-2"
                >
                  Create a template to get started
                </Link>
              )}
            </div>
          )}

          {/* Admin Tools - Visually Quiet */}
          {isAdmin && (
            <section className="mt-24 pt-10 border-t border-gray-100" aria-labelledby="admin-tools-heading">
              <h2 id="admin-tools-heading" className="text-xs font-medium text-gray-400 mb-4 uppercase tracking-wide">
                Admin Tools
              </h2>
              <div className="flex flex-wrap gap-4">
                <Link
                  href={`/s/${surgeryId}/workflow/templates`}
                  className="text-sm text-gray-500 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-md px-3 py-1.5 transition-colors"
                >
                  Manage Templates
                </Link>
                {isSuperuser && (
                  <Link
                    href={`/s/${surgeryId}/workflow/admin/styles`}
                    className="text-sm text-gray-500 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-md px-3 py-1.5 transition-colors"
                  >
                    Node styling defaults
                  </Link>
                )}
              </div>
            </section>
          )}
        </div>
      </div>
    )
  } catch (error) {
    console.error('[WorkflowDashboard] Error:', error)
    redirect('/unauthorized')
  }
}

