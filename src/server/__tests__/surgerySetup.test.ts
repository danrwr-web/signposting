import { latestDate, computeSurgerySetupSnapshotsBatch } from '@/server/surgerySetup'
import { prisma } from '@/lib/prisma'

jest.mock('@/server/effectiveSymptoms', () => ({ getEffectiveSymptoms: jest.fn() }))
jest.mock('@/lib/features', () => ({ isFeatureEnabledForSurgery: jest.fn() }))
jest.mock('@/lib/prisma', () => ({
  prisma: {
    surgery: { findMany: jest.fn() },
    userSurgery: { groupBy: jest.fn().mockResolvedValue([]) },
    highRiskLink: { groupBy: jest.fn().mockResolvedValue([]) },
    defaultHighRiskButtonConfig: { groupBy: jest.fn().mockResolvedValue([]) },
    highlightRule: { groupBy: jest.fn().mockResolvedValue([]) },
    appointmentType: { groupBy: jest.fn().mockResolvedValue([]) },
    adminItem: { groupBy: jest.fn().mockResolvedValue([]) },
    symptomReviewStatus: { groupBy: jest.fn().mockResolvedValue([]) },
    engagementEvent: {
      groupBy: jest.fn().mockResolvedValue([]),
      findMany: jest.fn().mockResolvedValue([]),
    },
    surgerySymptomOverride: {
      groupBy: jest.fn().mockResolvedValue([]),
      findMany: jest.fn().mockResolvedValue([]),
    },
    surgeryCustomSymptom: {
      groupBy: jest.fn().mockResolvedValue([]),
      findMany: jest.fn().mockResolvedValue([]),
    },
    surgeryFeatureFlag: { findMany: jest.fn().mockResolvedValue([]) },
    symptomHistory: { findMany: jest.fn().mockResolvedValue([]) },
  },
}))

describe('surgerySetup.latestDate', () => {
  it('returns null when given no dates', () => {
    expect(latestDate()).toBeNull()
  })

  it('returns null when all inputs are null or undefined', () => {
    expect(latestDate(null, undefined, null)).toBeNull()
  })

  it('returns the single non-null date', () => {
    const d = new Date('2026-03-01T10:00:00Z')
    expect(latestDate(null, d, undefined)).toEqual(d)
  })

  it('returns the latest of several dates regardless of order', () => {
    const oldest = new Date('2026-01-01T00:00:00Z')
    const middle = new Date('2026-02-15T09:30:00Z')
    const newest = new Date('2026-03-20T18:45:00Z')
    expect(latestDate(middle, newest, oldest)).toEqual(newest)
    expect(latestDate(newest, oldest, middle)).toEqual(newest)
  })

  it('ignores nulls mixed in with real dates', () => {
    const engagement = new Date('2026-01-05T00:00:00Z')
    const lastReviewed = new Date('2026-04-10T00:00:00Z')
    expect(latestDate(engagement, lastReviewed, null, undefined)).toEqual(lastReviewed)
  })
})

describe('computeSurgerySetupSnapshotsBatch lastActivityAt', () => {
  const REVIEW_DATE = new Date('2026-06-28T14:00:00Z')
  const OVERRIDE_DATE = new Date('2026-06-30T09:00:00Z')

  const surgeryRow = {
    id: 's1',
    name: 'Mount Pleasant Health Centre',
    surgeryType: 'LIVE',
    createdAt: new Date('2026-05-23T00:00:00Z'),
    requiresClinicalReview: true,
    enableDefaultHighRisk: false,
    enableBuiltInHighlights: false,
    onboardingProfile: null,
    pipelineEntry: null,
  }

  beforeEach(() => {
    ;(prisma.surgery.findMany as jest.Mock).mockResolvedValue([surgeryRow])
  })

  it('counts clinical review and symptom edits as activity when there are no engagement events', async () => {
    // symptomReviewStatus.groupBy serves both status counts and the
    // lastReviewedAt max — only the _max query returns data here.
    ;(prisma.symptomReviewStatus.groupBy as jest.Mock).mockImplementation(
      (args: { _max?: { lastReviewedAt?: boolean } }) =>
        Promise.resolve(
          args._max?.lastReviewedAt
            ? [{ surgeryId: 's1', _max: { lastReviewedAt: REVIEW_DATE } }]
            : [],
        ),
    )
    ;(prisma.surgerySymptomOverride.groupBy as jest.Mock).mockResolvedValue([
      { surgeryId: 's1', _max: { lastEditedAt: OVERRIDE_DATE } },
    ])

    const [snapshot] = await computeSurgerySetupSnapshotsBatch(['s1'])
    expect(snapshot.lastActivityAt).toEqual(OVERRIDE_DATE)
    expect(snapshot.health.lastReviewActivity).toBe(REVIEW_DATE.toISOString())
  })

  it('is null when the surgery has no activity of any kind', async () => {
    ;(prisma.symptomReviewStatus.groupBy as jest.Mock).mockResolvedValue([])
    ;(prisma.surgerySymptomOverride.groupBy as jest.Mock).mockResolvedValue([])

    const [snapshot] = await computeSurgerySetupSnapshotsBatch(['s1'])
    expect(snapshot.lastActivityAt).toBeNull()
  })
})

describe('computeSurgerySetupSnapshotsBatch AI customisation', () => {
  const completedProfile = {
    completed: true,
    completedAt: new Date('2026-06-16T00:00:00Z'),
    updatedAt: new Date('2026-06-16T00:00:00Z'),
    profileJson: {
      surgeryName: 'Mount Pleasant Health Centre',
      appointmentModel: { routineGpPhone: { enabled: true } },
    },
  }

  beforeEach(() => {
    ;(prisma.surgery.findMany as jest.Mock).mockResolvedValue([
      {
        id: 's1',
        name: 'Mount Pleasant Health Centre',
        surgeryType: 'LIVE',
        createdAt: new Date('2026-05-23T00:00:00Z'),
        requiresClinicalReview: true,
        enableDefaultHighRisk: true,
        enableBuiltInHighlights: false,
        onboardingProfile: completedProfile,
        pipelineEntry: null,
      },
    ])
    ;(prisma.userSurgery.groupBy as jest.Mock).mockResolvedValue([{ surgeryId: 's1', _count: { _all: 2 } }])
    ;(prisma.surgeryFeatureFlag.findMany as jest.Mock).mockResolvedValue([
      { surgeryId: 's1', feature: { key: 'ai_surgery_customisation' } },
    ])
    ;(prisma.surgerySymptomOverride.findMany as jest.Mock).mockResolvedValue([
      { surgeryId: 's1', baseSymptomId: 'base-1' },
    ])
    ;(prisma.symptomHistory.findMany as jest.Mock).mockResolvedValue([{ symptomId: 'base-1' }])
  })

  it('counts AI customisation in the batch tracker when history exists', async () => {
    const [snapshot] = await computeSurgerySetupSnapshotsBatch(['s1'])

    expect(snapshot.checklist.aiCustomisationRun).toBe(true)
    expect(snapshot.aiCustomisationOccurred).toBe(true)
    expect(snapshot.essentialCount).toBe(6)
    expect(snapshot.essentialTotal).toBe(6)
  })
})
