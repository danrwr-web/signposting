import { NextRequest } from 'next/server'
import { POST } from '../route'
import { getSessionUser } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'
import { generateUniqueSymptomSlug } from '@/server/symptomSlug'
import { revalidateTag } from 'next/cache'
import { getCachedSymptomsTag } from '@/server/effectiveSymptoms'

jest.mock('@/lib/rbac', () => ({
  getSessionUser: jest.fn(),
}))

jest.mock('@/lib/prisma', () => ({
  prisma: {
    surgery: { findUnique: jest.fn() },
    baseSymptom: { create: jest.fn() },
    surgeryCustomSymptom: { create: jest.fn() },
    surgerySymptomStatus: { upsert: jest.fn() },
    symptomReviewStatus: { upsert: jest.fn() },
  },
}))

jest.mock('@/server/symptomSlug', () => ({
  generateUniqueSymptomSlug: jest.fn(),
}))

jest.mock('@/server/updateRequiresClinicalReview', () => ({
  updateRequiresClinicalReview: jest.fn(),
}))

jest.mock('next/cache', () => ({
  revalidateTag: jest.fn(),
}))

jest.mock('@/server/effectiveSymptoms', () => ({
  getCachedSymptomsTag: jest.fn((surgeryId: string, includeDisabled: boolean) =>
    `symptoms:${surgeryId}:${includeDisabled ? 'with-disabled' : 'enabled'}`
  ),
}))

const mockedGetSessionUser = getSessionUser as jest.MockedFunction<typeof getSessionUser>
const mockedGenerateUniqueSymptomSlug = generateUniqueSymptomSlug as jest.MockedFunction<typeof generateUniqueSymptomSlug>
const mockedGetCachedSymptomsTag = getCachedSymptomsTag as jest.MockedFunction<typeof getCachedSymptomsTag>
const mockedRevalidateTag = revalidateTag as jest.MockedFunction<typeof revalidateTag>

const createRequest = (body: any) =>
  ({
    json: jest.fn().mockResolvedValue(body),
  } as unknown as NextRequest)

