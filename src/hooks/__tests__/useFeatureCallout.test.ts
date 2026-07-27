import { act, renderHook, waitFor } from '@testing-library/react'
import { useFeatureCallout } from '../useFeatureCallout'

describe('useFeatureCallout', () => {
  beforeEach(() => {
    window.localStorage.clear()
    // Force the localStorage fallback path so tests are deterministic.
    global.fetch = jest.fn().mockRejectedValue(new Error('offline')) as jest.Mock
  })

  it('activates within the window and dismissal hides the tooltip', async () => {
    const { result } = renderHook(() => useFeatureCallout('test-key', 5))

    await waitFor(() => expect(result.current.resolved).toBe(true))
    expect(result.current.windowActive).toBe(true)
    expect(result.current.tooltipVisible).toBe(true)

    act(() => result.current.dismissTooltip())
    expect(result.current.tooltipVisible).toBe(false)
    // Badges keep running for the rest of the window
    expect(result.current.windowActive).toBe(true)
  })

  it('propagates dismissal to other instances watching the same key', async () => {
    const first = renderHook(() => useFeatureCallout('shared-key', 5))
    const second = renderHook(() => useFeatureCallout('shared-key', 5))

    await waitFor(() => expect(first.result.current.resolved).toBe(true))
    await waitFor(() => expect(second.result.current.resolved).toBe(true))
    expect(second.result.current.tooltipVisible).toBe(true)

    act(() => first.result.current.dismissTooltip())
    expect(second.result.current.tooltipVisible).toBe(false)
  })

  it('treats a legacy localStorage flag as dismissed', async () => {
    window.localStorage.setItem('legacy-flag', 'true')
    const { result } = renderHook(() =>
      useFeatureCallout('legacy-key', undefined, { legacySeenKey: 'legacy-flag' })
    )

    await waitFor(() => expect(result.current.resolved).toBe(true))
    expect(result.current.tooltipVisible).toBe(false)
    expect(result.current.windowActive).toBe(false)
  })
})
