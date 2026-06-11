import { countPendingClinicalReviews } from '@/server/clinicalReview'
import { prisma } from '@/lib/prisma'
import { getEffectiveSymptoms } from '@/server/effectiveSymptoms'

jest.mock('@/lib/prisma', () => ({
  prisma: {
    symptomReviewStatus: { findMany: jest.fn() },
  },
}))

jest.mock('@/server/effectiveSymptoms', () => ({
  getEffectiveSymptoms: jest.fn(),
}))

const mockFindMany = prisma.symptomReviewStatus.findMany as jest.Mock
const mockGetEffectiveSymptoms = getEffectiveSymptoms as jest.Mock

describe('countPendingClinicalReviews', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('counts explicit PENDING, CHANGES_REQUIRED and missing statuses as awaiting review', async () => {
    mockGetEffectiveSymptoms.mockResolvedValue([
      { id: 'a', ageGroup: 'Adult' },
      { id: 'b', ageGroup: 'Adult' },
      { id: 'c', ageGroup: 'Adult' },
      { id: 'd', ageGroup: 'Adult' },
    ])
    mockFindMany.mockResolvedValue([
      { symptomId: 'a', ageGroup: 'Adult', status: 'PENDING' },
      { symptomId: 'b', ageGroup: 'Adult', status: 'CHANGES_REQUIRED' },
      { symptomId: 'c', ageGroup: 'Adult', status: 'APPROVED' },
      // d has no status row -> implicitly pending
    ])

    await expect(countPendingClinicalReviews('sur_1')).resolves.toBe(3)
    expect(mockGetEffectiveSymptoms).toHaveBeenCalledWith('sur_1', false)
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { surgeryId: 'sur_1' } })
    )
  })

  it('treats a legacy null-ageGroup APPROVED row as approved', async () => {
    mockGetEffectiveSymptoms.mockResolvedValue([{ id: 'a', ageGroup: 'Adult' }])
    mockFindMany.mockResolvedValue([
      { symptomId: 'a', ageGroup: null, status: 'APPROVED' },
    ])

    await expect(countPendingClinicalReviews('sur_1')).resolves.toBe(0)
  })

  it('uses preloaded symptoms without re-resolving effective symptoms', async () => {
    mockFindMany.mockResolvedValue([])

    await expect(
      countPendingClinicalReviews('sur_1', [
        { id: 'a', ageGroup: 'Adult' },
        { id: 'b', ageGroup: 'U5' },
      ])
    ).resolves.toBe(2)
    expect(mockGetEffectiveSymptoms).not.toHaveBeenCalled()
  })

  it('returns zero when there are no enabled symptoms', async () => {
    mockGetEffectiveSymptoms.mockResolvedValue([])
    mockFindMany.mockResolvedValue([
      { symptomId: 'disabled', ageGroup: 'Adult', status: 'PENDING' },
    ])

    await expect(countPendingClinicalReviews('sur_1')).resolves.toBe(0)
  })
})
