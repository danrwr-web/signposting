'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CustomiseWorkflowButton } from '@/components/workflow/CustomiseWorkflowButton'

type WorkflowSource = 'global' | 'override' | 'custom'

export type WorkflowLandingItem = {
  id: string
  name: string
  description: string | null
  landingCategory: string
  source: WorkflowSource
  approvalStatus: string
}

type IconKey =
  | 'chatBubble'
  | 'documentText'
  | 'arrowDownTray'
  | 'briefcase'
  | 'beaker'
  | 'shieldCheck'
  | 'clipboard'

type WorkflowFrontPageMeta = {
  iconKey: IconKey
  whenToUse: string
}

function normalise(text: string) {
  return text.trim().toLowerCase()
}

function getWorkflowFrontPageMeta(name: string): WorkflowFrontPageMeta {
  const n = normalise(name)

  if (n === 'advice & guidance' || n === 'advice and guidance') {
    return { iconKey: 'chatBubble', whenToUse: 'When you receive an Advice & Guidance response or request.' }
  }
  if (n === 'clinic letters' || n === 'clinic letter') {
    return { iconKey: 'documentText', whenToUse: 'When a hospital or community clinic letter arrives.' }
  }
  if (n === 'discharge summaries' || n === 'discharge summary') {
    return { iconKey: 'arrowDownTray', whenToUse: 'When a patient is discharged and paperwork needs actioning.' }
  }
  if (n === 'private provider requests' || n === 'private provider request') {
    return { iconKey: 'briefcase', whenToUse: 'When a private provider asks for information or next steps.' }
  }
  if (n === 'blood test requests' || n === 'blood test request') {
    return { iconKey: 'beaker', whenToUse: 'When a blood test request needs booking, filing, or review.' }
  }
  if (n === 'firearms licensing request' || n === 'firearms licensing') {
    return { iconKey: 'shieldCheck', whenToUse: 'When a firearms licensing form or request is received.' }
  }
  if (n === 'gp review' || n === 'gp review workflow') {
    return { iconKey: 'clipboard', whenToUse: 'When a document needs a GP to review and decide next steps.' }
  }

  return { iconKey: 'documentText', whenToUse: 'When you need step-by-step guidance for this document.' }
}

function Icon({ iconKey, className }: { iconKey: IconKey; className?: string }) {
  const baseProps = {
    className,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.5,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  }

  switch (iconKey) {
    case 'chatBubble':
      return (
        <svg {...baseProps}>
          <path d="M8 10h8M8 14h5" />
          <path d="M21 12a8 8 0 0 1-8 8H7l-4 3V12a8 8 0 0 1 8-8h2a8 8 0 0 1 8 8Z" />
        </svg>
      )
    case 'documentText':
      return (
        <svg {...baseProps}>
          <path d="M19.5 14.25V6.75a2.25 2.25 0 0 0-2.25-2.25h-7.5A2.25 2.25 0 0 0 7.5 6.75v10.5a2.25 2.25 0 0 0 2.25 2.25H15" />
          <path d="M12 8.25h3.75M12 12h3.75M9.75 15.75H15" />
        </svg>
      )
    case 'arrowDownTray':
      return (
        <svg {...baseProps}>
          <path d="M12 3v10.5m0 0 3.75-3.75M12 13.5 8.25 9.75" />
          <path d="M4.5 15.75v3A2.25 2.25 0 0 0 6.75 21h10.5a2.25 2.25 0 0 0 2.25-2.25v-3" />
        </svg>
      )
    case 'briefcase':
      return (
        <svg {...baseProps}>
          <path d="M9 6.75A2.25 2.25 0 0 1 11.25 4.5h1.5A2.25 2.25 0 0 1 15 6.75V7.5H9v-.75Z" />
          <path d="M3.75 7.5h16.5A1.5 1.5 0 0 1 21.75 9v9.75A2.25 2.25 0 0 1 19.5 21H4.5a2.25 2.25 0 0 1-2.25-2.25V9A1.5 1.5 0 0 1 3.75 7.5Z" />
          <path d="M8.25 12h7.5" />
        </svg>
      )
    case 'beaker':
      return (
        <svg {...baseProps}>
          <path d="M9 3h6" />
          <path d="M10 3v6.5l-4.6 7.6A3.75 3.75 0 0 0 8.6 22h6.8a3.75 3.75 0 0 0 3.2-4.9L14 9.5V3" />
          <path d="M8.25 14.25h7.5" />
        </svg>
      )
    case 'shieldCheck':
      return (
        <svg {...baseProps}>
          <path d="M12 3 20 7v5c0 5-3.5 9-8 10-4.5-1-8-5-8-10V7l8-4Z" />
          <path d="m9 12 2 2 4-4" />
        </svg>
      )
    case 'clipboard':
      return (
        <svg {...baseProps}>
          <path d="M9 5.25A2.25 2.25 0 0 1 11.25 3h1.5A2.25 2.25 0 0 1 15 5.25V6h1.5A2.25 2.25 0 0 1 18.75 8.25v10.5A2.25 2.25 0 0 1 16.5 21h-9A2.25 2.25 0 0 1 5.25 18.75V8.25A2.25 2.25 0 0 1 7.5 6H9v-.75Z" />
          <path d="M9.75 11.25h4.5M9.75 15h4.5" />
        </svg>
      )
  }
}

