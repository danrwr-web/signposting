import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import EngagementAnalytics from '@/components/engagement/EngagementAnalytics'
import { percentDelta } from '@/components/engagement/SummaryTiles'
import { downloadCsv, buildEngagementCsv } from '@/lib/engagementCsv'
import type { EngagementTopRes } from '@/lib/api-contracts'
import type { Session } from '@/server/auth'

jest.mock('@/lib/engagementCsv', () => ({
  buildEngagementCsv: jest.fn(() => 'csv-content'),
  downloadCsv: jest.fn(),
}))

const surgerySession: Session = { type: 'surgery', id: 'sur-1', surgeryId: 'sur-1' }
const superuserSession: Session = { type: 'superuser', id: 'u1', email: 'super@nhs.net' }

const makeResponse = (overrides: Partial<EngagementTopRes> = {}): EngagementTopRes => ({
  topSymptoms: [
    { id: 'b1', name: 'Diarrhoea & Vomiting', ageGroup: 'Adult', viewCount: 7 },
    { id: 'b2', name: 'Abdomen Pain', ageGroup: 'Adult', viewCount: 6 },
  ],
  topUsers: [{ userEmail: 'shera.yorke-mccoy@nhs.net', engagementCount: 36 }],
  totals: {
    totalViews: 999,
    signedInViews: 999,
    distinctUsers: 14,
    distinctSymptoms: 25,
    activeSurgeries: null,
  },
  previousTotals: { totalViews: 800, distinctUsers: 10 },
  trend: {
    bucket: 'day',
    capped: false,
    points: [
      { date: '2026-07-21', views: 3 },
      { date: '2026-07-22', views: 5 },
    ],
  },
  insights: {
    leastViewed: [{ id: 'b9', name: 'Lumps', ageGroup: 'Adult', viewCount: 0 }],
    neverViewedCount: 3,
    trackedSymptomCount: 25,
    byWeekday: [5, 4, 3, 2, 1, 0, 0],
    byHour: Array(24).fill(1),
  },
  ...overrides,
})

function mockFetch(engagementResponse: EngagementTopRes | Error) {
  const fetchMock = jest.fn((url: string) => {
    if (String(url).includes('/features')) {
      return Promise.resolve({ ok: true, json: async () => ({ features: {} }) })
    }
    if (engagementResponse instanceof Error) {
      return Promise.resolve({ ok: false, json: async () => ({}) })
    }
    return Promise.resolve({ ok: true, json: async () => engagementResponse })
  })
  global.fetch = fetchMock as unknown as typeof fetch
  return fetchMock
}

beforeEach(() => {
  jest.clearAllMocks()
})

describe('percentDelta', () => {
  it('computes whole-percent change and handles a zero previous period', () => {
    expect(percentDelta(120, 100)).toBe(20)
    expect(percentDelta(80, 100)).toBe(-20)
    expect(percentDelta(5, 0)).toBeNull()
  })
})

