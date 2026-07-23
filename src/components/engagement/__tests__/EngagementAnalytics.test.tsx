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
  totals: { totalViews: 999, distinctUsers: 14, distinctSymptoms: 25, activeSurgeries: null },
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
})
