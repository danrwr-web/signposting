import { NextRequest, NextResponse } from 'next/server'
import { requireSuperuser } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import bcrypt from 'bcryptjs'

const provisionSchema = z.object({
  surgeryName: z.string().min(1, 'Surgery name is required'),
  adminEmail: z.string().email('Valid admin email is required'),
  adminName: z.string().min(1, 'Admin name is required'),
  temporaryPassword: z.string().min(6, 'Password must be at least 6 characters'),
  featureFlagIds: z.array(z.string()).default([]),
})

// POST /api/super/pipeline/[id]/provision — Provision a surgery from a pipeline entry
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireSuperuser()
    const { id } = await params

    const pipelineEntry = await prisma.salesPipeline.findUnique({ where: { id } })
    if (!pipelineEntry) {
      return NextResponse.json({ error: 'Pipeline entry not found' }, { status: 404 })
    }

    if (pipelineEntry.status !== 'Contracted') {
      return NextResponse.json(
        { error: 'Only contracted practices can be provisioned' },
        { status: 400 }
      )
    }

    if (pipelineEntry.linkedSurgeryId) {
      return NextResponse.json(
        { error: 'This practice has already been provisioned' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { surgeryName, adminEmail, adminName, temporaryPassword, featureFlagIds } =
      provisionSchema.parse(body)

    // Check for name/email uniqueness before starting the transaction
    const existingSurgery = await prisma.surgery.findUnique({
      where: { name: surgeryName },
    })
    if (existingSurgery) {
      return NextResponse.json(
        { error: 'A surgery with this name already exists' },
        { status: 400 }
      )
    }

    const existingUser = await prisma.user.findUnique({
      where: { email: adminEmail },
    })
    if (existingUser) {
      return NextResponse.json(
        { error: 'A user with this email already exists' },
        { status: 400 }
      )
    }

    // Validate that all requested feature flags exist
    if (featureFlagIds.length > 0) {
      const validFeatures = await prisma.feature.findMany({
        where: { id: { in: featureFlagIds } },
        select: { id: true },
      })
      const validIds = new Set(validFeatures.map((f) => f.id))
      const invalid = featureFlagIds.filter((fid) => !validIds.has(fid))
      if (invalid.length > 0) {
        return NextResponse.json(
          { error: `Invalid feature flag IDs: ${invalid.join(', ')}` },
          { status: 400 }
        )
      }
    }

    // Generate slug from surgery name
    const slug = surgeryName
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')

    // Hash the temporary password
    const hashedPassword = await bcrypt.hash(temporaryPassword, 12)

    // Initialise "What's changed" baseline dates
    const todayIso = new Date().toISOString()
    const initialUiConfig = {
      signposting: { changesBaselineDate: todayIso },
      practiceHandbook: { changesBaselineDate: todayIso },
    }

    // All-or-nothing transaction
    const result = await prisma.$transaction(async (tx) => {
      // 1. Create Surgery
      const surgery = await tx.surgery.create({
        data: {
          name: surgeryName,
          slug,
          adminEmail,
          uiConfig: initialUiConfig,
        },
      })

      // 2. Create admin User
      const user = await tx.user.create({
        data: {
          email: adminEmail,
          name: adminName,
          password: hashedPassword,
          globalRole: 'USER',
          defaultSurgeryId: surgery.id,
        },
      })

      // 3. Create SurgeryMembership with ADMIN role
      await tx.userSurgery.create({
        data: {
          userId: user.id,
          surgeryId: surgery.id,
          role: 'ADMIN',
        },
      })

      // 4. Create SurgeryFeatureFlag records for selected flags
      if (featureFlagIds.length > 0) {
        await tx.surgeryFeatureFlag.createMany({
          data: featureFlagIds.map((featureId) => ({
            surgeryId: surgery.id,
            featureId,
            enabled: true,
          })),
        })
      }

      // 5. Link pipeline entry to the new surgery
      await tx.salesPipeline.update({
        where: { id },
        data: { linkedSurgeryId: surgery.id },
      })

      return { surgeryId: surgery.id, userId: user.id }
    })

    return NextResponse.json(
      {
        surgeryId: result.surgeryId,
        userId: result.userId,
        message: 'Surgery provisioned successfully',
      },
      { status: 201 }
    )
  } catch (error) {
    if (error instanceof Error && error.message.includes('required')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.issues }, { status: 400 })
    }
    console.error('Provision error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
