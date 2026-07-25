/**
 * Variants editing in InstructionView.
 *
 * Variants live on the BaseSymptom row only. The editor must be available to
 * superusers whenever the symptom is base-backed — including when a surgery's
 * override is being viewed (source 'override') — and variant saves must go to
 * the base symptom in a dedicated PATCH, decoupled from the instruction save.
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

jest.mock('react-hot-toast', () => {
  const toast = (..._args: any[]) => {}
  ;(toast as any).error = jest.fn()
  ;(toast as any).success = jest.fn()
  return { toast }
})

// Not under test — avoid mounting TipTap in this suite.
jest.mock('@/components/rich-text/RichTextEditor', () => ({
  __esModule: true,
  default: ({ value, onChange, 'data-testid': testId }: any) => (
    <textarea data-testid={testId ?? 'rich-text'} value={value} onChange={(e) => onChange(e.target.value)} />
  ),
}))

jest.mock('@/components/SuggestionModal', () => ({
  __esModule: true,
  default: () => null,
}))

type FetchCall = { url: string; method: string; body?: any }

function installFetchMock() {
  const calls: FetchCall[] = []
  const fetchMock = jest.fn(async (input: any, init?: any) => {
    const url = typeof input === 'string' ? input : input?.url
    const method = (init?.method ?? 'GET').toUpperCase()
    const body = init?.body ? JSON.parse(init.body) : undefined
    calls.push({ url, method, body })
    return new Response(JSON.stringify({ ok: true, rules: [] }), { status: 200 })
  })
  // @ts-expect-error override global fetch for test
  global.fetch = fetchMock
  return calls
}

const BASE_VARIANTS = {
  heading: 'By age',
  position: 'before',
  ageGroups: [{ key: 'u5', label: 'Under 5', instructions: '<p>U5 advice</p>' }],
}

const overrideSymptom = () =>
  ({
    id: 'base-1',
    name: 'Fever',
    ageGroup: 'Adult',
    briefInstruction: 'Brief',
    highlightedText: null,
    instructions: null,
    instructionsHtml: '<p>Custom practice advice</p>',
    linkToPage: null,
    variants: BASE_VARIANTS,
    source: 'override',
    baseSymptomId: 'base-1',
  }) as any

const superuserSession = {
  user: { globalRole: 'SUPERUSER', memberships: [] },
}

describe('InstructionView variants', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockSession.data = superuserSession
  })

  it('shows the variants editor to a superuser on an override-source symptom', async () => {
    installFetchMock()
    render(<InstructionView symptom={overrideSymptom()} surgeryId="s1" />)

    fireEvent.click(screen.getByText('Edit All Fields'))

    expect(await screen.findByText('Variants')).toBeInTheDocument()
    expect(screen.getByText('Variants are shared from the base symptom and apply to all surgeries.')).toBeInTheDocument()
    // Prefilled from the base symptom's variants
    expect(screen.getByDisplayValue('Under 5')).toBeInTheDocument()
  })

  it('hides the variants editor from practice admins', async () => {
    installFetchMock()
    mockSession.data = {
      user: { globalRole: 'USER', memberships: [{ surgeryId: 's1', role: 'ADMIN' }] },
    }
    render(<InstructionView symptom={overrideSymptom()} surgeryId="s1" />)

    fireEvent.click(screen.getByText('Edit All Fields'))

    await waitFor(() => {
      expect(screen.getByText('Save Changes')).toBeInTheDocument()
    })
    expect(screen.queryByText('Variants')).not.toBeInTheDocument()
  })

  it('does not PATCH variants when they were not changed', async () => {
    const calls = installFetchMock()
    render(<InstructionView symptom={overrideSymptom()} surgeryId="s1" />)

    fireEvent.click(screen.getByText('Edit All Fields'))
    await screen.findByText('Variants')
    fireEvent.click(screen.getByText('Save Changes'))

    await waitFor(() => {
      expect(calls.some((c) => c.method === 'PATCH')).toBe(true)
    })
    const patches = calls.filter((c) => c.method === 'PATCH')
    expect(patches).toHaveLength(1)
    expect(patches[0].body.variants).toBeUndefined()
  })

  it('sends changed variants to the base symptom in a separate PATCH', async () => {
    const calls = installFetchMock()
    render(<InstructionView symptom={overrideSymptom()} surgeryId="s1" />)

    fireEvent.click(screen.getByText('Edit All Fields'))
    await screen.findByText('Variants')

    fireEvent.change(screen.getByDisplayValue('Under 5'), { target: { value: 'Under Five' } })
    fireEvent.click(screen.getByText('Save Changes'))

    await waitFor(() => {
      expect(calls.filter((c) => c.method === 'PATCH')).toHaveLength(2)
    })
    const patches = calls.filter((c) => c.method === 'PATCH')

    // Main save: override branch, no variants attached.
    expect(patches[0].body.source).toBe('override')
    expect(patches[0].body.variants).toBeUndefined()

    // Variants save: base branch, targeted at the base symptom id.
    expect(patches[1].url).toBe('/api/admin/symptoms/base-1')
    expect(patches[1].body.source).toBe('base')
    expect(patches[1].body.variants.ageGroups[0].label).toBe('Under Five')
  })

  it('resets variant edit state on cancel', async () => {
    installFetchMock()
    render(<InstructionView symptom={overrideSymptom()} surgeryId="s1" />)

    fireEvent.click(screen.getByText('Edit All Fields'))
    await screen.findByText('Variants')
    fireEvent.change(screen.getByDisplayValue('Under 5'), { target: { value: 'Scribbled' } })
    fireEvent.click(screen.getByText('Cancel'))

    // Re-open: pristine prefill from the symptom, not the scribbled state.
    fireEvent.click(screen.getByText('Edit All Fields'))
    expect(await screen.findByDisplayValue('Under 5')).toBeInTheDocument()
    expect(screen.queryByDisplayValue('Scribbled')).not.toBeInTheDocument()
  })
})
