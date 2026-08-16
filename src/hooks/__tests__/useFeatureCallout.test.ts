import { act, renderHook, waitFor } from '@testing-library/react'
import { useFeatureCallout } from '../useFeatureCallout'

const mockUseSession = jest.fn()
jest.mock('next-auth/react', () => ({
  useSession: () => mockUseSession(),
}))

function serverCalloutResponse(overrides: { firstSeenAt?: string; dismissedAt?: string | null } = {}) {
  return {
    ok: true,
    json: async () => ({
      callout: {
        key: 'any',
        firstSeenAt: overrides.firstSeenAt ?? new Date().toISOString(),
        dismissedAt: overrides.dismissedAt ?? null,
      },
    }),
  }
}

describe('useFeatureCallout', () => {
  beforeEach(() => {
    window.localStorage.clear()
    mockUseSession.mockReturnValue({ data: { user: {} }, status: 'authenticated' })
    global.fetch = jest.fn().mockResolvedValue(serverCalloutResponse()) as jest.Mock
  })

  it('activates within the window; dismissal clears badge and tooltip alike', async () => {
    const { result } = renderHook(() => useFeatureCallout('test-key', 5))

    await waitFor(() => expect(result.current.resolved).toBe(true))
    expect(result.current.windowActive).toBe(true)
    expect(result.current.tooltipVisible).toBe(true)

    act(() => result.current.dismissTooltip())
    expect(result.current.tooltipVisible).toBe(false)
    // Engaging/dismissing means "no longer new" — the badge goes too.
    expect(result.current.windowActive).toBe(false)
  })

  it('deactivates once the window has lapsed', async () => {
    const sixDaysAgo = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString()
    global.fetch = jest
      .fn()
      .mockResolvedValue(serverCalloutResponse({ firstSeenAt: sixDaysAgo })) as jest.Mock

    const { result } = renderHook(() => useFeatureCallout('expired-key', 5))

    await waitFor(() => expect(result.current.resolved).toBe(true))
    expect(result.current.windowActive).toBe(false)
    expect(result.current.tooltipVisible).toBe(false)
  })

  it('respects a server-side dismissal in days mode', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(serverCalloutResponse({ dismissedAt: new Date().toISOString() })) as jest.Mock

    const { result } = renderHook(() => useFeatureCallout('dismissed-key', 5))

    await waitFor(() => expect(result.current.resolved).toBe(true))
    expect(result.current.windowActive).toBe(false)
  })

  it('never announces or re-anchors when the request fails', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('offline')) as jest.Mock

    const { result } = renderHook(() => useFeatureCallout('offline-key', 5))

    await waitFor(() => expect(result.current.resolved).toBe(true))
    // Unknown state must read as "not new"...
    expect(result.current.windowActive).toBe(false)
    expect(result.current.tooltipVisible).toBe(false)
    // ...and the failure must not seed a fresh local window that would
    // re-announce the feature for another N days.
    expect(window.localStorage.getItem('featureCallout:offline-key')).toBeNull()
  })

  it('skips the API entirely when signed out', async () => {
    mockUseSession.mockReturnValue({ data: null, status: 'unauthenticated' })

    const { result } = renderHook(() => useFeatureCallout('signed-out-key', 5))

    await waitFor(() => expect(result.current.resolved).toBe(true))
    expect(global.fetch).not.toHaveBeenCalled()
    expect(result.current.windowActive).toBe(false)
  })

  it('stays unresolved while the session is hydrating', () => {
    mockUseSession.mockReturnValue({ data: null, status: 'loading' })

    const { result } = renderHook(() => useFeatureCallout('loading-key', 5))

    expect(result.current.resolved).toBe(false)
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('propagates dismissal to other instances watching the same key', async () => {
    const first = renderHook(() => useFeatureCallout('shared-key', 5))
    const second = renderHook(() => useFeatureCallout('shared-key', 5))

    await waitFor(() => expect(first.result.current.resolved).toBe(true))
    await waitFor(() => expect(second.result.current.resolved).toBe(true))
    expect(second.result.current.tooltipVisible).toBe(true)

    act(() => first.result.current.dismissTooltip())
    expect(second.result.current.tooltipVisible).toBe(false)
    expect(second.result.current.windowActive).toBe(false)
  })

  it('treats a legacy localStorage flag as dismissed when falling back locally', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('offline')) as jest.Mock
    window.localStorage.setItem(
      'featureCallout:legacy-key',
      JSON.stringify({ firstSeen: Date.now(), dismissed: false })
    )
    window.localStorage.setItem('legacy-flag', 'true')

    const { result } = renderHook(() =>
      useFeatureCallout('legacy-key', undefined, { legacySeenKey: 'legacy-flag' })
    )

    await waitFor(() => expect(result.current.resolved).toBe(true))
    expect(result.current.tooltipVisible).toBe(false)
    expect(result.current.windowActive).toBe(false)
  })
})
