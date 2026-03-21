'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button, Card, Dialog, AlertBanner, Badge } from '@/components/ui'

type ChecklistData = {
  onboardingCompleted: boolean
  appointmentModelConfigured: boolean
  aiCustomisationRun: boolean
  pendingReviewCount: number
  standardUsersCount: number
  highRiskConfigured: boolean
  highlightsEnabled: boolean
  appointmentTypeCount: number
  handbookItemCount: number
}

type ResetState =
  | 'fresh'
  | 'checklist-started'
  | 'mid-setup'
  | 'nearly-there'
  | 'fully-complete'

interface StateOption {
  id: ResetState
  label: string
  description: string
  essentialCount: string
  variant: 'danger' | 'secondary' | 'primary'
}

const STATE_OPTIONS: StateOption[] = [
  {
    id: 'fresh',
    label: 'Fresh',
    description:
      'No steps complete. Welcome banner showing. No users except the admin account. Questionnaire not started.',
    essentialCount: '0/6',
    variant: 'danger',
  },
  {
    id: 'checklist-started',
    label: 'Checklist Started',
    description:
      'High-risk buttons enabled and one standard user added. Questionnaire not started.',
    essentialCount: '2/6',
    variant: 'secondary',
  },
  {
    id: 'mid-setup',
    label: 'Mid-Setup',
    description:
      'High-risk, users, questionnaire, and appointment model done. AI customisation not run. 15+ symptoms pending clinical review.',
    essentialCount: '4/6',
    variant: 'secondary',
  },
  {
    id: 'nearly-there',
    label: 'Nearly There',
    description:
      'All 6 essential steps complete. Success banner visible. Recommended steps (highlights, appointments, handbook) incomplete.',
    essentialCount: '6/6',
    variant: 'primary',
  },
  {
    id: 'fully-complete',
    label: 'Fully Complete',
    description:
      'All essential and recommended steps complete. Surgery health dashboard showing.',
    essentialCount: '6/6 + 3/3',
    variant: 'primary',
  },
]

interface DeveloperResetPanelProps {
  surgeryId: string
  checklist: ChecklistData
}

export default function DeveloperResetPanel({
  surgeryId,
  checklist,
}: DeveloperResetPanelProps) {
  const router = useRouter()
  const [expanded, setExpanded] = useState(false)
  const [confirmState, setConfirmState] = useState<ResetState | null>(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  const currentSteps = [
    { label: 'Practice questionnaire', done: checklist.onboardingCompleted },
    { label: 'Appointment model', done: checklist.appointmentModelConfigured },
    { label: 'Team members', done: checklist.standardUsersCount > 0 },
    { label: 'High-risk buttons', done: checklist.highRiskConfigured },
    { label: 'AI customisation', done: checklist.aiCustomisationRun },
    { label: 'Clinical review', done: checklist.pendingReviewCount < 10 },
    { label: 'Appointment directory', done: checklist.appointmentTypeCount > 0, recommended: true },
    { label: 'Highlight rules', done: checklist.highlightsEnabled, recommended: true },
    { label: 'Practice handbook', done: checklist.handbookItemCount > 0, recommended: true },
  ]

  async function handleReset() {
    if (!confirmState) return
    setLoading(true)
    setResult(null)

    try {
      const res = await fetch('/api/admin/reset-test-surgery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ surgeryId, state: confirmState }),
      })

      const data = await res.json()

      if (!res.ok) {
        setResult({ type: 'error', message: data.error || 'Reset failed' })
      } else {
        setResult({
          type: 'success',
          message: `Reset to "${STATE_OPTIONS.find(s => s.id === confirmState)?.label}" complete.`,
        })
        // Refresh the page data
        router.refresh()
      }
    } catch {
      setResult({ type: 'error', message: 'Network error — could not reach the server.' })
    } finally {
      setLoading(false)
      setConfirmState(null)
    }
  }

  return (
    <div className="mt-10">
      {/* Collapsible header */}
      <button
        type="button"
        onClick={() => setExpanded((prev: boolean) => !prev)}
        className="w-full flex items-center justify-between rounded-lg border-2 border-dashed border-amber-400 bg-amber-50 px-5 py-3 text-left hover:bg-amber-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          <svg className="h-5 w-5 text-amber-600" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
          </svg>
          <span className="font-semibold text-amber-800">Developer Tools</span>
          <Badge color="amber" size="sm">Test Surgery only</Badge>
        </div>
        <svg
          className={`h-5 w-5 text-amber-600 transition-transform ${expanded ? 'rotate-180' : ''}`}
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
        </svg>
      </button>

      {expanded && (
        <div className="mt-3 rounded-lg border-2 border-dashed border-amber-400 bg-white p-5 space-y-6">
          {/* Result banners */}
          {result && (
            <AlertBanner variant={result.type === 'success' ? 'success' : 'error'}>
              {result.message}
            </AlertBanner>
          )}

          {/* Current state summary */}
          <div>
            <h3 className="text-sm font-semibold text-nhs-dark-blue mb-2">Current setup state</h3>
            <div className="flex flex-wrap gap-2">
              {currentSteps.map(step => (
                <span
                  key={step.label}
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${
                    step.done
                      ? 'bg-green-100 text-green-800'
                      : step.recommended
                        ? 'bg-gray-100 text-gray-600'
                        : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {step.done ? (
                    <span className="font-bold">&#10003;</span>
                  ) : (
                    <span className="font-bold">&times;</span>
                  )}
                  {step.label}
                  {step.recommended && (
                    <span className="text-[10px] opacity-70">(rec)</span>
                  )}
                </span>
              ))}
            </div>
          </div>

          {/* Reset buttons */}
          <div>
            <h3 className="text-sm font-semibold text-nhs-dark-blue mb-3">Reset to a predefined state</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {STATE_OPTIONS.map(opt => (
                <Card key={opt.id} elevation="flat" padding="md">
                  <div className="flex flex-col h-full">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-sm text-nhs-dark-blue">{opt.label}</span>
                      <Badge color="blue" size="sm">{opt.essentialCount}</Badge>
                    </div>
                    <p className="text-xs text-nhs-grey mb-3 flex-1">{opt.description}</p>
                    <Button
                      variant={opt.variant}
                      size="sm"
                      onClick={() => {
                        setResult(null)
                        setConfirmState(opt.id)
                      }}
                    >
                      Reset to {opt.label}
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          </div>

          {/* Confirmation dialog */}
          <Dialog
            open={confirmState !== null}
            onClose={() => setConfirmState(null)}
            title="Confirm reset"
            description={`This will modify Test Surgery data and reset it to the "${STATE_OPTIONS.find(s => s.id === confirmState)?.label}" state.`}
            width="md"
            footer={
              <>
                <Button variant="secondary" size="sm" onClick={() => setConfirmState(null)} disabled={loading}>
                  Cancel
                </Button>
                <Button variant="danger" size="sm" onClick={handleReset} loading={loading}>
                  Yes, reset
                </Button>
              </>
            }
          >
            <p className="text-sm text-nhs-grey">
              This will delete and recreate setup data for the Test Surgery. This action is
              destructive but idempotent — running it again will produce the same result.
            </p>
            <p className="text-sm text-nhs-grey mt-2">
              <strong>Only the Test Surgery is affected.</strong> No other surgery data will be modified.
            </p>
          </Dialog>
        </div>
      )}
    </div>
  )
}