function matchesSearch(workflow: WorkflowLandingItem, query: string) {
  const meta = getWorkflowFrontPageMeta(workflow.name)
  const whenToUse = workflow.description?.trim() ? workflow.description : meta.whenToUse
  const haystack = `${workflow.name} ${whenToUse}`.toLowerCase()
  return haystack.includes(query)
}

function WorkflowCard({
  surgeryId,
  workflow,
  canCustomiseWorkflows,
  isGlobalSurgery,
}: {
  surgeryId: string
  workflow: WorkflowLandingItem
  canCustomiseWorkflows: boolean
  isGlobalSurgery: boolean
}) {
  const router = useRouter()
  const href = `/s/${surgeryId}/workflow/templates/${workflow.id}/view`
  const meta = getWorkflowFrontPageMeta(workflow.name)

  const isCustomised = !isGlobalSurgery && (workflow.source === 'override' || workflow.source === 'custom')
  const statusLabel = isCustomised ? 'Customised' : 'Standard'
  const statusTooltip = isCustomised
    ? 'This workflow has been adapted for your surgery.'
    : 'This is the default workflow template.'

  const whenToUse = (workflow.description?.trim() ? workflow.description : meta.whenToUse).trim()

  const navigate = () => {
    router.push(href)
  }

  return (
    <div
      role="link"
      tabIndex={0}
      aria-label={`Start workflow: ${workflow.name}`}
      onClick={(e) => {
        const target = e.target as HTMLElement
        if (target.closest('[data-stop-card-nav="true"]')) return
        navigate()
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          navigate()
        }
      }}
      className="group relative bg-white rounded-xl border border-gray-200 p-6 hover:border-gray-300 hover:shadow-sm transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4 min-w-0">
          <div className="mt-0.5 flex h-11 w-11 items-center justify-center rounded-lg bg-gray-50 text-gray-700 border border-gray-100 flex-none">
            <Icon iconKey={meta.iconKey} className="h-5 w-5" />
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 group-hover:text-blue-700 transition-colors">
                {workflow.name}
              </h3>

              {workflow.approvalStatus === 'DRAFT' && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                  Draft (not visible to staff)
                </span>
              )}

              <span
                title={statusTooltip}
                className={
                  isCustomised
                    ? 'inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200'
                    : 'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700'
                }
              >
                {statusLabel}
              </span>
            </div>

            <p className="mt-1 text-sm text-gray-600 line-clamp-1" title={whenToUse}>
              {whenToUse}
            </p>
          </div>
        </div>

        {canCustomiseWorkflows && !isGlobalSurgery && workflow.source === 'global' ? (
          <div className="flex-none" data-stop-card-nav="true">
            <CustomiseWorkflowButton
              surgeryId={surgeryId}
              globalTemplateId={workflow.id}
              workflowName={workflow.name}
              variant="compact"
            />
          </div>
        ) : (
          <div className="flex-none" aria-hidden="true" />
        )}
      </div>

      <div className="mt-4 flex items-center gap-3" data-stop-card-nav="true">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            navigate()
          }}
          className="inline-flex items-center justify-center px-4 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          Start workflow
          <svg className="ml-2 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  )
}