describe('POST /api/symptoms/create', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('creates a BASE symptom without a surgeryId', async () => {
    mockedGetSessionUser.mockResolvedValueOnce({
      globalRole: 'SUPERUSER',
      email: 'super@example.com',
      name: 'Super',
      surgeryId: null,
      memberships: [],
      defaultSurgeryId: null,
    } as any)

    mockedGenerateUniqueSymptomSlug.mockResolvedValueOnce('chest-pain')

    ;(prisma.baseSymptom.create as jest.Mock).mockResolvedValueOnce({ id: 'base-1' })

    const req = createRequest({
      target: 'BASE',
      name: 'Chest Pain',
      ageGroup: 'Adult',
      instructionsHtml: '<p>Test</p>',
    })

    const res = await POST(req)
    expect(res.status).toBe(201)
    expect(prisma.baseSymptom.create).toHaveBeenCalled()
    expect(mockedRevalidateTag).toHaveBeenCalledWith('symptoms')
  })

  it('creates a SURGERY symptom for superuser with a CUID surgeryId', async () => {
    mockedGetSessionUser.mockResolvedValueOnce({
      globalRole: 'SUPERUSER',
      email: 'super@example.com',
      name: 'Super',
      surgeryId: null,
      memberships: [],
      defaultSurgeryId: null,
    } as any)

    mockedGenerateUniqueSymptomSlug.mockResolvedValueOnce('chest-pain')

    ;(prisma.surgery.findUnique as jest.Mock).mockResolvedValueOnce({ id: 'cmk5p08xt0000ju04k9s0udri' })
    ;(prisma.surgeryCustomSymptom.create as jest.Mock).mockResolvedValueOnce({ id: 'custom-1' })
    ;(prisma.surgerySymptomStatus.upsert as jest.Mock).mockResolvedValueOnce({})

    const req = createRequest({
      target: 'SURGERY',
      surgeryId: 'cmk5p08xt0000ju04k9s0udri',
      name: 'Chest Pain',
      ageGroup: 'Adult',
      instructionsHtml: '<p>Test</p>',
    })

    const res = await POST(req)
    expect(res.status).toBe(201)
    expect(prisma.surgeryCustomSymptom.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          surgeryId: 'cmk5p08xt0000ju04k9s0udri',
          slug: 'chest-pain',
          name: 'Chest Pain',
        }),
      })
    )
    expect(prisma.surgerySymptomStatus.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          surgeryId_customSymptomId: {
            surgeryId: 'cmk5p08xt0000ju04k9s0udri',
            customSymptomId: 'custom-1',
          },
        },
      })
    )
    expect(mockedGetCachedSymptomsTag).toHaveBeenCalledWith('cmk5p08xt0000ju04k9s0udri', false)
    expect(mockedGetCachedSymptomsTag).toHaveBeenCalledWith('cmk5p08xt0000ju04k9s0udri', true)
    expect(mockedRevalidateTag).toHaveBeenCalledWith('symptoms:cmk5p08xt0000ju04k9s0udri:enabled')
    expect(mockedRevalidateTag).toHaveBeenCalledWith('symptoms:cmk5p08xt0000ju04k9s0udri:with-disabled')
    expect(mockedRevalidateTag).toHaveBeenCalledWith('symptoms')
  })

  it('creates a SURGERY symptom for a surgery admin (non-superuser) when surgeryId matches membership', async () => {
    mockedGetSessionUser.mockResolvedValueOnce({
      globalRole: 'USER',
      email: 'admin@example.com',
      name: 'Admin',
      surgeryId: null,
      defaultSurgeryId: 'cmk5p08xt0000ju04k9s0udri',
      memberships: [{ surgeryId: 'cmk5p08xt0000ju04k9s0udri', role: 'ADMIN' }],
    } as any)

    mockedGenerateUniqueSymptomSlug.mockResolvedValueOnce('chest-pain')

    ;(prisma.surgery.findUnique as jest.Mock).mockResolvedValueOnce({ id: 'cmk5p08xt0000ju04k9s0udri' })
    ;(prisma.surgeryCustomSymptom.create as jest.Mock).mockResolvedValueOnce({ id: 'custom-1' })
    ;(prisma.surgerySymptomStatus.upsert as jest.Mock).mockResolvedValueOnce({})

    const req = createRequest({
      target: 'SURGERY',
      surgeryId: 'cmk5p08xt0000ju04k9s0udri',
      name: 'Chest Pain',
      ageGroup: 'Adult',
      instructionsHtml: '<p>Test</p>',
    })

    const res = await POST(req)
    expect(res.status).toBe(201)
  })

  it('returns 403 for SURGERY create when user is not admin for the target surgeryId', async () => {
    mockedGetSessionUser.mockResolvedValueOnce({
      globalRole: 'USER',
      email: 'user@example.com',
      name: 'User',
      surgeryId: null,
      defaultSurgeryId: 'cmk5p08xt0000ju04k9s0udri',
      memberships: [{ surgeryId: 'cmk5p08xt0000ju04k9s0udri', role: 'STANDARD' }],
    } as any)

    const req = createRequest({
      target: 'SURGERY',
      surgeryId: 'cmk5p08xt0000ju04k9s0udri',
      name: 'Chest Pain',
      ageGroup: 'Adult',
      instructionsHtml: '<p>Test</p>',
    })

    const res = await POST(req)
    expect(res.status).toBe(403)
    const json = await res.json()
    expect(json.error).toBe('Forbidden')
    expect(json.reason).toBe('User lacks admin access to surgeryId')
  })

  it('creates a SURGERY symptom when surgeryId is a legacy non-CUID id', async () => {
    mockedGetSessionUser.mockResolvedValueOnce({
      globalRole: 'USER',
      email: 'admin@example.com',
      name: 'Admin',
      surgeryId: null,
      defaultSurgeryId: 'surgery-1',
      memberships: [{ surgeryId: 'surgery-1', role: 'ADMIN' }],
    } as any)

    mockedGenerateUniqueSymptomSlug.mockResolvedValueOnce('oral-thrush')

    ;(prisma.surgery.findUnique as jest.Mock).mockResolvedValueOnce({ id: 'surgery-1' })
    ;(prisma.surgeryCustomSymptom.create as jest.Mock).mockResolvedValueOnce({ id: 'custom-1' })
    ;(prisma.surgerySymptomStatus.upsert as jest.Mock).mockResolvedValueOnce({})

    const req = createRequest({
      target: 'SURGERY',
      surgeryId: 'surgery-1',
      name: 'Oral Thrush',
      ageGroup: 'U5',
      instructionsHtml: '<p>Test</p>',
    })

    const res = await POST(req)
    expect(res.status).toBe(201)
    expect(prisma.surgeryCustomSymptom.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          surgeryId: 'surgery-1',
          name: 'Oral Thrush',
          ageGroup: 'U5',
        }),
      })
    )
  })

  it('returns 404 for SURGERY create when the surgery does not exist', async () => {
    mockedGetSessionUser.mockResolvedValueOnce({
      globalRole: 'SUPERUSER',
      email: 'super@example.com',
      name: 'Super',
      surgeryId: null,
      memberships: [],
      defaultSurgeryId: null,
    } as any)

    ;(prisma.surgery.findUnique as jest.Mock).mockResolvedValueOnce(null)

    const req = createRequest({
      target: 'SURGERY',
      surgeryId: 'no-such-surgery',
      name: 'Chest Pain',
      ageGroup: 'Adult',
      instructionsHtml: '<p>Test</p>',
    })

    const res = await POST(req)
    expect(res.status).toBe(404)
    const json = await res.json()
    expect(json.error).toBe('Surgery not found')
    expect(prisma.surgeryCustomSymptom.create).not.toHaveBeenCalled()
  })
})

