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

const savedVisual = (variantKey: string, text: string, isStale = false) => ({
  variantKey,
  layout: layoutFor(text),
  generatedAtIso: '2026-08-01T00:00:00.000Z',
  isStale,
})

beforeEach(() => {
  jest.clearAllMocks()
  // Feature checks aside, nothing in these tests should reach the network.
  // @ts-expect-error override global fetch for test
  global.fetch = jest.fn(() => new Promise(() => {}))
})

describe('SymptomSmartVisualToggle default view', () => {
  it('opens on the smart visual when the symptom has one', () => {
    render(
      <SymptomSmartVisualToggle
        {...baseProps}
        visuals={[savedVisual('', 'Saved visual content.')]}
        activeVariantKey=""
        activeVariantLabel={null}
      >
        <div>standard instructions</div>
      </SymptomSmartVisualToggle>
    )

    expect(screen.getByText('Saved visual content.')).toBeInTheDocument()
    expect(screen.queryByText('standard instructions')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Smart visual' })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
  })

  it('opens on the standard instructions when there is no visual', () => {
    render(
      <SymptomSmartVisualToggle {...baseProps} activeVariantKey="" activeVariantLabel={null}>
        <div>standard instructions</div>
      </SymptomSmartVisualToggle>
    )

    expect(screen.getByText('standard instructions')).toBeInTheDocument()
  })

  it('opens on the standard instructions when the only visual is stale', () => {
    render(
      <SymptomSmartVisualToggle
        {...baseProps}
        visuals={[savedVisual('', 'Outdated visual.', true)]}
        activeVariantKey=""
        activeVariantLabel={null}
      >
        <div>standard instructions</div>
      </SymptomSmartVisualToggle>
    )

    expect(screen.getByText('standard instructions')).toBeInTheDocument()
    expect(screen.queryByText('Outdated visual.')).not.toBeInTheDocument()
  })

  it('does not default a non-editor into an unapproved visual', () => {
    render(
      <SymptomSmartVisualToggle
        {...baseProps}
        canGenerate={false}
        approved={false}
        visuals={[savedVisual('', 'Pending visual.')]}
        activeVariantKey=""
        activeVariantLabel={null}
      >
        <div>standard instructions</div>
      </SymptomSmartVisualToggle>
    )

    expect(screen.getByText('standard instructions')).toBeInTheDocument()
    expect(screen.queryByText('Pending visual.')).not.toBeInTheDocument()
  })

  it('lets the reader switch back to the standard instructions', () => {
    render(
      <SymptomSmartVisualToggle
        {...baseProps}
        visuals={[savedVisual('', 'Saved visual content.')]}
        activeVariantKey=""
        activeVariantLabel={null}
      >
        <div>standard instructions</div>
      </SymptomSmartVisualToggle>
    )

    fireEvent.click(screen.getByRole('button', { name: 'Standard' }))
    expect(screen.getByText('standard instructions')).toBeInTheDocument()
  })

  it('follows the default for whichever variant is selected', () => {
    // Only the Adult variant has a visual, so switching to it should surface
    // that visual, and switching back to U5 should fall back to standard.
    const props = {
      ...baseProps,
      visuals: [savedVisual('adult', 'Adult visual content.')],
    }
    const { rerender } = render(
      <SymptomSmartVisualToggle {...props} activeVariantKey="u5" activeVariantLabel="Under 5">
        <div>standard instructions</div>
      </SymptomSmartVisualToggle>
    )
    expect(screen.getByText('standard instructions')).toBeInTheDocument()

    rerender(
      <SymptomSmartVisualToggle {...props} activeVariantKey="adult" activeVariantLabel="Adult">
        <div>standard instructions</div>
      </SymptomSmartVisualToggle>
    )
    expect(screen.getByText('Adult visual content.')).toBeInTheDocument()

    rerender(
      <SymptomSmartVisualToggle {...props} activeVariantKey="u5" activeVariantLabel="Under 5">
        <div>standard instructions</div>
      </SymptomSmartVisualToggle>
    )
    expect(screen.getByText('standard instructions')).toBeInTheDocument()
    expect(screen.queryByText('Adult visual content.')).not.toBeInTheDocument()
  })
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
