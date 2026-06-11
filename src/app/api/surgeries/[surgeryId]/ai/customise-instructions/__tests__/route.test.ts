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
    $transaction: jest.fn(async (fn: any) => fn((require('@/lib/prisma') as any).prisma)),
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

  it('passes appointmentModel to customiseInstructions when present', async () => {
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
            usesRedSlots: false,
            urgentSlotsDescription: '',
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
          aiSettings: {
            customisationScope: 'core' as const,
            requireClinicalReview: true,
          },
          appointmentModel: {
            routineContinuityGp: {
              enabled: true,
              localName: 'Green Slot',
              clinicianRole: 'GP',
              description: 'Routine continuity appointments',
            },
            routineGpPhone: {
              enabled: false,
              localName: '',
              clinicianRole: '',
              description: '',
            },
            gpTriage48h: {
              enabled: true,
              localName: 'Pink/Purple Slot',
              clinicianRole: 'GP',
              description: 'GP triage within 48 hours',
            },
            urgentSameDayPhone: {
              enabled: false,
              localName: '',
              clinicianRole: '',
              description: '',
            },
            urgentSameDayF2F: {
              enabled: false,
              localName: '',
              clinicianRole: '',
              description: '',
            },
            otherClinicianDirect: {
              enabled: false,
              localName: '',
              clinicianRole: '',
              description: '',
            },
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
    
    // Verify customiseInstructions was called with appointmentModel
    expect(mockedCustomiseInstructions).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Test Symptom',
        ageGroup: 'Adult',
      }),
      expect.objectContaining({
        appointmentModel: expect.objectContaining({
          routineContinuityGp: expect.objectContaining({
            enabled: true,
            localName: 'Green Slot',
          }),
          gpTriage48h: expect.objectContaining({
            enabled: true,
            localName: 'Pink/Purple Slot',
          }),
        }),
      }),
      'admin@example.com'
    )
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

  describe('highlightedText (Important Notice) customisation', () => {
    const surgeryRow = {
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
          bookingRules: { canBookDirectly: [], mustNotBookDirectly: '' },
          team: { roles: [], roleRoutingNotes: '' },
          escalation: { firstEscalation: 'Duty GP', urgentWording: 'Urgent' },
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
        { feature: { key: 'ai_surgery_customisation' }, enabled: true },
      ],
    }

    const mockedBaseSymptomFindUnique = prisma.baseSymptom.findUnique as jest.MockedFunction<
      typeof prisma.baseSymptom.findUnique
    >
    const mockedOverrideFindUnique = prisma.surgerySymptomOverride.findUnique as jest.MockedFunction<
      typeof prisma.surgerySymptomOverride.findUnique
    >

    const setupBaseSymptomRun = (highlightedText: string | null) => {
      mockedRequireSurgeryAdmin.mockResolvedValueOnce(mockUser)
      mockedFindUnique.mockResolvedValueOnce(surgeryRow as any)
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
      ] as any)
      mockedBaseSymptomFindUnique.mockResolvedValueOnce({
        id: 'symptom-1',
        name: 'Test Symptom',
        ageGroup: 'Adult',
        briefInstruction: 'Test brief',
        highlightedText,
        instructionsHtml: '<p>Test instructions</p>',
      } as any)
      mockedOverrideFindUnique.mockResolvedValueOnce(null)
      mockedUpsertOverride.mockResolvedValueOnce({} as any)
      mockedCreateHistory.mockResolvedValueOnce({} as any)
      mockedUpsertReviewStatus.mockResolvedValueOnce({} as any)
    }

    const runPost = async () => {
      const request = createRequest({ scope: 'core' })
      const params = Promise.resolve({ surgeryId: 'surgery-1' })
      const response = await POST(request, { params })
      return { response, json: await response.json() }
    }

    it('writes the customised notice to the override and records history', async () => {
      const baseNotice = 'EMERGENCY CARE: use the pink/purple/red telephone slot'
      const newNotice = 'EMERGENCY CARE: call the Duty GP line'
      setupBaseSymptomRun(baseNotice)
      mockedCustomiseInstructions.mockResolvedValueOnce({
        briefInstruction: 'Customised brief',
        instructionsHtml: '<p>Customised instructions</p>',
        highlightedText: newNotice,
        modelUsed: 'gpt-4o-mini',
      })

      const { response, json } = await runPost()

      expect(response.status).toBe(200)
      expect(json.processedCount).toBe(1)
      expect(mockedCustomiseInstructions).toHaveBeenCalledWith(
        expect.objectContaining({ highlightedText: baseNotice }),
        expect.anything(),
        'admin@example.com'
      )
      expect(mockedUpsertOverride).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ highlightedText: newNotice }),
          update: expect.objectContaining({ highlightedText: newNotice }),
        })
      )
      expect(mockedCreateHistory).toHaveBeenCalledWith({
        data: expect.objectContaining({
          previousHighlightedText: baseNotice,
          newHighlightedText: newNotice,
        }),
      })
    })

    it('does not write highlightedText when the AI result omits it', async () => {
      const baseNotice = 'EMERGENCY CARE: use the pink/purple/red telephone slot'
      setupBaseSymptomRun(baseNotice)
      mockedCustomiseInstructions.mockResolvedValueOnce({
        briefInstruction: 'Customised brief',
        instructionsHtml: '<p>Customised instructions</p>',
        modelUsed: 'gpt-4o-mini',
      })

      const { response, json } = await runPost()

      expect(response.status).toBe(200)
      expect(json.processedCount).toBe(1)
      const upsertArgs = mockedUpsertOverride.mock.calls[0][0]
      expect(Object.keys(upsertArgs.create)).not.toContain('highlightedText')
      expect(Object.keys(upsertArgs.update)).not.toContain('highlightedText')
      expect(mockedCreateHistory).toHaveBeenCalledWith({
        data: expect.objectContaining({
          previousHighlightedText: baseNotice,
          newHighlightedText: baseNotice,
        }),
      })
    })

    it('does not write highlightedText when the base had no notice, even if the AI returns one', async () => {
      setupBaseSymptomRun(null)
      mockedCustomiseInstructions.mockResolvedValueOnce({
        briefInstruction: 'Customised brief',
        instructionsHtml: '<p>Customised instructions</p>',
        highlightedText: 'An invented notice',
        modelUsed: 'gpt-4o-mini',
      })

      const { response, json } = await runPost()

      expect(response.status).toBe(200)
      expect(json.processedCount).toBe(1)
      const upsertArgs = mockedUpsertOverride.mock.calls[0][0]
      expect(Object.keys(upsertArgs.create)).not.toContain('highlightedText')
      expect(Object.keys(upsertArgs.update)).not.toContain('highlightedText')
      expect(mockedCreateHistory).toHaveBeenCalledWith({
        data: expect.objectContaining({
          previousHighlightedText: null,
          newHighlightedText: null,
        }),
      })
    })

    it('writes the customised notice on the custom-symptom path', async () => {
      const baseNotice = 'EMERGENCY CARE: use the red telephone slot'
      const newNotice = 'EMERGENCY CARE: call the Duty GP line'
      mockedRequireSurgeryAdmin.mockResolvedValueOnce(mockUser)
      mockedFindUnique.mockResolvedValueOnce(surgeryRow as any)
      mockedGetEffectiveSymptoms.mockResolvedValueOnce([
        {
          id: 'custom-1',
          customSymptomId: 'custom-1',
          name: 'Custom Symptom',
          ageGroup: 'Adult',
          briefInstruction: 'Test brief',
          instructionsHtml: '<p>Test instructions</p>',
          source: 'custom' as const,
        },
      ] as any)
      const mockedCustomFindUnique = prisma.surgeryCustomSymptom.findUnique as jest.MockedFunction<
        typeof prisma.surgeryCustomSymptom.findUnique
      >
      const mockedCustomUpdate = prisma.surgeryCustomSymptom.update as jest.MockedFunction<
        typeof prisma.surgeryCustomSymptom.update
      >
      mockedCustomFindUnique.mockResolvedValueOnce({
        id: 'custom-1',
        name: 'Custom Symptom',
        ageGroup: 'Adult',
        briefInstruction: 'Test brief',
        highlightedText: baseNotice,
        instructionsHtml: '<p>Test instructions</p>',
      } as any)
      mockedCustomiseInstructions.mockResolvedValueOnce({
        briefInstruction: 'Customised brief',
        instructionsHtml: '<p>Customised instructions</p>',
        highlightedText: newNotice,
        modelUsed: 'gpt-4o-mini',
      })
      mockedCustomUpdate.mockResolvedValueOnce({} as any)
      mockedCreateHistory.mockResolvedValueOnce({} as any)
      mockedUpsertReviewStatus.mockResolvedValueOnce({} as any)

      const { response, json } = await runPost()

      expect(response.status).toBe(200)
      expect(json.processedCount).toBe(1)
      expect(mockedCustomUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ highlightedText: newNotice }),
        })
      )
      expect(mockedCreateHistory).toHaveBeenCalledWith({
        data: expect.objectContaining({
          previousHighlightedText: baseNotice,
          newHighlightedText: newNotice,
        }),
      })
    })
  })
})

