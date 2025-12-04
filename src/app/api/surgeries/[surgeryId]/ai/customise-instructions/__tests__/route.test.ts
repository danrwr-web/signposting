import { NextRequest } from 'next/server'
import { POST } from '../route'
import { requireSurgeryAdmin } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'
import { customiseInstructions } from '@/server/aiCustomiseInstructions'
import { getEffectiveSymptoms } from '@/server/effectiveSymptoms'

jest.mock('@/lib/rbac', () => ({
  requireSurgeryAdmin: jest.fn(),
}))

jest.mock('@/lib/prisma', () => ({
  prisma: {
    surgery: {
      findUnique: jest.fn(),
    },
    baseSymptom: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    surgeryCustomSymptom: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    surgerySymptomOverride: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
    symptomHistory: {
      create: jest.fn(),
    },
    symptomReviewStatus: {
      upsert: jest.fn(),
    },
  },
}))

jest.mock('@/server/aiCustomiseInstructions', () => ({
  customiseInstructions: jest.fn(),
}))

jest.mock('@/server/effectiveSymptoms', () => ({
  getEffectiveSymptoms: jest.fn(),
}))

const mockedRequireSurgeryAdmin =
  requireSurgeryAdmin as jest.MockedFunction<typeof requireSurgeryAdmin>
const mockedFindUnique = prisma.surgery.findUnique as jest.MockedFunction<
  typeof prisma.surgery.findUnique
>
const mockedCustomiseInstructions =
  customiseInstructions as jest.MockedFunction<typeof customiseInstructions>
const mockedGetEffectiveSymptoms =
  getEffectiveSymptoms as jest.MockedFunction<typeof getEffectiveSymptoms>
const mockedUpsertOverride =
  prisma.surgerySymptomOverride.upsert as jest.MockedFunction<
    typeof prisma.surgerySymptomOverride.upsert
  >
const mockedCreateHistory =
  prisma.symptomHistory.create as jest.MockedFunction<
    typeof prisma.symptomHistory.create
  >
const mockedUpsertReviewStatus =
  prisma.symptomReviewStatus.upsert as jest.MockedFunction<
    typeof prisma.symptomReviewStatus.upsert
  >

const mockUser = {
  id: 'user-1',
  email: 'admin@example.com',
  name: 'Admin User',
  globalRole: 'USER' as const,
  defaultSurgeryId: 'surgery-1',
  isTestUser: false,
  symptomsUsed: 0,
  memberships: [{ surgeryId: 'surgery-1', role: 'ADMIN' as const }],
}

const createRequest = (body: any) =>
  ({
    json: jest.fn().mockResolvedValue(body),
  } as unknown as NextRequest)

