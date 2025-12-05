import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { requireSurgeryAdmin } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'
import { GetOnboardingProfileResZ, UpdateOnboardingProfileReqZ, SurgeryOnboardingProfileJsonZ } from '@/lib/api-contracts'
import { z } from 'zod'

export const runtime = 'nodejs'

// Default profile shape
const getDefaultProfile = (): z.infer<typeof SurgeryOnboardingProfileJsonZ> => ({
  surgeryName: null,
  urgentCareModel: {
    hasDutyDoctor: false,
    dutyDoctorTerm: null,
    usesRedSlots: false,
    redSlotName: null,
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
    includeInInstructions: 'no',
  },
  communicationStyle: {
    detailLevel: 'moderate',
    terminologyPreference: 'mixed',
  },
  aiSettings: {
    customisationScope: 'core',
    requireClinicalReview: true,
  },
  appointmentModel: {
    routineContinuityGp: { enabled: false, localName: '', clinicianRole: '', description: '' },
    routineGpPhone: { enabled: false, localName: '', clinicianRole: '', description: '' },
    gpTriage48h: { enabled: false, localName: '', clinicianRole: '', description: '' },
    urgentSameDayPhone: { enabled: false, localName: '', clinicianRole: '', description: '' },
    urgentSameDayF2F: { enabled: false, localName: '', clinicianRole: '', description: '' },
    otherClinicianDirect: { enabled: false, localName: '', clinicianRole: '', description: '' },
    clinicianArchetypes: [
      { key: 'ANP', enabled: false, localName: null, role: 'ANP', description: null },
      { key: 'PHARMACIST', enabled: false, localName: null, role: 'Clinical Pharmacist', description: null },
      { key: 'FCP', enabled: false, localName: null, role: 'First Contact Physiotherapist', description: null },
      { key: 'OTHER', enabled: false, localName: null, role: null, description: null },
    ],
  },
})

