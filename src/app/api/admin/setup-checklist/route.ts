import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { requireSurgeryAdmin } from '@/lib/rbac'
import { computeSurgerySetupSnapshot } from '@/server/surgerySetup'

export const runtime = 'nodejs'

// GET /api/admin/setup-checklist?surgeryId=xxx
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const surgeryId = searchParams.get('surgeryId')

    if (!surgeryId) {
      return NextResponse.json({ error: 'surgeryId is required' }, { status: 400 })
    }

    await requireSurgeryAdmin(surgeryId)
    const snapshot = await computeSurgerySetupSnapshot(surgeryId)
    if (!snapshot) {
      return NextResponse.json({ error: 'Surgery not found' }, { status: 404 })
    }

    // Preserve the exact JSON shape the existing SetupChecklistClient consumes.
    return NextResponse.json({
      surgeryId: snapshot.surgeryId,
      surgeryName: snapshot.surgeryName,
      onboardingCompleted: snapshot.onboardingCompleted,
      onboardingCompletedAt: snapshot.onboardingCompletedAt,
      onboardingStarted: snapshot.onboardingStarted,
      onboardingUpdatedAt: snapshot.onboardingUpdatedAt,
      appointmentModelConfigured: snapshot.appointmentModelConfigured,
      aiCustomisationOccurred: snapshot.aiCustomisationOccurred,
      pendingCount: snapshot.pendingCount,
      checklist: {
        onboardingCompleted: snapshot.checklist.onboardingCompleted,
        appointmentModelConfigured: snapshot.checklist.appointmentModelConfigured,
        aiCustomisationRun: snapshot.checklist.aiCustomisationRun === true,
        pendingReviewCount: snapshot.checklist.pendingReviewCount,
        standardUsersCount: snapshot.checklist.standardUsersCount,
        highRiskConfigured: snapshot.checklist.highRiskConfigured,
        highlightsEnabled: snapshot.checklist.highlightsEnabled,
        appointmentTypeCount: snapshot.checklist.appointmentTypeCount,
        handbookItemCount: snapshot.checklist.handbookItemCount,
      },
      health: snapshot.health,
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('required')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Error fetching setup checklist data:', error)
    return NextResponse.json({ error: 'Failed to fetch setup checklist data' }, { status: 500 })
  }
}