describe('POST /api/surgeries/[surgeryId]/ai/customise-instructions', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('rejects requests if not logged in', async () => {
    mockedRequireSurgeryAdmin.mockRejectedValueOnce(
      new Error('Authentication required')
    )

    const request = createRequest({ scope: 'core' })
    const params = Promise.resolve({ surgeryId: 'surgery-1' })

    const response = await POST(request, { params })

    expect(response.status).toBe(401)
  })

  it('rejects requests if wrong role', async () => {
    mockedRequireSurgeryAdmin.mockRejectedValueOnce(
      new Error('Surgery admin access required')
    )

    const request = createRequest({ scope: 'core' })
    const params = Promise.resolve({ surgeryId: 'surgery-1' })

    const response = await POST(request, { params })

    expect(response.status).toBe(401)
  })

  it('rejects requests if feature flag disabled', async () => {
    mockedRequireSurgeryAdmin.mockResolvedValueOnce(mockUser)
    mockedFindUnique.mockResolvedValueOnce({
      id: 'surgery-1',
      name: 'Test Surgery',
      onboardingProfile: {
        completed: true,
        completedAt: new Date(),
      },
      surgeryFeatureFlags: [
        {
          feature: { key: 'ai_surgery_customisation' },
          enabled: false,
        },
      ],
    } as any)

    const request = createRequest({ scope: 'core' })
    const params = Promise.resolve({ surgeryId: 'surgery-1' })

    const response = await POST(request, { params })
    const json = await response.json()

    expect(response.status).toBe(403)
    expect(json.error).toContain('not enabled')
  })

  it('rejects requests if onboarding incomplete', async () => {
    mockedRequireSurgeryAdmin.mockResolvedValueOnce(mockUser)
    mockedFindUnique.mockResolvedValueOnce({
      id: 'surgery-1',
      name: 'Test Surgery',
      onboardingProfile: {
        completed: false,
        completedAt: null,
      },
      surgeryFeatureFlags: [
        {
          feature: { key: 'ai_surgery_customisation' },
          enabled: true,
        },
      ],
    } as any)

    const request = createRequest({ scope: 'core' })
    const params = Promise.resolve({ surgeryId: 'surgery-1' })

    const response = await POST(request, { params })
    const json = await response.json()

    expect(response.status).toBe(400)
    expect(json.error).toContain('Onboarding profile must be completed')
  })

  it('accepts request and processes symptoms', async () => {
    mockedRequireSurgeryAdmin.mockResolvedValueOnce(mockUser)
    mockedFindUnique.mockResolvedValueOnce({
      id: 'surgery-1',
      name: 'Test Surgery',
      onboardingProfile: {
        completed: true,
        completedAt: new Date(),
        profileJson: {
          surgeryName: 'Test Surgery',
          urgentCareModel: {
            hasDutyDoctor: true,
            dutyDoctorTerm: 'Duty GP',
            usesRedSlots: true,
            urgentSlotsDescription: 'Urgent slots',
          },
          bookingRules: {
            canBookDirectly: [],
            mustNotBookDirectly: '',
          },
          team: {
            roles: [],
            roleRoutingNotes: '',
          },
          escalation: {
            firstEscalation: 'Duty GP',
            urgentWording: 'Urgent',
          },
          localServices: {
            msk: '',
            mentalHealth: '',
            socialPrescribing: '',
            communityNursing: '',
            audiology: '',
            frailty: '',
            sexualHealth: '',
            outOfHours: '',
            includeInInstructions: 'no' as const,
          },
          communicationStyle: {
            detailLevel: 'moderate' as const,
            terminologyPreference: 'mixed' as const,
          },
        },
      },
      surgeryFeatureFlags: [
        {
          feature: { key: 'ai_surgery_customisation' },
          enabled: true,
        },
      ],
    } as any)

    mockedGetEffectiveSymptoms.mockResolvedValueOnce([
      {
        id: 'symptom-1',
        baseSymptomId: 'symptom-1',
        name: 'Test Symptom',
        ageGroup: 'Adult',
        briefInstruction: 'Test brief',
        instructionsHtml: '<p>Test instructions</p>',
        source: 'base' as const,
      },
    ])

    const mockedBaseSymptomFindUnique = prisma.baseSymptom.findUnique as jest.MockedFunction<
      typeof prisma.baseSymptom.findUnique
    >
    mockedBaseSymptomFindUnique.mockResolvedValueOnce({
      id: 'symptom-1',
      name: 'Test Symptom',
      ageGroup: 'Adult',
      briefInstruction: 'Test brief',
      instructionsHtml: '<p>Test instructions</p>',
    } as any)

    const mockedOverrideFindUnique = prisma.surgerySymptomOverride.findUnique as jest.MockedFunction<
      typeof prisma.surgerySymptomOverride.findUnique
    >
    mockedOverrideFindUnique.mockResolvedValueOnce(null)

    mockedCustomiseInstructions.mockResolvedValueOnce({
      briefInstruction: 'Customised brief',
      instructionsHtml: '<p>Customised instructions</p>',
      modelUsed: 'gpt-4o-mini',
    })

    mockedUpsertOverride.mockResolvedValueOnce({} as any)
    mockedCreateHistory.mockResolvedValueOnce({} as any)
    mockedUpsertReviewStatus.mockResolvedValueOnce({} as any)

    const request = createRequest({ scope: 'core' })
    const params = Promise.resolve({ surgeryId: 'surgery-1' })

    const response = await POST(request, { params })
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.processedCount).toBe(1)
    expect(json.skippedCount).toBe(0)
    expect(mockedCustomiseInstructions).toHaveBeenCalled()
    expect(mockedUpsertOverride).toHaveBeenCalled()
    expect(mockedCreateHistory).toHaveBeenCalled()
    expect(mockedUpsertReviewStatus).toHaveBeenCalled()
  })

  it('requires symptomIds when scope is manual', async () => {
    mockedRequireSurgeryAdmin.mockResolvedValueOnce(mockUser)
    mockedFindUnique.mockResolvedValueOnce({
      id: 'surgery-1',
      name: 'Test Surgery',
      onboardingProfile: {
        completed: true,
        completedAt: new Date(),
        profileJson: {},
      },
      surgeryFeatureFlags: [
        {
          feature: { key: 'ai_surgery_customisation' },
          enabled: true,
        },
      ],
    } as any)

    const request = createRequest({ scope: 'manual' })
    const params = Promise.resolve({ surgeryId: 'surgery-1' })

    const response = await POST(request, { params })
    const json = await response.json()

    expect(response.status).toBe(400)
    expect(json.error).toContain('symptomIds')
  })

  it('resets APPROVED status to PENDING with lastReviewedAt cleared', async () => {
    mockedRequireSurgeryAdmin.mockResolvedValueOnce(mockUser)
    mockedFindUnique.mockResolvedValueOnce({
      id: 'surgery-1',
      name: 'Test Surgery',
      onboardingProfile: {
        completed: true,
        completedAt: new Date(),
        profileJson: {
          surgeryName: 'Test Surgery',
          urgentCareModel: {
            hasDutyDoctor: true,
            dutyDoctorTerm: 'Duty GP',
            usesRedSlots: true,
            urgentSlotsDescription: 'Urgent slots',
          },
          bookingRules: {
            canBookDirectly: [],
            mustNotBookDirectly: '',
          },
          team: {
            roles: [],
            roleRoutingNotes: '',
          },
          escalation: {
            firstEscalation: 'Duty GP',
            urgentWording: 'Urgent',
          },
          localServices: {
            msk: '',
            mentalHealth: '',
            socialPrescribing: '',
            communityNursing: '',
            audiology: '',
            frailty: '',
            sexualHealth: '',
            outOfHours: '',
            includeInInstructions: 'no' as const,
          },
          communicationStyle: {
            detailLevel: 'moderate' as const,
            terminologyPreference: 'mixed' as const,
          },
        },
      },
      surgeryFeatureFlags: [
        {
          feature: { key: 'ai_surgery_customisation' },
          enabled: true,
        },
      ],
    } as any)

    mockedGetEffectiveSymptoms.mockResolvedValueOnce([
      {
        id: 'symptom-1',
        name: 'Test Symptom',
        ageGroup: 'Adult',
        briefInstruction: 'Test brief',
        instructionsHtml: '<p>Test instructions</p>',
        source: 'base' as const,
      },
    ])

    const mockedBaseSymptomFindUnique = prisma.baseSymptom.findUnique as jest.MockedFunction<
      typeof prisma.baseSymptom.findUnique
    >
    mockedBaseSymptomFindUnique.mockResolvedValueOnce({
      id: 'symptom-1',
      name: 'Test Symptom',
      ageGroup: 'Adult',
      briefInstruction: 'Test brief',
      instructionsHtml: '<p>Test instructions</p>',
    } as any)

    const mockedOverrideFindUnique = prisma.surgerySymptomOverride.findUnique as jest.MockedFunction<
      typeof prisma.surgerySymptomOverride.findUnique
    >
    mockedOverrideFindUnique.mockResolvedValueOnce(null)

    mockedCustomiseInstructions.mockResolvedValueOnce({
      briefInstruction: 'Customised brief',
      instructionsHtml: '<p>Customised instructions</p>',
      modelUsed: 'gpt-4o-mini',
    })

    mockedUpsertOverride.mockResolvedValueOnce({} as any)
    mockedCreateHistory.mockResolvedValueOnce({} as any)

    const request = createRequest({ scope: 'core' })
    const params = Promise.resolve({ surgeryId: 'surgery-1' })

    const response = await POST(request, { params })
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.processedCount).toBe(1)
    expect(json.skippedCount).toBe(0)

    // Verify that SymptomReviewStatus is set to PENDING with lastReviewedAt = null
    expect(mockedUpsertReviewStatus).toHaveBeenCalledWith({
      where: {
        surgeryId_symptomId_ageGroup: {
          surgeryId: 'surgery-1',
          symptomId: 'symptom-1',
          ageGroup: 'Adult',
        },
      },
      create: {
        surgeryId: 'surgery-1',
        symptomId: 'symptom-1',
        ageGroup: 'Adult',
        status: 'PENDING',
        lastReviewedAt: null,
        reviewNote: 'AI customisation based on onboarding profile – pending clinical review',
      },
      update: {
        status: 'PENDING',
        lastReviewedAt: null,
        reviewNote: 'AI customisation based on onboarding profile – pending clinical review',
      },
    })
  })

  it('skips symptoms with no content to customise', async () => {
    mockedRequireSurgeryAdmin.mockResolvedValueOnce(mockUser)
    mockedFindUnique.mockResolvedValueOnce({
      id: 'surgery-1',
      name: 'Test Surgery',
      onboardingProfile: {
        completed: true,
        completedAt: new Date(),
        profileJson: {
          surgeryName: 'Test Surgery',
          urgentCareModel: {
            hasDutyDoctor: true,
            dutyDoctorTerm: 'Duty GP',
            usesRedSlots: true,
            urgentSlotsDescription: 'Urgent slots',
          },
          bookingRules: {
            canBookDirectly: [],
            mustNotBookDirectly: '',
          },
          team: {
            roles: [],
            roleRoutingNotes: '',
          },
          escalation: {
            firstEscalation: 'Duty GP',
            urgentWording: 'Urgent',
          },
          localServices: {
            msk: '',
            mentalHealth: '',
            socialPrescribing: '',
            communityNursing: '',
            audiology: '',
            frailty: '',
            sexualHealth: '',
            outOfHours: '',
            includeInInstructions: 'no' as const,
          },
          communicationStyle: {
            detailLevel: 'moderate' as const,
            terminologyPreference: 'mixed' as const,
          },
        },
      },
      surgeryFeatureFlags: [
        {
          feature: { key: 'ai_surgery_customisation' },
          enabled: true,
        },
      ],
    } as any)

    mockedGetEffectiveSymptoms.mockResolvedValueOnce([
      {
        id: 'symptom-1',
        name: 'Test Symptom',
        ageGroup: 'Adult',
        briefInstruction: null,
        instructionsHtml: null,
        source: 'base' as const,
      },
    ])

    const mockedBaseSymptomFindUnique = prisma.baseSymptom.findUnique as jest.MockedFunction<
      typeof prisma.baseSymptom.findUnique
    >
    mockedBaseSymptomFindUnique.mockResolvedValueOnce({
      id: 'symptom-1',
      name: 'Test Symptom',
      ageGroup: 'Adult',
      briefInstruction: null,
      instructionsHtml: null,
    } as any)

    const request = createRequest({ scope: 'core' })
    const params = Promise.resolve({ surgeryId: 'surgery-1' })

    const response = await POST(request, { params })
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.processedCount).toBe(0)
    expect(json.skippedCount).toBe(1)
    expect(mockedCustomiseInstructions).not.toHaveBeenCalled()
  })
})