export default function WorkflowLandingClient({
  surgeryId,
  surgeryName,
  isGlobalSurgery,
  canCustomiseWorkflows,
  workflows,
}: {
  surgeryId: string
  surgeryName: string
  isGlobalSurgery: boolean
  canCustomiseWorkflows: boolean
  workflows: WorkflowLandingItem[]
}) {
  const [search, setSearch] = useState('')

  const dailyWorkflowNames = useMemo(
    () =>
      new Set([
        'advice & guidance',
        'advice and guidance',
        'clinic letters',
        'discharge summaries',
        'private provider requests',
      ]),
    [],
  )

  const specialistWorkflowNames = useMemo(
    () => new Set(['blood test requests', 'firearms licensing request', 'gp review']),
    [],
  )

  const normalisedQuery = normalise(search)

  const filtered = useMemo(() => {
    if (!normalisedQuery) return workflows
    return workflows.filter((w) => matchesSearch(w, normalisedQuery))
  }, [workflows, normalisedQuery])

  const dailyWorkflows = useMemo(
    () => filtered.filter((w) => dailyWorkflowNames.has(normalise(w.name))),
    [filtered, dailyWorkflowNames],
  )

  const specialistWorkflows = useMemo(
    () => filtered.filter((w) => specialistWorkflowNames.has(normalise(w.name))),
    [filtered, specialistWorkflowNames],
  )

  const otherWorkflows = useMemo(
    () =>
      filtered.filter(
        (w) => !dailyWorkflowNames.has(normalise(w.name)) && !specialistWorkflowNames.has(normalise(w.name)),
      ),
    [filtered, dailyWorkflowNames, specialistWorkflowNames],
  )

  const hasResults = dailyWorkflows.length + specialistWorkflows.length + otherWorkflows.length > 0

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl sm:text-4xl font-semibold text-gray-900 mb-3 tracking-tight">
          What type of document are you processing?
        </h1>
        <p className="text-base sm:text-lg text-gray-600 max-w-2xl leading-relaxed">
          Choose a workflow below to see the exact steps to follow.
        </p>
        {!isGlobalSurgery && (
          <p className="mt-2 text-sm text-gray-500">
            Surgery: <span className="font-medium text-gray-700">{surgeryName}</span>
          </p>
        )}

        <div className="mt-5 flex flex-col sm:flex-row gap-3 sm:items-center">
          <div className="w-full sm:max-w-md">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </div>
              <input
                type="text"
                inputMode="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search workflows…"
                aria-label="Search workflows"
                className="block w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              />
            </div>
          </div>
          {search.trim() && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="text-sm text-gray-600 hover:text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-md px-3 py-2.5 transition-colors self-start"
            >
              Clear search
            </button>
          )}
        </div>
      </div>

      {!hasResults ? (
        <div className="bg-gray-50 rounded-xl border border-gray-200 p-8 sm:p-10">
          <h2 className="text-base font-semibold text-gray-900 mb-1">No workflows found</h2>
          <p className="text-sm text-gray-600 mb-4">Try a different search term, or clear your search.</p>
          <button
            type="button"
            onClick={() => setSearch('')}
            className="inline-flex items-center justify-center px-4 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Clear search
          </button>
        </div>
      ) : (
        <div className="space-y-10">
          {dailyWorkflows.length > 0 && (
            <section aria-labelledby="daily-workflows-heading">
              <h2 id="daily-workflows-heading" className="text-lg font-semibold text-gray-900 mb-4">
                Common documents (daily)
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {dailyWorkflows.map((workflow) => (
                  <WorkflowCard
                    key={workflow.id}
                    surgeryId={surgeryId}
                    workflow={workflow}
                    canCustomiseWorkflows={canCustomiseWorkflows}
                    isGlobalSurgery={isGlobalSurgery}
                  />
                ))}
              </div>
            </section>
          )}

          {(specialistWorkflows.length > 0 || otherWorkflows.length > 0) && (
            <section aria-labelledby="specialist-workflows-heading">
              <h2 id="specialist-workflows-heading" className="text-lg font-semibold text-gray-900 mb-4">
                Less common / specialist
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[...specialistWorkflows, ...otherWorkflows].map((workflow) => (
                  <WorkflowCard
                    key={workflow.id}
                    surgeryId={surgeryId}
                    workflow={workflow}
                    canCustomiseWorkflows={canCustomiseWorkflows}
                    isGlobalSurgery={isGlobalSurgery}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  )
}

