/**
 * The "Suggest improved wording (AI)" preview modal.
 *
 * The AI's output is a starting point, not a verdict: an admin can edit both
 * the brief label and the full instruction in the modal, and it is the EDITED
 * text — not the raw model output — that reaches /api/updateInstruction.
 */
import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import InstructionView from '@/components/InstructionView'

jest.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: jest.fn(), push: jest.fn(), back: jest.fn() }),
  useSearchParams: () => ({ get: () => null }),
}))

const mockSession: { data: any } = { data: null }
jest.mock('next-auth/react', () => ({
  useSession: () => mockSession,
}))

jest.mock('@/context/SurgeryContext', () => ({
  useSurgery: () => ({ currentSurgeryId: 's1' }),
}))

jest.mock('@/context/CardStyleContext', () => ({
  useCardStyle: () => ({ cardStyle: 'default' }),
}))

const toastError = jest.fn()
const toastSuccess = jest.fn()
jest.mock('react-hot-toast', () => {
  const toast = (..._args: any[]) => {}
  ;(toast as any).error = (...args: any[]) => toastError(...args)
  ;(toast as any).success = (...args: any[]) => toastSuccess(...args)
  return { toast }
})

// Stand in for TipTap so the suite can drive the editor as a plain textarea.
jest.mock('@/components/rich-text/RichTextEditor', () => ({
  __esModule: true,
  default: ({ value, onChange, imageUpload }: any) => (
    <textarea
      data-testid="ai-full-editor"
      data-image-upload={JSON.stringify(imageUpload ?? null)}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}))

jest.mock('@/components/SuggestFeatureDialog', () => ({
  __esModule: true,
  default: () => null,
}))

type FetchCall = { url: string; method: string; body?: any }

const AI_SUGGESTION = '<p>Book a <strong>Green Slot</strong> with the ANP.</p>'
const AI_BRIEF = 'Green Slot / ANP'

function installFetchMock() {
  const calls: FetchCall[] = []
  const fetchMock = jest.fn(async (input: any, init?: any) => {
    const url = typeof input === 'string' ? input : input?.url
    const method = (init?.method ?? 'GET').toUpperCase()
    const body = init?.body ? JSON.parse(init.body) : undefined
    calls.push({ url, method, body })

    if (url.startsWith('/api/my/features')) {
      return new Response(
        JSON.stringify({ features: [{ key: 'ai_instructions', enabled: true }] }),
        { status: 200 }
      )
    }
    if (url.startsWith('/api/improveInstruction')) {
      return new Response(
        JSON.stringify({ aiSuggestion: AI_SUGGESTION, aiBrief: AI_BRIEF, model: 'gpt-4o-mini' }),
        { status: 200 }
      )
    }
    return new Response(JSON.stringify({ ok: true, highlights: [] }), { status: 200 })
  })
  // @ts-expect-error override global fetch for test
  global.fetch = fetchMock
  return calls
}

const symptom = () =>
  ({
    id: 'base-1',
    name: 'Earache',
    ageGroup: 'Adult',
    briefInstruction: 'Pharmacy',
    highlightedText: null,
    instructions: null,
    instructionsHtml: '<p>Original advice</p>',
    linkToPage: null,
    source: 'override',
    baseSymptomId: 'base-1',
  }) as any

const practiceAdminSession = {
  user: { globalRole: 'USER', memberships: [{ surgeryId: 's1', role: 'ADMIN' }] },
}

const standardUserSession = {
  user: { globalRole: 'USER', memberships: [{ surgeryId: 's1', role: 'STANDARD' }] },
}

/** Click the AI button and wait for the preview modal to open. */
const openAiModal = async () => {
  const button = await screen.findByRole('button', { name: 'Suggest improved wording (AI)' })
  fireEvent.click(button)
  await screen.findByText('AI Suggestion Preview')
}

describe('AI suggestion preview modal', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockSession.data = practiceAdminSession
  })

  it('opens with the AI output pre-loaded into editable fields', async () => {
    installFetchMock()
    render(<InstructionView symptom={symptom()} surgeryId="s1" />)

    await openAiModal()

    expect(screen.getByText('AI suggestion (editable, not saved)')).toBeInTheDocument()
    expect(screen.getByLabelText('AI brief instruction')).toHaveValue(AI_BRIEF)
    expect(screen.getByTestId('ai-full-editor')).toHaveValue(AI_SUGGESTION)
  })

  it('sends the EDITED full instruction, not the raw AI output', async () => {
    const calls = installFetchMock()
    render(<InstructionView symptom={symptom()} surgeryId="s1" />)

    await openAiModal()
    fireEvent.change(screen.getByTestId('ai-full-editor'), {
      target: { value: '<p>Book a Green Slot with the ANP within 3 working days.</p>' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Apply Full' }))

    await waitFor(() => {
      expect(calls.some((c) => c.url === '/api/updateInstruction')).toBe(true)
    })
    const patch = calls.find((c) => c.url === '/api/updateInstruction')!
    expect(patch.method).toBe('PATCH')
    expect(patch.body.newInstructionsHtml).toContain('within 3 working days')
    expect(patch.body.newInstructionsHtml).not.toBe(AI_SUGGESTION)
    // AI attribution survives a human edit — the content is still AI-derived.
    expect(patch.body.modelUsed).toBe('gpt-4o-mini')
  })

  it('sends the EDITED brief label', async () => {
    const calls = installFetchMock()
    render(<InstructionView symptom={symptom()} surgeryId="s1" />)

    await openAiModal()
    fireEvent.change(screen.getByLabelText('AI brief instruction'), {
      target: { value: 'Green Slot / ANP / Pharmacy First' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Apply Brief' }))

    await waitFor(() => {
      expect(calls.some((c) => c.url === '/api/updateInstruction')).toBe(true)
    })
    const patch = calls.find((c) => c.url === '/api/updateInstruction')!
    expect(patch.body.newBriefInstruction).toBe('Green Slot / ANP / Pharmacy First')
    expect(patch.body.newInstructionsHtml).toBeUndefined()
  })

  it('sends both edited fields together for Apply Both', async () => {
    const calls = installFetchMock()
    render(<InstructionView symptom={symptom()} surgeryId="s1" />)

    await openAiModal()
    fireEvent.change(screen.getByLabelText('AI brief instruction'), { target: { value: 'Edited brief' } })
    fireEvent.change(screen.getByTestId('ai-full-editor'), { target: { value: '<p>Edited full</p>' } })
    fireEvent.click(screen.getByRole('button', { name: 'Apply Both' }))

    await waitFor(() => {
      expect(calls.some((c) => c.url === '/api/updateInstruction')).toBe(true)
    })
    const patch = calls.find((c) => c.url === '/api/updateInstruction')!
    expect(patch.body.newBriefInstruction).toBe('Edited brief')
    expect(patch.body.newInstructionsHtml).toContain('Edited full')
  })

  it('targets the surgery override row rather than the shared base symptom', async () => {
    const calls = installFetchMock()
    render(<InstructionView symptom={symptom()} surgeryId="s1" />)

    await openAiModal()
    fireEvent.click(screen.getByRole('button', { name: 'Apply Full' }))

    await waitFor(() => {
      expect(calls.some((c) => c.url === '/api/updateInstruction')).toBe(true)
    })
    const patch = calls.find((c) => c.url === '/api/updateInstruction')!
    expect(patch.body).toMatchObject({ symptomId: 'base-1', source: 'override', surgeryId: 's1' })
  })

  it('scopes inline image uploads to the surgery, matching where the save lands', async () => {
    installFetchMock()
    render(<InstructionView symptom={symptom()} surgeryId="s1" />)

    await openAiModal()

    expect(screen.getByTestId('ai-full-editor').getAttribute('data-image-upload')).toBe(
      JSON.stringify({ kind: 'symptom', surgeryId: 's1' })
    )
  })

  it('discards edits when the modal is cancelled, so a reopen starts clean', async () => {
    const calls = installFetchMock()
    render(<InstructionView symptom={symptom()} surgeryId="s1" />)

    await openAiModal()
    fireEvent.change(screen.getByTestId('ai-full-editor'), { target: { value: '<p>Scrapped</p>' } })
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    await waitFor(() => {
      expect(screen.queryByText('AI Suggestion Preview')).not.toBeInTheDocument()
    })
    expect(calls.some((c) => c.url === '/api/updateInstruction')).toBe(false)

    await openAiModal()
    expect(screen.getByTestId('ai-full-editor')).toHaveValue(AI_SUGGESTION)
  })

  it('shows a non-admin the suggestion read-only, with the apply buttons disabled', async () => {
    mockSession.data = standardUserSession
    installFetchMock()
    render(<InstructionView symptom={symptom()} surgeryId="s1" />)

    await openAiModal()

    expect(screen.queryByTestId('ai-full-editor')).not.toBeInTheDocument()
    expect(screen.getByText('Admin only — ask a surgery admin to apply changes.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Apply Full' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Apply Both' })).toBeDisabled()
  })

  it('does not offer the AI button when the ai_instructions flag is off', async () => {
    const fetchMock = jest.fn(async (input: any) => {
      const url = typeof input === 'string' ? input : input?.url
      if (url.startsWith('/api/my/features')) {
        return new Response(JSON.stringify({ features: [{ key: 'ai_instructions', enabled: false }] }), {
          status: 200,
        })
      }
      return new Response(JSON.stringify({ ok: true, highlights: [] }), { status: 200 })
    })
    // @ts-expect-error override global fetch for test
    global.fetch = fetchMock

    render(<InstructionView symptom={symptom()} surgeryId="s1" />)

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled()
    })
    expect(
      screen.queryByRole('button', { name: 'Suggest improved wording (AI)' })
    ).not.toBeInTheDocument()
  })
})
