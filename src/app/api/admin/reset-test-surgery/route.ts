import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { requireSurgeryAdmin } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'
import { getEffectiveSymptoms } from '@/server/effectiveSymptoms'

export const runtime = 'nodejs'

const VALID_STATES = [
  'fresh',
  'checklist-started',
  'mid-setup',
  'nearly-there',
  'fully-complete',
] as const
type ResetState = (typeof VALID_STATES)[number]

const TEST_USER_EMAIL = 'test-user@test-surgery.local'
const TEST_USER_NAME = 'Test User'

// Minimal onboarding profile with one appointment archetype enabled
const CONFIGURED_PROFILE_JSON = {
  surgeryName: 'Test Surgery',
  urgentCareModel: {
    hasDutyDoctor: true,
    dutyDoctorTerm: 'Duty Doctor',
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
    terminologyPreference: 'surgery',
  },
  aiSettings: {
    customisationScope: 'all',
    requireClinicalReview: true,
  },
  appointmentModel: {
    routineContinuityGp: { enabled: true, localName: 'Routine GP', clinicianRole: 'GP', description: 'Standard GP appointment' },
    routineGpPhone: { enabled: false, localName: '', clinicianRole: '', description: '' },
    gpTriage48h: { enabled: false, localName: '', clinicianRole: '', description: '' },
    urgentSameDayPhone: { enabled: false, localName: '', clinicianRole: '', description: '' },
    urgentSameDayF2F: { enabled: false, localName: '', clinicianRole: '', description: '' },
    otherClinicianDirect: { enabled: false, localName: '', clinicianRole: '', description: '' },
    clinicianArchetypes: [],
  },
}

// POST /api/admin/reset-test-surgery
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { surgeryId, state } = body as { surgeryId?: string; state?: string }

    if (!surgeryId || !state) {
      return NextResponse.json(
        { error: 'surgeryId and state are required' },
        { status: 400 }
      )
    }

    if (!(VALID_STATES as readonly string[]).includes(state)) {
      return NextResponse.json(
        { error: `Invalid state. Must be one of: ${VALID_STATES.join(', ')}` },
        { status: 400 }
      )
    }

    // Auth check
    await requireSurgeryAdmin(surgeryId)

    // Verify this is the Test Surgery
    const surgery = await prisma.surgery.findUnique({
      where: { id: surgeryId },
      select: { id: true, name: true },
    })

    if (!surgery) {
      return NextResponse.json(
        { error: 'Surgery not found' },
        { status: 404 }
      )
    }

    if (surgery.name.toLowerCase() !== 'test surgery') {
      return NextResponse.json(
        { error: 'This endpoint can only be used with the Test Surgery' },
        { status: 403 }
      )
    }

    await applyResetState(surgeryId, state as ResetState)

    return NextResponse.json({
      success: true,
      state,
      message: `Test Surgery reset to "${state}" state`,
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('required')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Error resetting test surgery:', error)
    return NextResponse.json(
      { error: 'Failed to reset test surgery' },
      { status: 500 }
    )
  }
}

// ── Reset logic ───────────────────────────────────────────────────────────

async function applyResetState(surgeryId: string, state: ResetState) {
  // Step 1: Clean everything (idempotent baseline)
  await cleanSurgeryData(surgeryId)

  // Step 2: Build up to the target state
  switch (state) {
    case 'fresh':
      // Nothing to add — clean state is the fresh state
      break

    case 'checklist-started':
      await applyChecklistStarted(surgeryId)
      break

    case 'mid-setup':
      await applyMidSetup(surgeryId)
      break

    case 'nearly-there':
      await applyNearlyThere(surgeryId)
      break

    case 'fully-complete':
      await applyFullyComplete(surgeryId)
      break
  }
}

