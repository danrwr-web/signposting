import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSessionUser } from '@/lib/rbac'
import { isFeatureEnabledForSurgery } from '@/lib/features'
import { requireAdminToolkitItemEdit } from '@/server/adminToolkitGates'
import { getAdminToolkitPageItemForUser } from '@/server/adminToolkit'
import {
  generateSmartVisualLayout,
  smartVisualItemHasContent,
} from '@/server/adminToolkitSmartVisual'
import { AzureOpenAIError } from '@/server/azureOpenAI'
import { prisma } from '@/lib/prisma'
import { SmartVisualLayoutZ } from '@/lib/adminToolkitSmartVisualShared'

export const runtime = 'nodejs'
export const maxDuration = 60

const generateSmartVisualSchema = z.object({
  surgeryId: z.string().min(1),
  itemId: z.string().min(1),
  guidance: z.string().trim().max(500).optional(),
})

const GATE_ERROR_STATUS: Record<string, number> = {
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  FEATURE_DISABLED: 403,
  NOT_FOUND: 404,
}

/**
 * Generate a smart visual layout preview for a handbook item.
 * Nothing is persisted — saving is a separate server action so the admin
 * can review the preview first.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { surgeryId, itemId, guidance } = generateSmartVisualSchema.parse(body)

    const gate = await requireAdminToolkitItemEdit(surgeryId, itemId)
    if (!gate.ok) {
      return NextResponse.json(
        { error: gate.error.message },
        { status: GATE_ERROR_STATUS[gate.error.code] ?? 403 },
      )
    }

    // Superusers bypass the surgery flag so they can test and demo the feature.
    const aiVisualsEnabled =
      gate.data.isSuperuser || (await isFeatureEnabledForSurgery(surgeryId, 'ai_handbook_visuals'))
    if (!aiVisualsEnabled) {
      return NextResponse.json(
        { error: 'AI smart visuals are not enabled for this surgery.' },
        { status: 403 },
      )
    }

    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const item = await getAdminToolkitPageItemForUser(user, surgeryId, itemId)
    if (!item) {
      return NextResponse.json({ error: 'Item not found.' }, { status: 404 })
    }

    if (!smartVisualItemHasContent(item)) {
      return NextResponse.json(
        { error: 'This item has no content to generate a visual from yet. Add some content first.' },
        { status: 400 },
      )
    }

    // When a visual already exists, pass its layout so regeneration keeps
    // the structure stable wherever the content still supports it.
    const existingVisual = await prisma.adminItemSmartVisual.findUnique({
      where: { adminItemId: itemId },
      select: { layoutJson: true },
    })
    const previousParsed = existingVisual ? SmartVisualLayoutZ.safeParse(existingVisual.layoutJson) : null
    const previousLayout = previousParsed?.success ? previousParsed.data : undefined

    const result = await generateSmartVisualLayout(item, user.email, { guidance, previousLayout })

    return NextResponse.json({
      layout: result.layout,
      sourceFingerprint: result.sourceFingerprint,
      modelUsed: result.modelUsed,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Smart visual generation error:', error)

    if (error instanceof AzureOpenAIError) {
      const httpStatus = error.status === 0 || error.status >= 500 ? 503 : 500
      return NextResponse.json({ error: error.clientMessage }, { status: httpStatus })
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.issues },
        { status: 400 },
      )
    }

    const message =
      error instanceof Error && error.message.startsWith('The AI returned an invalid layout')
        ? error.message
        : 'Failed to generate smart visual'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
