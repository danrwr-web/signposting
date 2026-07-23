import { buildEngagementCsv, escapeCsvField } from '@/lib/engagementCsv'
import type { EngagementTopRes } from '@/lib/api-contracts'

const baseData: EngagementTopRes = {
  topSymptoms: [
    { id: 'b1', name: 'Diarrhoea & Vomiting', ageGroup: 'Adult', viewCount: 7 },
    { id: 'b2', name: 'Pain, "sharp", abdominal', ageGroup: 'U5', viewCount: 6 },
  ],
  topUsers: [{ userEmail: 'shera.yorke-mccoy@nhs.net', engagementCount: 36 }],
  totals: { totalViews: 99, distinctUsers: 12, distinctSymptoms: 20, activeSurgeries: null },
  previousTotals: { totalViews: 80, distinctUsers: 10 },
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
    neverViewedCount: 1,
    trackedSymptomCount: 20,
    byWeekday: [5, 4, 3, 2, 1, 0, 0],
    byHour: Array(24).fill(0),
  },
}

const meta = {
  rangeLabel: 'Last 30 days',
  scopeLabel: 'Mount Pleasant Health Centre',
  generatedAt: new Date('2026-07-23T10:00:00Z'),
}

describe('escapeCsvField', () => {
  it('quotes fields containing commas and doubles embedded quotes', () => {
    expect(escapeCsvField('plain')).toBe('plain')
    expect(escapeCsvField('a,b')).toBe('"a,b"')
    expect(escapeCsvField('say "hi"')).toBe('"say ""hi"""')
    expect(escapeCsvField('line\nbreak')).toBe('"line\nbreak"')
  })
})

describe('buildEngagementCsv', () => {
  it('exports the real fetched data with all sections', () => {
    const csv = buildEngagementCsv(baseData, meta)
    expect(csv).toContain('Scope,Mount Pleasant Health Centre')
    expect(csv).toContain('Date range,Last 30 days')
    expect(csv).toContain('Total symptom views,99')
    expect(csv).toContain('Active users,12')
    expect(csv).toContain('Total symptom views (previous period),80')
    expect(csv).toContain('1,Diarrhoea & Vomiting,Adult,7')
    expect(csv).toContain('1,shera.yorke-mccoy@nhs.net,36')
    expect(csv).toContain('Lumps,Adult,0')
    expect(csv).toContain('Monday,5')
    expect(csv).toContain('2026-07-22,5')
  })

  it('escapes symptom names containing commas and quotes', () => {
    const csv = buildEngagementCsv(baseData, meta)
    expect(csv).toContain('"Pain, ""sharp"", abdominal"')
  })

  it('omits the surgery breakdown section when absent and includes it when present', () => {
    expect(buildEngagementCsv(baseData, meta)).not.toContain('Surgery breakdown')
    const withBreakdown: EngagementTopRes = {
      ...baseData,
      surgeryBreakdown: [
        { surgeryId: 's1', surgeryName: 'Mount Pleasant', surgerySlug: 'mp', engagementCount: 50 },
      ],
    }
    const csv = buildEngagementCsv(withBreakdown, meta)
    expect(csv).toContain('Surgery breakdown')
    expect(csv).toContain('1,Mount Pleasant,50')
  })

  it('labels the daily views section as capped when the trend was capped', () => {
    const capped: EngagementTopRes = {
      ...baseData,
      trend: { ...baseData.trend, capped: true },
    }
    expect(buildEngagementCsv(capped, meta)).toContain('Daily views (last 90 days)')
  })
})