async function cleanSurgeryData(surgeryId: string) {
  // Find non-admin memberships to delete (preserve admin accounts)
  const nonAdminMemberships = await prisma.userSurgery.findMany({
    where: { surgeryId, role: { not: 'ADMIN' } },
    select: { userId: true },
  })
  const nonAdminUserIds = nonAdminMemberships.map((m: { userId: string }) => m.userId)

  // Get symptom IDs for this surgery (for SymptomHistory cleanup)
  const overrideIds = (
    await prisma.surgerySymptomOverride.findMany({
      where: { surgeryId },
      select: { baseSymptomId: true },
    })
  ).map((o: { baseSymptomId: string }) => o.baseSymptomId)

  const customIds = (
    await prisma.surgeryCustomSymptom.findMany({
      where: { surgeryId },
      select: { id: true },
    })
  ).map((c: { id: string }) => c.id)

  const allSymptomIds = [...overrideIds, ...customIds]

  await prisma.$transaction([
    // Remove non-admin memberships
    prisma.userSurgery.deleteMany({
      where: { surgeryId, role: { not: 'ADMIN' } },
    }),

    // Delete users who are only test users (created by this tool)
    ...(nonAdminUserIds.length > 0
      ? [
          prisma.user.deleteMany({
            where: {
              id: { in: nonAdminUserIds },
              email: TEST_USER_EMAIL,
            },
          }),
        ]
      : []),

    // Clear high-risk links and default button configs
    prisma.highRiskLink.deleteMany({ where: { surgeryId } }),
    prisma.defaultHighRiskButtonConfig.deleteMany({ where: { surgeryId } }),

    // Clear highlight rules
    prisma.highlightRule.deleteMany({ where: { surgeryId } }),

    // Clear appointment types
    prisma.appointmentType.deleteMany({ where: { surgeryId } }),

    // Clear admin toolkit items (and related records)
    prisma.adminItemAttachment.deleteMany({ where: { surgeryId } }),
    prisma.adminItemEditGrant.deleteMany({ where: { surgeryId } }),
    prisma.adminItem.deleteMany({ where: { surgeryId } }),
    prisma.adminCategory.deleteMany({ where: { surgeryId } }),

    // Clear clinical review statuses
    prisma.symptomReviewStatus.deleteMany({ where: { surgeryId } }),

    // Clear symptom history for this surgery's symptoms
    ...(allSymptomIds.length > 0
      ? [
          prisma.symptomHistory.deleteMany({
            where: { symptomId: { in: allSymptomIds } },
          }),
        ]
      : []),

    // Clear engagement events
    prisma.engagementEvent.deleteMany({ where: { surgeryId } }),

    // Reset surgery flags
    prisma.surgery.update({
      where: { id: surgeryId },
      data: {
        enableDefaultHighRisk: false,
        enableBuiltInHighlights: false,
      },
    }),

    // Reset onboarding profile
    prisma.surgeryOnboardingProfile.upsert({
      where: { surgeryId },
      update: {
        completed: false,
        completedAt: null,
        profileJson: {},
      },
      create: {
        surgeryId,
        completed: false,
        profileJson: {},
      },
    }),
  ])
}

// ── State builders ────────────────────────────────────────────────────────

async function ensureTestUser(surgeryId: string) {
  const user = await prisma.user.upsert({
    where: { email: TEST_USER_EMAIL },
    update: { name: TEST_USER_NAME },
    create: {
      email: TEST_USER_EMAIL,
      name: TEST_USER_NAME,
      globalRole: 'USER',
    },
  })

  await prisma.userSurgery.upsert({
    where: {
      userId_surgeryId: { userId: user.id, surgeryId },
    },
    update: { role: 'STANDARD' },
    create: {
      userId: user.id,
      surgeryId,
      role: 'STANDARD',
    },
  })

  return user
}

function enableHighRisk(surgeryId: string) {
  return prisma.surgery.update({
    where: { id: surgeryId },
    data: { enableDefaultHighRisk: true },
  })
}

function completeOnboarding(surgeryId: string) {
  return prisma.surgeryOnboardingProfile.upsert({
    where: { surgeryId },
    update: {
      completed: true,
      completedAt: new Date(),
      profileJson: CONFIGURED_PROFILE_JSON,
    },
    create: {
      surgeryId,
      completed: true,
      completedAt: new Date(),
      profileJson: CONFIGURED_PROFILE_JSON,
    },
  })
}

