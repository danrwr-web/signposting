import { NextRequest } from 'next/server'
import { GET, PUT } from '../route'
import { requireSurgeryAdmin } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'

jest.mock('@/lib/rbac', () => ({
  requireSurgeryAdmin: jest.fn(),
}))

jest.mock('@/lib/prisma', () => ({
  prisma: {
    surgery: {
      findUnique: jest.fn(),
    },
    surgeryOnboardingProfile: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
  },
}))

const mockedRequireSurgeryAdmin =
  requireSurgeryAdmin as jest.MockedFunction<typeof requireSurgeryAdmin>
const mockedFindUnique = prisma.surgery.findUnique as jest.MockedFunction<
  typeof prisma.surgery.findUnique
>
const mockedProfileFindUnique =
  prisma.surgeryOnboardingProfile.findUnique as jest.MockedFunction<
    typeof prisma.surgeryOnboardingProfile.findUnique
  >
const mockedProfileUpsert =
  prisma.surgeryOnboardingProfile.upsert as jest.MockedFunction<
    typeof prisma.surgeryOnboardingProfile.upsert
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

const createRequest = (body?: any) =>
  ({
    json: jest.fn().mockResolvedValue(body),
  } as unknown as NextRequest)

describe('GET /api/surgeries/[surgeryId]/onboarding', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockedRequireSurgeryAdmin.mockResolvedValue(mockUser as any)
    mockedFindUnique.mockResolvedValue({
      id: 'surgery-1',
      name: 'Test Surgery',
      slug: 'test-surgery',
    } as any)
  })

  it('returns default appointmentModel when profile does not exist', async () => {
    mockedProfileFindUnique.mockResolvedValue(null)

    const request = createRequest()
    const params = Promise.resolve({ surgeryId: 'surgery-1' })

    const response = await GET(request, { params })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.profileJson.appointmentModel).toBeDefined()
    expect(data.profileJson.appointmentModel.routineContinuityGp.enabled).toBe(false)
    expect(data.profileJson.appointmentModel.routineContinuityGp.localName).toBe('')
    expect(data.profileJson.appointmentModel.routineContinuityGp.clinicianRole).toBe('')
    expect(data.profileJson.appointmentModel.routineContinuityGp.description).toBe('')
  })

  it('adds default appointmentModel to existing profile without it', async () => {
    const existingProfile = {
      id: 'profile-1',
      surgeryId: 'surgery-1',
      profileJson: {
        surgeryName: 'Test Surgery',
        urgentCareModel: {
          hasDutyDoctor: true,
          dutyDoctorTerm: 'Duty Doctor',
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
          firstEscalation: null,
          urgentWording: '',
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
        // No appointmentModel
      },
      completed: false,
      completedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    mockedProfileFindUnique.mockResolvedValue(existingProfile as any)

    const request = createRequest()
    const params = Promise.resolve({ surgeryId: 'surgery-1' })

    const response = await GET(request, { params })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.profileJson.appointmentModel).toBeDefined()
    expect(data.profileJson.appointmentModel.routineContinuityGp.enabled).toBe(false)
  })

  it('preserves existing appointmentModel when present', async () => {
    const existingProfile = {
      id: 'profile-1',
      surgeryId: 'surgery-1',
      profileJson: {
        surgeryName: 'Test Surgery',
        urgentCareModel: {
          hasDutyDoctor: true,
          dutyDoctorTerm: 'Duty Doctor',
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
          firstEscalation: null,
          urgentWording: '',
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
            enabled: false,
            localName: '',
            clinicianRole: '',
            description: '',
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
      completed: false,
      completedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    mockedProfileFindUnique.mockResolvedValue(existingProfile as any)

    const request = createRequest()
    const params = Promise.resolve({ surgeryId: 'surgery-1' })

    const response = await GET(request, { params })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.profileJson.appointmentModel.routineContinuityGp.enabled).toBe(true)
    expect(data.profileJson.appointmentModel.routineContinuityGp.localName).toBe('Green Slot')
    // Should have clinicianArchetypes array added for backward compatibility
    expect(Array.isArray(data.profileJson.appointmentModel.clinicianArchetypes)).toBe(true)
    expect(data.profileJson.appointmentModel.clinicianArchetypes.length).toBeGreaterThan(0)
  })

  it('adds default clinicianArchetypes to existing profile without them', async () => {
    const existingProfile = {
      id: 'profile-1',
      surgeryId: 'surgery-1',
      profileJson: {
        surgeryName: 'Test Surgery',
        urgentCareModel: {
          hasDutyDoctor: true,
          dutyDoctorTerm: 'Duty Doctor',
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
          firstEscalation: null,
          urgentWording: '',
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
            enabled: false,
            localName: '',
            clinicianRole: '',
            description: '',
          },
          routineGpPhone: {
            enabled: false,
            localName: '',
            clinicianRole: '',
            description: '',
          },
          gpTriage48h: {
            enabled: false,
            localName: '',
            clinicianRole: '',
            description: '',
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
          // No clinicianArchetypes
        },
      },
      completed: false,
      completedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    mockedProfileFindUnique.mockResolvedValue(existingProfile as any)

    const request = createRequest()
    const params = Promise.resolve({ surgeryId: 'surgery-1' })

    const response = await GET(request, { params })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(Array.isArray(data.profileJson.appointmentModel.clinicianArchetypes)).toBe(true)
    expect(data.profileJson.appointmentModel.clinicianArchetypes.length).toBe(4)
    expect(data.profileJson.appointmentModel.clinicianArchetypes.find((ca: any) => ca.key === 'ANP')).toBeDefined()
    expect(data.profileJson.appointmentModel.clinicianArchetypes.find((ca: any) => ca.key === 'PHARMACIST')).toBeDefined()
    expect(data.profileJson.appointmentModel.clinicianArchetypes.find((ca: any) => ca.key === 'FCP')).toBeDefined()
    expect(data.profileJson.appointmentModel.clinicianArchetypes.find((ca: any) => ca.key === 'OTHER')).toBeDefined()
  })

  it('migrates legacy otherClinicianDirect to ANP archetype when appropriate', async () => {
    const existingProfile = {
      id: 'profile-1',
      surgeryId: 'surgery-1',
      profileJson: {
        surgeryName: 'Test Surgery',
        urgentCareModel: {
          hasDutyDoctor: true,
          dutyDoctorTerm: 'Duty Doctor',
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
          firstEscalation: null,
          urgentWording: '',
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
            enabled: false,
            localName: '',
            clinicianRole: '',
            description: '',
          },
          routineGpPhone: {
            enabled: false,
            localName: '',
            clinicianRole: '',
            description: '',
          },
          gpTriage48h: {
            enabled: false,
            localName: '',
            clinicianRole: '',
            description: '',
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
            enabled: true,
            localName: 'ANP Minor Illness Clinic',
            clinicianRole: 'ANP',
            description: 'Used for minor illness',
          },
        },
      },
      completed: false,
      completedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    mockedProfileFindUnique.mockResolvedValue(existingProfile as any)

    const request = createRequest()
    const params = Promise.resolve({ surgeryId: 'surgery-1' })

    const response = await GET(request, { params })
    const data = await response.json()

    expect(response.status).toBe(200)
    const anpArchetype = data.profileJson.appointmentModel.clinicianArchetypes.find((ca: any) => ca.key === 'ANP')
    expect(anpArchetype).toBeDefined()
    expect(anpArchetype.enabled).toBe(true)
    expect(anpArchetype.localName).toBe('ANP Minor Illness Clinic')
    expect(anpArchetype.role).toBe('ANP')
    expect(anpArchetype.description).toBe('Used for minor illness')
  })
})

describe('PUT /api/surgeries/[surgeryId]/onboarding', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockedRequireSurgeryAdmin.mockResolvedValue(mockUser as any)
    mockedFindUnique.mockResolvedValue({
      id: 'surgery-1',
      name: 'Test Surgery',
      slug: 'test-surgery',
    } as any)
  })

  it('validates and stores appointmentModel correctly', async () => {
    const profileData = {
      surgeryName: 'Test Surgery',
      urgentCareModel: {
        hasDutyDoctor: true,
        dutyDoctorTerm: 'Duty Doctor',
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
        firstEscalation: null,
        urgentWording: '',
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
    }

    mockedProfileFindUnique.mockResolvedValue(null)
    mockedProfileUpsert.mockResolvedValue({
      id: 'profile-1',
      surgeryId: 'surgery-1',
      profileJson: profileData,
      completed: false,
      completedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any)

    const request = createRequest({
      profileJson: profileData,
      completed: false,
    })
    const params = Promise.resolve({ surgeryId: 'surgery-1' })

    const response = await PUT(request, { params })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.profileJson.appointmentModel).toBeDefined()
    expect(data.profileJson.appointmentModel.routineContinuityGp.enabled).toBe(true)
    expect(data.profileJson.appointmentModel.routineContinuityGp.localName).toBe('Green Slot')
    expect(data.profileJson.appointmentModel.gpTriage48h.enabled).toBe(true)
    expect(data.profileJson.appointmentModel.gpTriage48h.localName).toBe('Pink/Purple Slot')
  })

  it('rejects invalid appointmentModel structure', async () => {
    const invalidProfileData = {
      surgeryName: 'Test Surgery',
      urgentCareModel: {
        hasDutyDoctor: true,
        dutyDoctorTerm: 'Duty Doctor',
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
        firstEscalation: null,
        urgentWording: '',
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
          enabled: 'invalid', // Should be boolean
          localName: 'Green Slot',
        },
        // Missing other required fields
      },
    }

    const request = createRequest({
      profileJson: invalidProfileData,
      completed: false,
    })
    const params = Promise.resolve({ surgeryId: 'surgery-1' })

    const response = await PUT(request, { params })

    expect(response.status).toBe(400)
  })
})

