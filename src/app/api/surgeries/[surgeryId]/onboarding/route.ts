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
      // Validate profileJson against schema
      const validatedProfile = SurgeryOnboardingProfileJsonZ.parse(profile.profileJson)
      
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