async function createPendingReviews(surgeryId: string, minCount: number) {
  const symptoms = await getEffectiveSymptoms(surgeryId, true)
  const toCreate = symptoms.slice(0, Math.max(minCount, 15))

  for (const symptom of toCreate) {
    await prisma.symptomReviewStatus.upsert({
      where: {
        surgeryId_symptomId_ageGroup: {
          surgeryId,
          symptomId: symptom.id,
          ageGroup: symptom.ageGroup,
        },
      },
      update: { status: 'PENDING', lastReviewedAt: null },
      create: {
        surgeryId,
        symptomId: symptom.id,
        ageGroup: symptom.ageGroup,
        status: 'PENDING',
      },
    })
  }
}

async function approveAllReviews(surgeryId: string) {
  const symptoms = await getEffectiveSymptoms(surgeryId, true)

  for (const symptom of symptoms) {
    await prisma.symptomReviewStatus.upsert({
      where: {
        surgeryId_symptomId_ageGroup: {
          surgeryId,
          symptomId: symptom.id,
          ageGroup: symptom.ageGroup,
        },
      },
      update: { status: 'APPROVED', lastReviewedAt: new Date() },
      create: {
        surgeryId,
        symptomId: symptom.id,
        ageGroup: symptom.ageGroup,
        status: 'APPROVED',
        lastReviewedAt: new Date(),
      },
    })
  }
}

async function createFakeAiHistory(surgeryId: string) {
  // Find or create an override so we have a symptom ID to attach history to
  const firstBase = await prisma.baseSymptom.findFirst({
    select: { id: true },
  })
  if (!firstBase) return

  // Ensure an override exists
  const override = await prisma.surgerySymptomOverride.findFirst({
    where: { surgeryId, baseSymptomId: firstBase.id },
    select: { baseSymptomId: true },
  })

  const symptomId = override?.baseSymptomId ?? firstBase.id

  if (!override) {
    await prisma.surgerySymptomOverride.create({
      data: {
        surgeryId,
        baseSymptomId: firstBase.id,
      },
    })
  }

  // Create a history record that marks AI customisation as run
  await prisma.symptomHistory.create({
    data: {
      symptomId,
      source: 'override',
      newText: 'AI-customised instructions',
      modelUsed: 'gpt-4o-mini',
      editorName: 'AI Customisation',
      editorEmail: 'system@test-surgery.local',
    },
  })
}

// ── Checklist Started: 2/6 essential (high-risk + users) ──────────────────

async function applyChecklistStarted(surgeryId: string) {
  await enableHighRisk(surgeryId)
  await ensureTestUser(surgeryId)
}

// ── Mid-Setup: 4/6 essential (high-risk, users, questionnaire, appt model)
//    AI not run, 15+ pending reviews ───────────────────────────────────────

async function applyMidSetup(surgeryId: string) {
  await enableHighRisk(surgeryId)
  await ensureTestUser(surgeryId)
  await completeOnboarding(surgeryId)
  await createPendingReviews(surgeryId, 15)
}

// ── Nearly There: all 6 essential, recommended incomplete ─────────────────

async function applyNearlyThere(surgeryId: string) {
  await enableHighRisk(surgeryId)
  await ensureTestUser(surgeryId)
  await completeOnboarding(surgeryId)
  await createFakeAiHistory(surgeryId)
  await approveAllReviews(surgeryId)
  // Recommended steps intentionally left incomplete:
  // - enableBuiltInHighlights stays false
  // - No AppointmentType records
  // - No AdminItem records
}

// ── Fully Complete: all essential + all recommended ───────────────────────

async function applyFullyComplete(surgeryId: string) {
  await enableHighRisk(surgeryId)
  await ensureTestUser(surgeryId)
  await completeOnboarding(surgeryId)
  await createFakeAiHistory(surgeryId)
  await approveAllReviews(surgeryId)

  // Recommended: highlights
  await prisma.surgery.update({
    where: { id: surgeryId },
    data: { enableBuiltInHighlights: true },
  })

  // Recommended: appointment directory
  await prisma.appointmentType.create({
    data: {
      surgeryId,
      name: 'Routine GP Appointment',
      staffType: 'Dr',
      durationMins: 10,
      isEnabled: true,
    },
  })

  // Recommended: practice handbook item
  await prisma.adminItem.create({
    data: {
      surgeryId,
      type: 'PAGE',
      title: 'Welcome to the Practice Handbook',
      contentHtml: '<p>This is a sample handbook page created by the developer reset tool.</p>',
    },
  })
}