describe('EngagementAnalytics', () => {
  it('shows true period totals rather than a top-N sum', async () => {
    mockFetch(makeResponse())
    render(<EngagementAnalytics session={surgerySession} />)
    // top-N symptoms sum to 13; the tile must show the real total
    expect(await screen.findByText('999')).toBeInTheDocument()
    expect(screen.getByText('Total symptom views')).toBeInTheDocument()
  })

  it('shows previous-period deltas when available and hides them when null', async () => {
    mockFetch(makeResponse())
    const { unmount } = render(<EngagementAnalytics session={surgerySession} />)
    expect(await screen.findByText('+25%')).toBeInTheDocument()
    unmount()

    mockFetch(makeResponse({ previousTotals: null }))
    render(<EngagementAnalytics session={surgerySession} />)
    await screen.findByText('999')
    expect(screen.queryByText(/vs previous/)).not.toBeInTheDocument()
  })

  it('renders least-viewed and busiest-times insights', async () => {
    mockFetch(makeResponse())
    render(<EngagementAnalytics session={surgerySession} />)
    expect(await screen.findByText('Least Viewed Symptoms')).toBeInTheDocument()
    expect(screen.getByText(/3 of 25 symptoms had no views/)).toBeInTheDocument()
    expect(screen.getByText('Busiest Days & Times')).toBeInTheDocument()
  })

  it('hides the surgery breakdown for surgery sessions and shows it for superusers', async () => {
    mockFetch(makeResponse())
    const { unmount } = render(<EngagementAnalytics session={surgerySession} />)
    await screen.findByText('999')
    expect(screen.queryByText('Surgery Breakdown')).not.toBeInTheDocument()
    unmount()

    mockFetch(
      makeResponse({
        surgeryBreakdown: [
          { surgeryId: 's1', surgeryName: 'Mount Pleasant', surgerySlug: 'mp', engagementCount: 50 },
        ],
      })
    )
    render(<EngagementAnalytics session={superuserSession} />)
    expect(await screen.findByText('Surgery Breakdown')).toBeInTheDocument()
    expect(screen.getByText('Mount Pleasant')).toBeInTheDocument()
  })

  it('exports the fetched data as CSV via the export dialog', async () => {
    const user = userEvent.setup()
    mockFetch(makeResponse())
    render(<EngagementAnalytics session={surgerySession} />)
    await screen.findByText('999')

    await user.click(screen.getByRole('button', { name: 'Export Data' }))
    await user.click(await screen.findByRole('button', { name: 'Export CSV' }))

    expect(buildEngagementCsv).toHaveBeenCalledWith(
      expect.objectContaining({ totals: expect.objectContaining({ totalViews: 999 }) }),
      expect.objectContaining({ rangeLabel: 'Last 30 days', scopeLabel: 'sur-1' })
    )
    expect(downloadCsv).toHaveBeenCalledWith('csv-content', expect.stringMatching(/^engagement-data-30d-.*\.csv$/))
  })

  it('shows an error state and refetches on retry', async () => {
    const user = userEvent.setup()
    const failing = mockFetch(new Error('boom'))
    render(<EngagementAnalytics session={surgerySession} />)
    expect(await screen.findByText('Error loading engagement data')).toBeInTheDocument()
    const callsAfterFailure = failing.mock.calls.length

    mockFetch(makeResponse())
    await user.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByText('999')).toBeInTheDocument()
    expect(callsAfterFailure).toBeGreaterThan(0)
  })

  it('renders the trend chart with an accessible summary', async () => {
    mockFetch(makeResponse())
    render(<EngagementAnalytics session={surgerySession} />)
    await screen.findByText('999')
    expect(
      screen.getByRole('img', { name: /Daily symptom views over 2 days/ })
    ).toBeInTheDocument()
  })

  it('asks for a named range so the window is resolved server-side', async () => {
    const fetchMock = mockFetch(makeResponse())
    render(<EngagementAnalytics session={surgerySession} />)

    await waitFor(() => expect(screen.getByText('999')).toBeInTheDocument())
    const engagementCall = fetchMock.mock.calls
      .map(c => String(c[0]))
      .find(url => url.includes('/api/engagement/top'))!
    expect(engagementCall).toContain('range=30d')
    // A caller-supplied instant would move the window with the viewer's clock.
    expect(engagementCall).not.toContain('startDate')
  })

  it('excludes test surgeries by default and refetches when they are included', async () => {
    const fetchMock = mockFetch(makeResponse())
    render(<EngagementAnalytics session={superuserSession} selectedSurgeryId="all" />)

    await waitFor(() => expect(screen.getByText('999')).toBeInTheDocument())
    const urls = () => fetchMock.mock.calls.map(c => String(c[0]))
    expect(urls().find(u => u.includes('/api/engagement/top'))).not.toContain(
      'includeTestSurgeries'
    )

    await userEvent.click(screen.getByLabelText('Include test surgeries'))
    await waitFor(() =>
      expect(urls().some(u => u.includes('includeTestSurgeries=true'))).toBe(true)
    )
  })

  it('hides the test-surgery toggle outside the all-surgeries overview', async () => {
    mockFetch(makeResponse())
    const { rerender } = render(<EngagementAnalytics session={surgerySession} />)
    await waitFor(() => expect(screen.getByText('999')).toBeInTheDocument())
    expect(screen.queryByLabelText('Include test surgeries')).not.toBeInTheDocument()

    // A superuser drilled into one surgery reports on it whatever its type.
    rerender(<EngagementAnalytics session={superuserSession} selectedSurgeryId="sur-1" />)
    await waitFor(() =>
      expect(screen.queryByLabelText('Include test surgeries')).not.toBeInTheDocument()
    )
  })

  it('says how much of the traffic the active-user count can account for', async () => {
    mockFetch(
      makeResponse({
        totals: {
          totalViews: 296,
          signedInViews: 180,
          distinctUsers: 23,
          distinctSymptoms: 100,
          activeSurgeries: null,
        },
      })
    )
    render(<EngagementAnalytics session={surgerySession} />)

    await waitFor(() =>
      expect(screen.getByText('From 180 of 296 views signed in')).toBeInTheDocument()
    )
  })

  it('leaves the signed-in caption off when every view is attributed', async () => {
    mockFetch(makeResponse())
    render(<EngagementAnalytics session={surgerySession} />)

    await waitFor(() => expect(screen.getByText('999')).toBeInTheDocument())
    expect(screen.queryByText(/views signed in/)).not.toBeInTheDocument()
  })

  it('keeps the header controls on one auto-width row', async () => {
    // jsdom does no layout, so this guards the two class-level causes of the
    // controls stacking full-width: Select's own w-full beats a plain w-auto,
    // and a wrapping row gives each control a line of its own to fill.
    mockFetch(makeResponse())
    render(<EngagementAnalytics session={superuserSession} selectedSurgeryId="all" />)

    await waitFor(() => expect(screen.getByText('999')).toBeInTheDocument())
    const range = screen.getByLabelText('Date range')
    const limit = screen.getByLabelText('Number of results')
    for (const control of [range, limit]) {
      expect(control.className).toContain('w-auto')
      expect(control.className).not.toContain('w-full')
    }
    expect(range.parentElement!.className).not.toContain('flex-wrap')
  })

  it('states its own scope, period and practice-type', async () => {
    mockFetch(makeResponse())
    render(
      <EngagementAnalytics
        session={superuserSession}
        selectedSurgeryId="all"
        scopeLabel="All surgeries"
      />
    )

    // The page header names the surgery being configured, which on the
    // overview is a different thing from what this tab is reporting.
    await waitFor(() =>
      expect(
        screen.getByText('All surgeries · Last 30 days · live practices only')
      ).toBeInTheDocument()
    )

    await userEvent.click(screen.getByLabelText('Include test surgeries'))
    await waitFor(() =>
      expect(
        screen.getByText('All surgeries · Last 30 days · including test practices')
      ).toBeInTheDocument()
    )
  })

  it('names the surgery, not its id, when scoped to one practice', async () => {
    mockFetch(makeResponse())
    render(<EngagementAnalytics session={surgerySession} scopeLabel="Ide Lane Surgery" />)

    await waitFor(() =>
      expect(screen.getByText('Ide Lane Surgery · Last 30 days')).toBeInTheDocument()
    )

    await userEvent.click(screen.getByRole('button', { name: 'Export Data' }))
    await userEvent.click(screen.getByRole('button', { name: 'Export CSV' }))
    expect(buildEngagementCsv).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ scopeLabel: 'Ide Lane Surgery' })
    )
  })

  it('gives the symptom count its denominator', async () => {
    mockFetch(makeResponse())
    render(<EngagementAnalytics session={surgerySession} />)

    await waitFor(() => expect(screen.getByText('Symptoms viewed')).toBeInTheDocument())
    expect(screen.getByText('of 25 in the library')).toBeInTheDocument()
  })

  it('reserves the same number of tiles while loading as after', async () => {
    // A three-tile skeleton followed by a four-tile row shifted the page on
    // every superuser load.
    global.fetch = jest.fn(() => new Promise(() => {})) as unknown as typeof fetch
    const { container } = render(
      <EngagementAnalytics session={superuserSession} selectedSurgeryId="all" />
    )
    const grid = container.querySelector('.grid')!
    expect(grid.className).toContain('lg:grid-cols-4')
    expect(grid.children).toHaveLength(4)
  })

  it('leaves the range controls usable while a fetch is in flight', async () => {
    global.fetch = jest.fn(() => new Promise(() => {})) as unknown as typeof fetch
    render(<EngagementAnalytics session={surgerySession} />)
    expect(screen.getByLabelText('Date range')).toBeEnabled()
    expect(screen.getByLabelText('Number of results')).toBeEnabled()
    // Export still needs data to export.
    expect(screen.getByRole('button', { name: 'Export Data' })).toBeDisabled()
  })

  it('names the busiest hour in text, not only in colour', async () => {
    const byHour = Array(24).fill(0)
    byHour[8] = 74
    byHour[14] = 30
    mockFetch(
      makeResponse({
        insights: { ...makeResponse().insights, byHour },
      })
    )
    render(<EngagementAnalytics session={surgerySession} />)

    await waitFor(() => expect(screen.getByText('08:00–09:00')).toBeInTheDocument())
    expect(
      screen.getByLabelText(/Busiest: 08:00–09:00, 74 views; 14:00–15:00, 30 views/)
    ).toBeInTheDocument()
  })

  it('shows the trend peak up front rather than only on hover', async () => {
    mockFetch(makeResponse())
    render(<EngagementAnalytics session={surgerySession} />)

    await waitFor(() => expect(screen.getByText('Peak:')).toBeInTheDocument())
    expect(screen.getByText('Peak:').closest('p')).toHaveTextContent('Peak: 22 Jul — 5 views')
  })
})
