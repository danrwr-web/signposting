/**
 * Variants editing in InstructionView.
 *
 * Shared (base) variants: editable by superusers on any base-backed symptom,
 * saved to the base symptom in a dedicated PATCH. Practice-level variants:
 * per-surgery override with inherit / customise / hide modes, editable by
 * practice admins and superusers, saved to the surgery's override row.
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

jest.mock('@/components/SuggestFeatureDialog', () => ({
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

const overrideSymptom = (overrideVariants: unknown = null) =>
  ({
    id: 'base-1',
    name: 'Fever',
    ageGroup: 'Adult',
    briefInstruction: 'Brief',
    highlightedText: null,
    instructions: null,
    instructionsHtml: '<p>Custom practice advice</p>',
    linkToPage: null,
    variants: overrideVariants == null ? BASE_VARIANTS : overrideVariants,
    baseVariants: BASE_VARIANTS,
    overrideVariants,
    source: 'override',
    baseSymptomId: 'base-1',
  }) as any

const superuserSession = {
  user: { globalRole: 'SUPERUSER', memberships: [] },
}

const practiceAdminSession = {
  user: { globalRole: 'USER', memberships: [{ surgeryId: 's1', role: 'ADMIN' }] },
}

const openEditAll = async () => {
  fireEvent.click(screen.getByText('Edit All Fields'))
  await screen.findByText('Variants at this practice')
}

describe('InstructionView variants', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockSession.data = superuserSession
  })

  it('shows both variant panels to a superuser on an override-source symptom', async () => {
    installFetchMock()
    render(<InstructionView symptom={overrideSymptom()} surgeryId="s1" />)

    await openEditAll()

    expect(screen.getByText('Shared variants (all practices)')).toBeInTheDocument()
    // Shared panel prefilled from the BASE variants
    expect(screen.getByDisplayValue('Under 5')).toBeInTheDocument()
    // Practice panel defaults to inherit when the override has no variants
    expect((screen.getByRole('radio', { name: /Use shared variants/ }) as HTMLInputElement).checked).toBe(true)
  })

  it('shows the practice panel but not the shared panel to practice admins', async () => {
    installFetchMock()
    mockSession.data = practiceAdminSession
    render(<InstructionView symptom={overrideSymptom()} surgeryId="s1" />)

    await openEditAll()

    expect(screen.queryByText('Shared variants (all practices)')).not.toBeInTheDocument()
    expect(screen.getByText('Variants at this practice')).toBeInTheDocument()
  })

  it('does not PATCH variants when nothing was changed', async () => {
    const calls = installFetchMock()
    render(<InstructionView symptom={overrideSymptom()} surgeryId="s1" />)

    await openEditAll()
    fireEvent.click(screen.getByText('Save Changes'))

    await waitFor(() => {
      expect(calls.some((c) => c.method === 'PATCH')).toBe(true)
    })
    const patches = calls.filter((c) => c.method === 'PATCH')
    expect(patches).toHaveLength(1)
    expect(patches[0].body.variants).toBeUndefined()
  })

  it('sends changed shared variants to the base symptom in a separate PATCH', async () => {
    const calls = installFetchMock()
    render(<InstructionView symptom={overrideSymptom()} surgeryId="s1" />)

    await openEditAll()
    fireEvent.change(screen.getByDisplayValue('Under 5'), { target: { value: 'Under Five' } })
    fireEvent.click(screen.getByText('Save Changes'))

    await waitFor(() => {
      expect(calls.filter((c) => c.method === 'PATCH')).toHaveLength(2)
    })
    const patches = calls.filter((c) => c.method === 'PATCH')

    expect(patches[0].body.source).toBe('override')
    expect(patches[0].body.variants).toBeUndefined()

    expect(patches[1].url).toBe('/api/admin/symptoms/base-1')
    expect(patches[1].body.source).toBe('base')
    expect(patches[1].body.variants.ageGroups[0].label).toBe('Under Five')
  })

  it('saves "hide at this practice" as an override with empty ageGroups', async () => {
    const calls = installFetchMock()
    mockSession.data = practiceAdminSession
    render(<InstructionView symptom={overrideSymptom()} surgeryId="s1" />)

    await openEditAll()
    fireEvent.click(screen.getByRole('radio', { name: /Hide variants at this practice/ }))
    fireEvent.click(screen.getByText('Save Changes'))

    await waitFor(() => {
      expect(calls.filter((c) => c.method === 'PATCH')).toHaveLength(2)
    })
    const patches = calls.filter((c) => c.method === 'PATCH')
    expect(patches[1].body.source).toBe('override')
    expect(patches[1].body.surgeryId).toBe('s1')
    expect(patches[1].body.variants).toEqual({ ageGroups: [] })
  })

  it('prefills customise mode from the surgery override variants', async () => {
    installFetchMock()
    const surgeryVariants = {
      ageGroups: [{ key: 'adult', label: 'Local Adult', instructions: '<p>Local advice</p>' }],
    }
    render(<InstructionView symptom={overrideSymptom(surgeryVariants)} surgeryId="s1" />)

    await openEditAll()

    expect((screen.getByRole('radio', { name: /Customise for this practice/ }) as HTMLInputElement).checked).toBe(true)
    expect(screen.getByDisplayValue('Local Adult')).toBeInTheDocument()
  })

  it('lets a practice admin edit variants on a practice-owned custom symptom', async () => {
    const calls = installFetchMock()
    mockSession.data = practiceAdminSession
    const customSymptom = {
      id: 'custom-1',
      name: 'Local Thing',
      ageGroup: 'Adult',
      briefInstruction: null,
      highlightedText: null,
      instructions: null,
      instructionsHtml: '<p>Custom advice</p>',
      linkToPage: null,
      variants: {
        ageGroups: [{ key: 'u5', label: 'Custom U5', instructions: '<p>U5</p>' }],
      },
      source: 'custom',
    } as any
    render(<InstructionView symptom={customSymptom} surgeryId="s1" />)

    fireEvent.click(screen.getByText('Edit All Fields'))
    await screen.findByText('Variants')

    // Single panel for custom symptoms: no shared/practice split.
    expect(screen.queryByText('Shared variants (all practices)')).not.toBeInTheDocument()
    expect(screen.queryByText('Variants at this practice')).not.toBeInTheDocument()
    expect(screen.getByText('This symptom belongs to your practice — variants apply here only.')).toBeInTheDocument()

    fireEvent.change(screen.getByDisplayValue('Custom U5'), { target: { value: 'Renamed U5' } })
    fireEvent.click(screen.getByText('Save Changes'))

    await waitFor(() => {
      expect(calls.filter((c) => c.method === 'PATCH')).toHaveLength(2)
    })
    const patches = calls.filter((c) => c.method === 'PATCH')
    expect(patches[1].url).toBe('/api/admin/symptoms/custom-1')
    expect(patches[1].body.source).toBe('custom')
    expect(patches[1].body.surgeryId).toBe('s1')
    expect(patches[1].body.variants.ageGroups[0].label).toBe('Renamed U5')
  })

  it('resets both panels on cancel', async () => {
    installFetchMock()
    render(<InstructionView symptom={overrideSymptom()} surgeryId="s1" />)

    await openEditAll()
    fireEvent.change(screen.getByDisplayValue('Under 5'), { target: { value: 'Scribbled' } })
    fireEvent.click(screen.getByRole('radio', { name: /Hide variants at this practice/ }))
    fireEvent.click(screen.getByText('Cancel'))

    await openEditAll()
    expect(await screen.findByDisplayValue('Under 5')).toBeInTheDocument()
    expect(screen.queryByDisplayValue('Scribbled')).not.toBeInTheDocument()
    expect((screen.getByRole('radio', { name: /Use shared variants/ }) as HTMLInputElement).checked).toBe(true)
  })
})