// GET /api/surgeries/[surgeryId]/onboarding
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ surgeryId: string }> }
) {
  try {
    const { surgeryId } = await params
    await requireSurgeryAdmin(surgeryId)

    // Check if surgery exists
    const surgery = await prisma.surgery.findUnique({
      where: { id: surgeryId },
    })

    if (!surgery) {
      return NextResponse.json({ error: 'Surgery not found' }, { status: 404 })
    }

    // Look up onboarding profile
    const profile = await prisma.surgeryOnboardingProfile.findUnique({
      where: { surgeryId },
    })

    if (profile) {
      // Handle backwards compatibility: ensure urgentCareModel and appointmentModel have defaults
      const profileData = profile.profileJson as any
      const defaultProfile = getDefaultProfile()
      
      // Ensure urgentCareModel exists with defaults (handle both missing object and missing field)
      if (!profileData.urgentCareModel || !profileData.urgentCareModel.urgentSlotsDescription) {
        profileData.urgentCareModel = {
          ...defaultProfile.urgentCareModel,
          ...profileData.urgentCareModel,
          urgentSlotsDescription: profileData.urgentCareModel?.urgentSlotsDescription ?? '',
        }
      }
      
      // Ensure appointmentModel exists with defaults
      if (!profileData.appointmentModel) {
        profileData.appointmentModel = defaultProfile.appointmentModel
      } else {
        // Ensure clinicianArchetypes exists with defaults (backward compatibility)
        if (!profileData.appointmentModel.clinicianArchetypes || !Array.isArray(profileData.appointmentModel.clinicianArchetypes)) {
          profileData.appointmentModel.clinicianArchetypes = defaultProfile.appointmentModel.clinicianArchetypes
        }
        
        // Migrate legacy otherClinicianDirect to clinician archetypes if applicable
        if (profileData.appointmentModel.otherClinicianDirect?.enabled && 
            profileData.appointmentModel.otherClinicianDirect?.localName) {
          // Check if we should migrate to ANP or OTHER based on localName/role
          const otherClinician = profileData.appointmentModel.otherClinicianDirect
          const isAnp = otherClinician.localName.toLowerCase().includes('anp') || 
                       otherClinician.localName.toLowerCase().includes('nurse practitioner') ||
                       otherClinician.clinicianRole.toLowerCase().includes('anp') ||
                       otherClinician.clinicianRole.toLowerCase().includes('nurse')
          
          // Find or create appropriate clinician archetype
          const archetypeKey = isAnp ? 'ANP' : 'OTHER'
          const existingArchetypeIndex = profileData.appointmentModel.clinicianArchetypes.findIndex(
            (ca: any) => ca.key === archetypeKey
          )
          
          if (existingArchetypeIndex >= 0) {
            // Update existing archetype if it's not already configured
            const existing = profileData.appointmentModel.clinicianArchetypes[existingArchetypeIndex]
            if (!existing.enabled || !existing.localName) {
              profileData.appointmentModel.clinicianArchetypes[existingArchetypeIndex] = {
                ...existing,
                enabled: true,
                localName: otherClinician.localName || existing.localName,
                role: otherClinician.clinicianRole || existing.role,
                description: otherClinician.description || existing.description,
              }
            }
          } else {
            // Add new archetype
            profileData.appointmentModel.clinicianArchetypes.push({
              key: archetypeKey,
              enabled: true,
              localName: otherClinician.localName,
              role: otherClinician.clinicianRole,
              description: otherClinician.description,
            })
          }
        }
      }
      
      // Validate profileJson against schema
      const validatedProfile = SurgeryOnboardingProfileJsonZ.parse(profileData)
      
      return NextResponse.json({
        profileJson: validatedProfile,
        completed: profile.completed,
        completedAt: profile.completedAt?.toISOString() || null,
      })
    }

    // Return default shape if no profile exists
    return NextResponse.json({
      profileJson: getDefaultProfile(),
      completed: false,
      completedAt: null,
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('required')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid profile data', details: error.issues }, { status: 400 })
    }
    console.error('Error fetching onboarding profile:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PUT /api/surgeries/[surgeryId]/onboarding
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ surgeryId: string }> }
) {
  try {
    const { surgeryId } = await params
    await requireSurgeryAdmin(surgeryId)

    // Check if surgery exists
    const surgery = await prisma.surgery.findUnique({
      where: { id: surgeryId },
    })

    if (!surgery) {
      return NextResponse.json({ error: 'Surgery not found' }, { status: 404 })
    }

    const body = await request.json()
    const { profileJson, completed } = UpdateOnboardingProfileReqZ.parse(body)

    // Get existing profile to check if completed is changing
    const existingProfile = await prisma.surgeryOnboardingProfile.findUnique({
      where: { surgeryId },
    })

    const wasCompleted = existingProfile?.completed || false
    const willBeCompleted = completed ?? existingProfile?.completed ?? false
    const shouldSetCompletedAt = !wasCompleted && willBeCompleted

    // Upsert the profile
    const updatedProfile = await prisma.surgeryOnboardingProfile.upsert({
      where: { surgeryId },
      create: {
        surgeryId,
        profileJson: profileJson as any,
        completed: willBeCompleted,
        completedAt: shouldSetCompletedAt ? new Date() : null,
      },
      update: {
        profileJson: profileJson as any,
        completed: willBeCompleted,
        completedAt: shouldSetCompletedAt ? new Date() : existingProfile?.completedAt || null,
      },
    })

    // Validate and return response
    const validatedProfile = SurgeryOnboardingProfileJsonZ.parse(updatedProfile.profileJson)

    return NextResponse.json({
      profileJson: validatedProfile,
      completed: updatedProfile.completed,
      completedAt: updatedProfile.completedAt?.toISOString() || null,
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('required')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.issues }, { status: 400 })
    }
    console.error('Error updating onboarding profile:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

