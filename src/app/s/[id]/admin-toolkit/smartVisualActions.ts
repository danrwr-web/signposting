'use server'

import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { isFeatureEnabledForSurgery } from '@/lib/features'
import { requireAdminToolkitItemEdit, zodFieldErrors } from '@/server/adminToolkitGates'
import type { ActionResult } from '@/server/adminToolkitGates'
import { getAdminToolkitPageItem } from '@/server/adminToolkit'
import { computeSmartVisualFingerprint } from '@/server/adminToolkitSmartVisual'
import {
  SmartVisualLayoutZ,
  normalizeSmartVisualLayout,
  smartVisualSectionTypes,
} from '@/lib/adminToolkitSmartVisualShared'

const saveSmartVisualInput = z.object({
  surgeryId: z.string().min(1),
  itemId: z.string().min(1),
  layout: z.unknown(),
  sourceFingerprint: z.string().length(64),
  modelUsed: z.string().max(120).optional(),
})

export async function saveAdminToolkitSmartVisual(input: unknown): Promise<ActionResult<{ itemId: string }>> {
  const parsed = saveSmartVisualInput.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid input.', fieldErrors: zodFieldErrors(parsed.error) } }
  }
  const { surgeryId, itemId, sourceFingerprint, modelUsed } = parsed.data

  const gate = await requireAdminToolkitItemEdit(surgeryId, itemId)
  if (!gate.ok) return gate

  const aiVisualsEnabled = await isFeatureEnabledForSurgery(surgeryId, 'ai_handbook_visuals')
  if (!aiVisualsEnabled) {
    return { ok: false, error: { code: 'FEATURE_DISABLED', message: 'AI smart visuals are not enabled for this surgery.' } }
  }

  // Never trust the client blob — re-validate and normalise server-side.
  const layoutParsed = SmartVisualLayoutZ.safeParse(parsed.data.layout)
  if (!layoutParsed.success) {
    return { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid smart visual layout.', fieldErrors: zodFieldErrors(layoutParsed.error) } }
  }
  let layout
  try {
    layout = normalizeSmartVisualLayout(layoutParsed.data)
  } catch {
    return { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid smart visual layout.' } }
  }

  try {
    // Recompute the fingerprint from current DB state: if the item content
    // changed between generation and save, reject rather than saving a
    // visual that no longer matches its source.
    const item = await getAdminToolkitPageItem(surgeryId, itemId)
    if (!item) {
      return { ok: false, error: { code: 'NOT_FOUND', message: 'Item not found.' } }
    }
    const currentFingerprint = computeSmartVisualFingerprint(item)
    if (currentFingerprint !== sourceFingerprint) {
      return { ok: false, error: { code: 'STALE', message: 'The page content changed while you were previewing. Please regenerate the visual.' } }
    }

    const previous = await prisma.adminItemSmartVisual.findUnique({
      where: { adminItemId: itemId },
      select: { generatedAt: true, layoutJson: true },
    })
    const previousTypes = (() => {
      if (!previous) return null
      const prevLayout = SmartVisualLayoutZ.safeParse(previous.layoutJson)
      return prevLayout.success ? smartVisualSectionTypes(prevLayout.data) : null
    })()

    const sectionTypes = smartVisualSectionTypes(layout)

    await prisma.$transaction([
      prisma.adminItemSmartVisual.upsert({
        where: { adminItemId: itemId },
        create: {
          adminItemId: itemId,
          surgeryId,
          layoutJson: layout,
          sourceFingerprint: currentFingerprint,
          modelUsed: modelUsed ?? null,
          generatedByUserId: gate.data.userId,
        },
        update: {
          layoutJson: layout,
          sourceFingerprint: currentFingerprint,
          modelUsed: modelUsed ?? null,
          generatedAt: new Date(),
          generatedByUserId: gate.data.userId,
        },
      }),
      prisma.adminHistory.create({
        data: {
          surgeryId,
          adminItemId: itemId,
          action: 'SMART_VISUAL_SAVE',
          actorUserId: gate.data.userId,
          entityType: 'ADMIN_ITEM',
          summary: `Saved smart visual (${sectionTypes.length} section${sectionTypes.length === 1 ? '' : 's'})`,
          diffJson: {
            before: previous ? { generatedAt: previous.generatedAt.toISOString(), sectionTypes: previousTypes } : null,
            after: { sectionTypes, sourceFingerprint: currentFingerprint, modelUsed: modelUsed ?? null },
          },
        },
      }),
    ])

    return { ok: true, data: { itemId } }
  } catch (error) {
    console.error('saveAdminToolkitSmartVisual failed:', error)
    return { ok: false, error: { code: 'UNKNOWN', message: 'Failed to save the smart visual.' } }
  }
}

const removeSmartVisualInput = z.object({
  surgeryId: z.string().min(1),
  itemId: z.string().min(1),
})

export async function removeAdminToolkitSmartVisual(input: unknown): Promise<ActionResult<{ itemId: string }>> {
  const parsed = removeSmartVisualInput.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid input.', fieldErrors: zodFieldErrors(parsed.error) } }
  }
  const { surgeryId, itemId } = parsed.data

  const gate = await requireAdminToolkitItemEdit(surgeryId, itemId)
  if (!gate.ok) return gate

  try {
    const existing = await prisma.adminItemSmartVisual.findFirst({
      where: { adminItemId: itemId, surgeryId },
      select: { id: true },
    })

    if (existing) {
      await prisma.$transaction([
        prisma.adminItemSmartVisual.deleteMany({ where: { adminItemId: itemId, surgeryId } }),
        prisma.adminHistory.create({
          data: {
            surgeryId,
            adminItemId: itemId,
            action: 'SMART_VISUAL_REMOVE',
            actorUserId: gate.data.userId,
            entityType: 'ADMIN_ITEM',
            summary: 'Removed smart visual',
          },
        }),
      ])
    }

    return { ok: true, data: { itemId } }
  } catch (error) {
    console.error('removeAdminToolkitSmartVisual failed:', error)
    return { ok: false, error: { code: 'UNKNOWN', message: 'Failed to remove the smart visual.' } }
  }
}
