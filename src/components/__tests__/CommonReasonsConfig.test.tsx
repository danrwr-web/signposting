import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CommonReasonsConfig from '@/components/CommonReasonsConfig'
import { COMMON_REASONS_MAX, FALLBACK_SYMPTOM_NAMES } from '@/lib/commonReasonsShared'
import type { EffectiveSymptom } from '@/server/effectiveSymptoms'

const mockRefresh = jest.fn()
jest.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mockRefresh, push: jest.fn() }),
}))

const makeSymptom = (name: string, overrides: Partial<EffectiveSymptom> = {}): EffectiveSymptom => ({
  id: name.toLowerCase().replace(/\s+/g, '-'),
  slug: name.toLowerCase().replace(/\s+/g, '-'),
  name,
  ageGroup: 'Adult',
  briefInstruction: null,
  highlightedText: null,
  instructions: null,
  instructionsJson: null,
  instructionsHtml: null,
  linkToPage: null,
  source: 'base',
  ...overrides,
})

const symptoms = FALLBACK_SYMPTOM_NAMES.map(name => makeSymptom(name))

const mockFetchWithUiConfig = (uiConfig: unknown) => {
  const fetchMock = jest.fn((url: string, init?: RequestInit) => {
    if (init?.method === 'PATCH') {
      return Promise.resolve({ ok: true, json: async () => ({ success: true }) })
    }
    return Promise.resolve({ ok: true, json: async () => ({ surgery: { uiConfig } }) })
  }) as jest.Mock
  global.fetch = fetchMock as unknown as typeof fetch
  return fetchMock
}

const checkboxLabel = /show quick access buttons on the staff home screen/i

describe('CommonReasonsConfig', () => {
  afterEach(() => {
    jest.clearAllMocks()
  })

  it('shows the checkbox ticked with the default buttons when no config has been saved', async () => {
    mockFetchWithUiConfig(null)
    render(<CommonReasonsConfig surgeryId="sur-1" symptoms={symptoms} />)

    const checkbox = await screen.findByRole('checkbox', { name: checkboxLabel })
    expect(checkbox).toBeChecked()

    // Default buttons are listed so the admin sees what staff see
    expect(screen.getByText(`Selected symptoms (${COMMON_REASONS_MAX}/${COMMON_REASONS_MAX})`)).toBeInTheDocument()
    expect(screen.getByText('Abdomen Pain')).toBeInTheDocument()
    expect(screen.getByText(/default buttons/i)).toBeInTheDocument()

    // Untouched defaults: nothing to save yet
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument()
  })

  it('lets the admin turn the buttons off by unticking and saving an explicit false', async () => {
    const fetchMock = mockFetchWithUiConfig(null)
    const user = userEvent.setup()
    render(<CommonReasonsConfig surgeryId="sur-1" symptoms={symptoms} />)

    const checkbox = await screen.findByRole('checkbox', { name: checkboxLabel })
    await user.click(checkbox)
    expect(checkbox).not.toBeChecked()

    // Unticking is now a change from the effective (default-on) state
    const saveButton = screen.getByRole('button', { name: 'Save' })
    await user.click(saveButton)

    await waitFor(() => {
      const patchCall = fetchMock.mock.calls.find(([, init]) => init?.method === 'PATCH')
      expect(patchCall).toBeDefined()
      const body = JSON.parse(patchCall![1].body as string)
      expect(body.commonReasons.commonReasonsEnabled).toBe(false)
    })
    expect(await screen.findByText('Settings saved successfully')).toBeInTheDocument()
  })

  it('shows the saved configuration verbatim when an explicit config exists', async () => {
    mockFetchWithUiConfig({
      commonReasons: {
        commonReasonsEnabled: true,
        items: [{ symptomId: 'cough', label: 'Coughs' }],
      },
    })
    render(<CommonReasonsConfig surgeryId="sur-1" symptoms={symptoms} />)

    const checkbox = await screen.findByRole('checkbox', { name: checkboxLabel })
    expect(checkbox).toBeChecked()
    expect(screen.getByText(`Selected symptoms (1/${COMMON_REASONS_MAX})`)).toBeInTheDocument()
    expect(screen.getByText('Cough')).toBeInTheDocument()
    // No "using defaults" banner for an explicitly configured surgery
    expect(screen.queryByText(/default buttons/i)).not.toBeInTheDocument()
  })

  it('shows the checkbox unticked when the config is explicitly disabled', async () => {
    mockFetchWithUiConfig({ commonReasons: { commonReasonsEnabled: false, items: [] } })
    render(<CommonReasonsConfig surgeryId="sur-1" symptoms={symptoms} />)

    const checkbox = await screen.findByRole('checkbox', { name: checkboxLabel })
    expect(checkbox).not.toBeChecked()
    expect(screen.queryByText(/default buttons/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument()
  })

  it('restores the loaded state on cancel', async () => {
    mockFetchWithUiConfig(null)
    const user = userEvent.setup()
    render(<CommonReasonsConfig surgeryId="sur-1" symptoms={symptoms} />)

    const checkbox = await screen.findByRole('checkbox', { name: checkboxLabel })
    await user.click(checkbox)
    expect(checkbox).not.toBeChecked()

    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(checkbox).toBeChecked()
    expect(screen.getByText(`Selected symptoms (${COMMON_REASONS_MAX}/${COMMON_REASONS_MAX})`)).toBeInTheDocument()
  })

  it('fills in the default items once symptoms load after the config fetch', async () => {
    mockFetchWithUiConfig(null)
    const { rerender } = render(<CommonReasonsConfig surgeryId="sur-1" symptoms={[]} />)

    const checkbox = await screen.findByRole('checkbox', { name: checkboxLabel })
    expect(checkbox).toBeChecked()
    expect(screen.getByText(`Selected symptoms (0/${COMMON_REASONS_MAX})`)).toBeInTheDocument()

    rerender(<CommonReasonsConfig surgeryId="sur-1" symptoms={symptoms} />)
    await waitFor(() => {
      expect(screen.getByText(`Selected symptoms (${COMMON_REASONS_MAX}/${COMMON_REASONS_MAX})`)).toBeInTheDocument()
    })
    // Still no unsaved-changes bar: this is the surgery's effective state
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument()
  })
})
