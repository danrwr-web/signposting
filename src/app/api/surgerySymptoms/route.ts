/**
 * Surgery Symptoms Library API route
 * Handles management of symptom library status for each surgery
 */

import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'
import { updateRequiresClinicalReview } from '@/server/updateRequiresClinicalReview'
import { revalidateTag } from 'next/cache'
import { getCachedSymptomsTag } from '@/server/effectiveSymptoms'
import { getEffectiveSymptoms } from '@/server/effectiveSymptoms'

export const runtime = 'nodejs'

type SymptomStatus = 'BASE' | 'MODIFIED' | 'LOCAL_ONLY' | 'DISABLED'

interface InUseSymptom {
  symptomId: string
  name: string
  status: SymptomStatus
  isEnabled: boolean
  canRevertToBase: boolean
  statusRowId?: string
  lastEditedAt?: string | null
  lastEditedBy?: string | null
}

interface AvailableSymptom {
  baseSymptomId: string
  name: string
}

interface CustomOnlySymptom {
  customSymptomId: string
  name: string
  isEnabled: boolean
}

interface SurgerySymptomsResponse {
  inUse: InUseSymptom[]
  available: AvailableSymptom[]
  customOnly: CustomOnlySymptom[]
}

// GET - Fetch symptom library status for a surgery
export async function GET(request: NextRequest) {
  try {
    const user = await getSessionUser()
    
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const surgeryId = searchParams.get('surgeryId')

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const isSuper = user.globalRole === 'SUPERUSER'
    const isPracticeAdmin = Array.isArray((user as any).memberships)
      ? (user as any).memberships.some((m: any) => m.surgeryId === surgeryId && m.role === 'ADMIN')
      : false

    if (!surgeryId) {
      return NextResponse.json({ error: 'surgeryId parameter is required' }, { status: 400 })
    }

    if (!isSuper && !isPracticeAdmin) {
      return NextResponse.json({ error: 'Superuser or Practice Admin required' }, { status: 403 })
    }

    if (!surgeryId) {
      return NextResponse.json(
        { error: 'surgeryId parameter is required' },
        { status: 400 }
      )
    }

    // Verify surgery exists
    const surgery = await prisma.surgery.findUnique({
      where: { id: surgeryId },
      select: { id: true }
    })

    if (!surgery) {
      return NextResponse.json(
        { error: 'Surgery not found' },
        { status: 404 }
      )
    }

    // Get all base symptoms
    const baseSymptoms = await prisma.baseSymptom.findMany({
      where: { isDeleted: false },
      orderBy: { name: 'asc' }
    })

    // Get all custom symptoms for this surgery
    const customSymptoms = await prisma.surgeryCustomSymptom.findMany({
      where: { surgeryId, isDeleted: false },
      orderBy: { name: 'asc' }
    })

    // Get status rows for this surgery
    const statusRows = await prisma.surgerySymptomStatus.findMany({
      where: { surgeryId },
      orderBy: { lastEditedAt: 'desc' }
    })

    // Get overrides to determine which base symptoms have custom wording
    const overrides = await prisma.surgerySymptomOverride.findMany({
      where: { surgeryId }
    })

    // Canonical effective symptom set is derived from getEffectiveSymptoms, so Symptom Library
    // and Clinical Review (which uses /api/effectiveSymptoms) stay consistent.
    const [allEffective, enabledEffective] = await Promise.all([
      getEffectiveSymptoms(surgeryId, true),
      getEffectiveSymptoms(surgeryId, false),
    ])

    const enabledIds = new Set(enabledEffective.map((s) => s.id))

    // Build a map of status rows by symptomId (prefer most recently edited due to ordering).
    const statusBySymptomId = new Map<string, typeof statusRows[0]>()
    for (const status of statusRows) {
      const sid = status.customSymptomId || status.baseSymptomId
      if (!sid) continue
      if (!statusBySymptomId.has(sid)) statusBySymptomId.set(sid, status)
    }

    const inUse: InUseSymptom[] = allEffective.map((s) => {
      const isEnabled = enabledIds.has(s.id)
      const statusRow = statusBySymptomId.get(s.id)
      let status: SymptomStatus
      if (!isEnabled) status = 'DISABLED'
      else if (s.source === 'custom') status = 'LOCAL_ONLY'
      else if (s.source === 'override') status = 'MODIFIED'
      else status = 'BASE'

      return {
        symptomId: s.id,
        name: s.name,
        status,
        isEnabled,
        canRevertToBase: status === 'MODIFIED',
        statusRowId: statusRow?.id,
        lastEditedAt: statusRow?.lastEditedAt ?? null,
        lastEditedBy: statusRow?.lastEditedBy ?? null,
      }
    })

    // Hidden base symptoms (old system) are not part of effectiveSymptoms; keep them accessible
    // as "Available" so admins can restore them.
    const hiddenBaseIds = new Set(overrides.filter((o) => o.isHidden === true).map((o) => o.baseSymptomId))
    const hiddenBaseList = baseSymptoms.filter((b) => hiddenBaseIds.has(b.id))
    const available: AvailableSymptom[] = hiddenBaseList.map((b) => ({ baseSymptomId: b.id, name: b.name }))

    // Custom-only symptoms without status rows (legacy field; UI does not rely on it).
    const customOnly: CustomOnlySymptom[] = customSymptoms
      .filter((c) => !statusBySymptomId.has(c.id))
      .map((c) => ({ customSymptomId: c.id, name: c.name, isEnabled: true }))

    const response: SurgerySymptomsResponse = {
      inUse,
      available,
      customOnly
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error fetching surgery symptoms:', error)
    return NextResponse.json(
      { error: 'Failed to fetch surgery symptoms' },
      { status: 500 }
    )
  }
}

// PATCH - Update symptom library status
export async function PATCH(request: NextRequest) {
  try {
    const user = await getSessionUser()
    
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { action, surgeryId, baseSymptomId, customSymptomId, statusRowId } = body

    const isSuper = user.globalRole === 'SUPERUSER'
    // we'll validate resolved surgery after it's computed

    if (!surgeryId && action !== 'ENABLE_ALL_BASE' && !statusRowId) {
      return NextResponse.json({ error: 'surgeryId is required for this action' }, { status: 400 })
    }

    // If not superuser, ensure practice admin acts only on their own surgery
    // defer non-superuser validation until after resolvedSurgeryId is known

    // Most actions require surgeryId
    let resolvedSurgeryId = surgeryId

    // For some actions, we need to determine surgeryId from statusRowId
    if ((action === 'DISABLE' || action === 'ENABLE_EXISTING' || action === 'REVERT_TO_BASE') && !surgeryId && statusRowId) {
      const status = await prisma.surgerySymptomStatus.findUnique({
        where: { id: statusRowId },
        select: { surgeryId: true }
      })
      
      if (!status) {
        return NextResponse.json(
          { error: 'Status row not found' },
          { status: 404 }
        )
      }
      
      resolvedSurgeryId = status.surgeryId
    }

    if (!resolvedSurgeryId && action !== 'ENABLE_ALL_BASE') {
      return NextResponse.json(
        { error: 'surgeryId is required for this action' },
        { status: 400 }
      )
    }

    // Final RBAC guard: for PRACTICE_ADMIN ensure resolved surgery matches session
    if (!isSuper) {
      const hasAdmin = Array.isArray((user as any).memberships)
        ? (user as any).memberships.some((m: any) => m.surgeryId === resolvedSurgeryId && m.role === 'ADMIN')
        : false
      if (!hasAdmin) {
        return NextResponse.json({ error: 'Superuser or Practice Admin required' }, { status: 403 })
      }
    }

    // Verify surgery exists
    if (resolvedSurgeryId) {
      const surgery = await prisma.surgery.findUnique({
        where: { id: resolvedSurgeryId },
        select: { id: true }
      })

      if (!surgery) {
        return NextResponse.json(
          { error: 'Surgery not found' },
          { status: 404 }
        )
      }
    }

    const now = new Date()
    const editedBy = user.name || user.email

    // Handle different actions
    switch (action) {
      case 'ENABLE_BASE': {
        if (!baseSymptomId || !resolvedSurgeryId) {
          return NextResponse.json(
            { error: 'baseSymptomId and surgeryId are required' },
            { status: 400 }
          )
        }

        // Check if status already exists
        const existing = await prisma.surgerySymptomStatus.findFirst({
          where: {
            surgeryId: resolvedSurgeryId,
            baseSymptomId
          }
        })

        if (existing) {
          // Update existing
          await prisma.surgerySymptomStatus.update({
            where: { id: existing.id },
            data: {
              isEnabled: true,
              isOverridden: false,
              lastEditedAt: now,
              lastEditedBy: editedBy
            }
          })
        } else {
          // Create new
          await prisma.surgerySymptomStatus.create({
            data: {
              surgeryId: resolvedSurgeryId,
              baseSymptomId,
              isEnabled: true,
              isOverridden: false,
              lastEditedAt: now,
              lastEditedBy: editedBy
            }
          })
        }

        revalidateTag(getCachedSymptomsTag(resolvedSurgeryId, false))
        revalidateTag(getCachedSymptomsTag(resolvedSurgeryId, true))
        revalidateTag('symptoms')
        return NextResponse.json({ ok: true })
      }

      case 'DISABLE': {
        if (!statusRowId && !baseSymptomId && !customSymptomId) {
          return NextResponse.json(
            { error: 'statusRowId or baseSymptomId or customSymptomId is required' },
            { status: 400 }
          )
        }

        // If we have statusRowId, update directly
        if (statusRowId) {
          await prisma.surgerySymptomStatus.update({
            where: { id: statusRowId },
            data: {
              isEnabled: false,
              lastEditedAt: now,
              lastEditedBy: editedBy
            }
          })
        }
        // Otherwise, find or create status row by baseSymptomId
        else if ((baseSymptomId || customSymptomId) && resolvedSurgeryId) {
          const existing = await prisma.surgerySymptomStatus.findFirst({
            where: {
              surgeryId: resolvedSurgeryId,
              ...(baseSymptomId ? { baseSymptomId } : {}),
              ...(customSymptomId ? { customSymptomId } : {}),
            }
          })

          if (existing) {
            await prisma.surgerySymptomStatus.update({
              where: { id: existing.id },
              data: {
                isEnabled: false,
                lastEditedAt: now,
                lastEditedBy: editedBy
              }
            })
          } else {
            await prisma.surgerySymptomStatus.create({
              data: {
                surgeryId: resolvedSurgeryId,
                ...(baseSymptomId ? { baseSymptomId } : {}),
                ...(customSymptomId ? { customSymptomId } : {}),
                isEnabled: false,
                isOverridden: false,
                lastEditedAt: now,
                lastEditedBy: editedBy
              }
            })
          }
        }

        // Update requiresClinicalReview flag after disabling
        if (resolvedSurgeryId) {
          await updateRequiresClinicalReview(resolvedSurgeryId)
        }

        if (resolvedSurgeryId) {
          revalidateTag(getCachedSymptomsTag(resolvedSurgeryId, false))
          revalidateTag(getCachedSymptomsTag(resolvedSurgeryId, true))
        }
        revalidateTag('symptoms')
        return NextResponse.json({ ok: true })
      }

      case 'ENABLE_EXISTING': {
        if (!statusRowId && !baseSymptomId && !customSymptomId) {
          return NextResponse.json(
            { error: 'statusRowId, baseSymptomId, or customSymptomId is required' },
            { status: 400 }
          )
        }

        // If we have statusRowId, update directly
        if (statusRowId) {
          await prisma.surgerySymptomStatus.update({
            where: { id: statusRowId },
            data: {
              isEnabled: true,
              lastEditedAt: now,
              lastEditedBy: editedBy
            }
          })
        }
        // Otherwise, find or create status row by baseSymptomId or customSymptomId
        else if (resolvedSurgeryId) {
          const whereClause: any = { surgeryId: resolvedSurgeryId }
          if (baseSymptomId) whereClause.baseSymptomId = baseSymptomId
          if (customSymptomId) whereClause.customSymptomId = customSymptomId

          const existing = await prisma.surgerySymptomStatus.findFirst({
            where: whereClause
          })

          if (existing) {
            await prisma.surgerySymptomStatus.update({
              where: { id: existing.id },
              data: {
                isEnabled: true,
                lastEditedAt: now,
                lastEditedBy: editedBy
              }
            })
          } else {
            const createData: any = {
              surgeryId: resolvedSurgeryId,
              isEnabled: true,
              isOverridden: false,
              lastEditedAt: now,
              lastEditedBy: editedBy
            }
            if (baseSymptomId) createData.baseSymptomId = baseSymptomId
            if (customSymptomId) createData.customSymptomId = customSymptomId

            await prisma.surgerySymptomStatus.create({
              data: createData
            })
          }
        }

        // Update requiresClinicalReview flag after enabling
        if (resolvedSurgeryId) {
          await updateRequiresClinicalReview(resolvedSurgeryId)
        }

        if (resolvedSurgeryId) {
          revalidateTag(getCachedSymptomsTag(resolvedSurgeryId, false))
          revalidateTag(getCachedSymptomsTag(resolvedSurgeryId, true))
        }
        revalidateTag('symptoms')
        return NextResponse.json({ ok: true })
      }

      case 'REVERT_TO_BASE': {
        if (!statusRowId && !baseSymptomId) {
          return NextResponse.json(
            { error: 'statusRowId or baseSymptomId is required' },
            { status: 400 }
          )
        }

        // If statusRowId is not provided, we need both baseSymptomId and resolvedSurgeryId
        if (!statusRowId && (!baseSymptomId || !resolvedSurgeryId)) {
          return NextResponse.json(
            { error: 'When statusRowId is not provided, both baseSymptomId and surgeryId are required' },
            { status: 400 }
          )
        }

        let actualStatusRowId = statusRowId
        let targetBaseSymptomId: string
        let targetSurgeryId: string

        // If we have statusRowId, use it directly
        if (statusRowId) {
          const status = await prisma.surgerySymptomStatus.findUnique({
            where: { id: statusRowId },
            select: { baseSymptomId: true, surgeryId: true, isOverridden: true }
          })

          if (!status) {
            return NextResponse.json(
              { error: 'Status row not found' },
              { status: 404 }
            )
          }

          if (!status.baseSymptomId) {
            return NextResponse.json(
              { error: 'Cannot revert custom-only symptom to base' },
              { status: 400 }
            )
          }

          // Check if an override actually exists (GET endpoint uses this to determine MODIFIED status)
          const overrideExists = await prisma.surgerySymptomOverride.findFirst({
            where: {
              surgeryId: status.surgeryId,
              baseSymptomId: status.baseSymptomId
            },
            select: { id: true }
          })

          if (!overrideExists) {
            return NextResponse.json(
              { error: 'Nothing to revert - no override found' },
              { status: 400 }
            )
          }

          targetBaseSymptomId = status.baseSymptomId
          targetSurgeryId = status.surgeryId
        }
        // Otherwise, find or create status row by baseSymptomId
        else if (baseSymptomId && resolvedSurgeryId) {
          // First check if there's an override to revert
          const overrideExists = await prisma.surgerySymptomOverride.findFirst({
            where: {
              surgeryId: resolvedSurgeryId,
              baseSymptomId
            },
            select: { id: true }
          })

          if (!overrideExists) {
            return NextResponse.json(
              { error: 'Nothing to revert - no override found' },
              { status: 400 }
            )
          }

          const existing = await prisma.surgerySymptomStatus.findFirst({
            where: {
              surgeryId: resolvedSurgeryId,
              baseSymptomId
            },
            select: { id: true, isOverridden: true }
          })

          if (existing) {
            actualStatusRowId = existing.id
            // Note: We've already verified override exists above, so proceed even if isOverridden flag is false
            // This handles cases where the flag is out of sync with the actual override record
          } else {
            // Create status row first
            const newStatus = await prisma.surgerySymptomStatus.create({
              data: {
                surgeryId: resolvedSurgeryId,
                baseSymptomId,
                isEnabled: true,
                isOverridden: false, // We're about to revert, so this should be false
                lastEditedAt: now,
                lastEditedBy: editedBy
              }
            })
            actualStatusRowId = newStatus.id
          }

          targetBaseSymptomId = baseSymptomId
          targetSurgeryId = resolvedSurgeryId
        } else {
          return NextResponse.json(
            { error: 'Insufficient parameters - baseSymptomId and surgeryId are required when statusRowId is not provided' },
            { status: 400 }
          )
        }

        // Delete the SurgerySymptomOverride record for this surgery + baseSymptomId
        // This removes the custom wording so the base symptom text will be used
        await prisma.surgerySymptomOverride.deleteMany({
          where: {
            surgeryId: targetSurgeryId,
            baseSymptomId: targetBaseSymptomId
          }
        })

        // Update status row to indicate we're no longer using override
        if (actualStatusRowId) {
          await prisma.surgerySymptomStatus.update({
            where: { id: actualStatusRowId },
            data: {
              isOverridden: false,
              lastEditedAt: now,
              lastEditedBy: editedBy
            }
          })
        }

        revalidateTag(getCachedSymptomsTag(targetSurgeryId, false))
        revalidateTag(getCachedSymptomsTag(targetSurgeryId, true))
        revalidateTag('symptoms')
        return NextResponse.json({ ok: true })
      }

      case 'ENABLE_ALL_BASE': {
        if (!resolvedSurgeryId) {
          return NextResponse.json(
            { error: 'surgeryId is required' },
            { status: 400 }
          )
        }

        // Get all base symptoms
        const allBaseSymptoms = await prisma.baseSymptom.findMany({
          select: { id: true }
        })

        // Get existing status rows for this surgery
        const existingStatusRows = await prisma.surgerySymptomStatus.findMany({
          where: {
            surgeryId: resolvedSurgeryId,
            baseSymptomId: { not: null }
          },
          select: { baseSymptomId: true }
        })

        const existingBaseIds = new Set(existingStatusRows.map(s => s.baseSymptomId).filter(Boolean) as string[])

        // Create status rows for any missing base symptoms
        const baseIdsToCreate = allBaseSymptoms
          .filter(s => !existingBaseIds.has(s.id))
          .map(s => ({
            surgeryId: resolvedSurgeryId,
            baseSymptomId: s.id,
            isEnabled: true,
            isOverridden: false,
            lastEditedAt: now,
            lastEditedBy: editedBy
          }))

        if (baseIdsToCreate.length > 0) {
          await prisma.surgerySymptomStatus.createMany({
            data: baseIdsToCreate
          })
        }

        // Also ensure all existing status rows are enabled (but don't change isOverridden)
        await prisma.surgerySymptomStatus.updateMany({
          where: {
            surgeryId: resolvedSurgeryId,
            baseSymptomId: { not: null },
            isEnabled: false
          },
          data: {
            isEnabled: true,
            lastEditedAt: now,
            lastEditedBy: editedBy
          }
        })

        revalidateTag(getCachedSymptomsTag(resolvedSurgeryId, false))
        revalidateTag(getCachedSymptomsTag(resolvedSurgeryId, true))
        revalidateTag('symptoms')
        return NextResponse.json({ ok: true })
      }

      default:
        return NextResponse.json(
          { error: 'Unknown action' },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error('Error updating surgery symptoms:', error)
    return NextResponse.json(
      { error: 'Failed to update surgery symptoms' },
      { status: 500 }
    )
  }
}

