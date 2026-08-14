/**
 * Variant safety in the smart visual toggle.
 *
 * Generation takes seconds. If an admin switches age group while a request is
 * in flight, a late response must never paint the previous variant's triage
 * content under the newly selected one — they could review and save it
 * believing it describes the other age group.
 */
import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import SymptomSmartVisualToggle from '@/components/symptom-smart-visual/SymptomSmartVisualToggle'
import type { SymptomSmartVisualLayout } from '@/lib/symptomSmartVisualShared'

jest.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: jest.fn(), push: jest.fn() }),
}))

const saveSymptomSmartVisual = jest.fn()
const removeSymptomSmartVisual = jest.fn()
jest.mock('@/app/s/[id]/signposting/symptomSmartVisualActions', () => ({
  saveSymptomSmartVisual: (...args: unknown[]) => saveSymptomSmartVisual(...args),
  removeSymptomSmartVisual: (...args: unknown[]) => removeSymptomSmartVisual(...args),
}))

const layoutFor = (text: string): SymptomSmartVisualLayout => ({
  version: 1,
  sections: [{ type: 'summary', text }],
})

const baseProps = {
  surgeryId: 's1',
  symptomId: 'sym-1',
  visuals: [],
  canGenerate: true,
  aiVisualsEnabled: true,
  approved: true,
}

/**
 * A fetch mock whose response resolution is controlled by the test, so a
 * variant switch can be interleaved with an in-flight generation.
 */
function installDeferredFetch() {
  let release: (body: unknown) => void = () => {}
  const fetchMock = jest.fn(
    () =>
      new Promise((resolve) => {
        release = (body: unknown) =>
          resolve(new Response(JSON.stringify(body), { status: 200 }) as unknown as Response)
      })
  )
  // @ts-expect-error override global fetch for test
  global.fetch = fetchMock
  return { fetchMock, release: (body: unknown) => release(body) }
}

const renderToggle = (variantKey: string, variantLabel: string | null) =>
  render(
    <SymptomSmartVisualToggle
      {...baseProps}
      activeVariantKey={variantKey}
      activeVariantLabel={variantLabel}
    >
      <div>standard instructions</div>
    </SymptomSmartVisualToggle>
  )

beforeEach(() => {
  jest.clearAllMocks()
})

describe('SymptomSmartVisualToggle variant safety', () => {
  it('discards a generation response for a variant the admin has since left', async () => {
    const { release } = installDeferredFetch()
    const { rerender } = renderToggle('u5', 'Under 5')

    fireEvent.click(screen.getByRole('button', { name: /Generate smart visual/ }))

    // Admin switches to the Adult variant while the U5 request is in flight.
    rerender(
      <SymptomSmartVisualToggle {...baseProps} activeVariantKey="adult" activeVariantLabel="Adult">
        <div>standard instructions</div>
      </SymptomSmartVisualToggle>
    )

    release({
      layout: layoutFor('Under-5 advice: book a same-day call.'),
      sourceFingerprint: 'a'.repeat(64),
      variantKey: 'u5',
      modelUsed: 'gpt-4o-mini',
    })

    // The stale layout must not be held in preview state at all. The variant
    // effect already reset the view to Standard, so an unguarded response is
    // invisible at first — but it still populates the preview, which brings
    // back the "Smart visual" tab. One click would then show Under-5 triage
    // content under the Adult selection, ready to be saved. So assert the tab
    // never returns once the request has settled.
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Smart visual' })).not.toBeInTheDocument()
    })
    expect(screen.getByText('standard instructions')).toBeInTheDocument()
    expect(screen.queryByText(/Under-5 advice/)).not.toBeInTheDocument()
    expect(screen.queryByText(/not saved yet/)).not.toBeInTheDocument()
  })

  it('renders a generation response that is still for the active variant', async () => {
    const { release } = installDeferredFetch()
    renderToggle('u5', 'Under 5')

    fireEvent.click(screen.getByRole('button', { name: /Generate smart visual/ }))

    release({
      layout: layoutFor('Under-5 advice: book a same-day call.'),
      sourceFingerprint: 'a'.repeat(64),
      variantKey: 'u5',
      modelUsed: 'gpt-4o-mini',
    })

    expect(await screen.findByText(/Under-5 advice/)).toBeInTheDocument()
    expect(screen.getByText(/not saved yet/)).toBeInTheDocument()
  })

  it('sends the active variant key with the generation request', async () => {
    const { fetchMock, release } = installDeferredFetch()
    renderToggle('adult', 'Adult')

    fireEvent.click(screen.getByRole('button', { name: /Generate smart visual/ }))
    release({ layout: layoutFor('Adult advice.'), sourceFingerprint: 'b'.repeat(64), variantKey: 'adult' })

    await screen.findByText(/Adult advice/)
    const body = JSON.parse((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body as string)
    expect(body).toMatchObject({ surgeryId: 's1', symptomId: 'sym-1', variantKey: 'adult' })
  })

  it('saves the preview against the variant it was generated for', async () => {
    const { release } = installDeferredFetch()
    saveSymptomSmartVisual.mockResolvedValue({ ok: true, data: {} })
    renderToggle('u5', 'Under 5')

    fireEvent.click(screen.getByRole('button', { name: /Generate smart visual/ }))
    release({ layout: layoutFor('Under-5 advice.'), sourceFingerprint: 'c'.repeat(64), variantKey: 'u5' })

    await screen.findByText(/Under-5 advice/)
    fireEvent.click(screen.getByRole('button', { name: 'Save visual' }))

    await waitFor(() => expect(saveSymptomSmartVisual).toHaveBeenCalledTimes(1))
    expect(saveSymptomSmartVisual.mock.calls[0][0]).toMatchObject({
      variantKey: 'u5',
      sourceFingerprint: 'c'.repeat(64),
    })
  })

  it('warns that saving sends the symptom for clinical review', async () => {
    const { release } = installDeferredFetch()
    renderToggle('', null)

    fireEvent.click(screen.getByRole('button', { name: /Generate smart visual/ }))
    release({ layout: layoutFor('Advice.'), sourceFingerprint: 'd'.repeat(64), variantKey: '' })

    expect(await screen.findByText(/Saving sends this symptom for clinical review/)).toBeInTheDocument()
  })
})
