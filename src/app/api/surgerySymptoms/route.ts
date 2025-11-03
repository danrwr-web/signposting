/**
 * Surgery Symptoms Library API route
 * Handles management of symptom library status for each surgery
 */

import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'

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

    // TODO: allow PRACTICE ADMIN role to view/edit their own surgery only
    // For now, require SUPERUSER only
    if (user.globalRole !== 'SUPERUSER') {
      return NextResponse.json(
        { error: 'Superuser access required' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const surgeryId = searchParams.get('surgeryId')

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
      orderBy: { name: 'asc' }
    })

    // Get all custom symptoms for this surgery
    const customSymptoms = await prisma.surgeryCustomSymptom.findMany({
      where: { surgeryId },
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

    // Build a map of status rows by symptom ID
    const statusByBaseId = new Map<string, typeof statusRows[0]>()
    const statusByCustomId = new Map<string, typeof statusRows[0]>()

    for (const status of statusRows) {
      if (status.baseSymptomId) {
        statusByBaseId.set(status.baseSymptomId, status)
      }
      if (status.customSymptomId) {
        statusByCustomId.set(status.customSymptomId, status)
      }
    }

    // Build a set of base symptom IDs that have overrides (modified wording)
    const overriddenBaseIds = new Set(overrides.map(o => o.baseSymptomId))

    // Build a set of hidden symptom IDs (from old system)
    const hiddenBaseIds = new Set(
      overrides
        .filter(o => o.isHidden === true)
        .map(o => o.baseSymptomId)
    )

    // Build "inUse" array - anything with a status row
    const inUse: InUseSymptom[] = []

    // Add base-linked symptoms
    for (const baseSymptom of baseSymptoms) {
      const status = statusByBaseId.get(baseSymptom.id)
      
      // In the NEW system: if there's a status row, use it
      if (status) {
        let symptomStatus: SymptomStatus
        if (!status.isEnabled) {
          symptomStatus = 'DISABLED'
        } else if (overriddenBaseIds.has(baseSymptom.id)) {
          symptomStatus = 'MODIFIED'
        } else {
          symptomStatus = 'BASE'
        }

        inUse.push({
          symptomId: baseSymptom.id,
          name: baseSymptom.name,
          status: symptomStatus,
          isEnabled: status.isEnabled,
          canRevertToBase: symptomStatus === 'MODIFIED',
          statusRowId: status.id,
          lastEditedAt: status.lastEditedAt,
          lastEditedBy: status.lastEditedBy
        })
      }
      // In the OLD system: if no status row exists but symptom is not hidden via override, it's in use
      else if (!hiddenBaseIds.has(baseSymptom.id)) {
        // Symptom is effectively in use via old system but no status row yet
        // We'll treat this as enabled by default and show it as BASE or MODIFIED
        let symptomStatus: SymptomStatus = 'BASE'
        if (overriddenBaseIds.has(baseSymptom.id)) {
          symptomStatus = 'MODIFIED'
        }

        inUse.push({
          symptomId: baseSymptom.id,
          name: baseSymptom.name,
          status: symptomStatus,
          isEnabled: true, // Default to enabled
          canRevertToBase: symptomStatus === 'MODIFIED',
          lastEditedAt: null,
          lastEditedBy: null
        })
      }
    }

    // Add custom-only symptoms
    for (const customSymptom of customSymptoms) {
      const status = statusByCustomId.get(customSymptom.id)
      if (status) {
        inUse.push({
          symptomId: customSymptom.id,
          name: customSymptom.name,
          status: 'LOCAL_ONLY',
          isEnabled: status.isEnabled,
          canRevertToBase: false,
          statusRowId: status.id,
          lastEditedAt: status.lastEditedAt,
          lastEditedBy: status.lastEditedBy
        })
      } else {
        // Custom symptom without status row - assume it's enabled
        inUse.push({
          symptomId: customSymptom.id,
          name: customSymptom.name,
          status: 'LOCAL_ONLY',
          isEnabled: true,
          canRevertToBase: false,
          lastEditedAt: null,
          lastEditedBy: null
        })
      }
    }

    // Build "available" array - base symptoms without a status row AND hidden via old system
    const available: AvailableSymptom[] = []
    for (const baseSymptom of baseSymptoms) {
      if (!statusByBaseId.has(baseSymptom.id) && hiddenBaseIds.has(baseSymptom.id)) {
        available.push({
          baseSymptomId: baseSymptom.id,
          name: baseSymptom.name
        })
      }
    }

    // Build "customOnly" array - custom symptoms without status rows
    // (Technically these should appear in inUse too, so this may be empty)
    const customOnly: CustomOnlySymptom[] = []
    for (const customSymptom of customSymptoms) {
      if (!statusByCustomId.has(customSymptom.id)) {
        customOnly.push({
          customSymptomId: customSymptom.id,
          name: customSymptom.name,
          isEnabled: true // Assume enabled if no status row exists
        })
      }
    }

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

    // TODO: allow PRACTICE ADMIN role to view/edit their own surgery only
    // For now, require SUPERUSER only
    if (user.globalRole !== 'SUPERUSER') {
      return NextResponse.json(
        { error: 'Superuser access required' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { action, surgeryId, baseSymptomId, customSymptomId, statusRowId } = body

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

        return NextResponse.json({ ok: true })
      }

      case 'DISABLE': {
        if (!statusRowId && !baseSymptomId) {
          return NextResponse.json(
            { error: 'statusRowId or baseSymptomId is required' },
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
        else if (baseSymptomId && resolvedSurgeryId) {
          const existing = await prisma.surgerySymptomStatus.findFirst({
            where: {
              surgeryId: resolvedSurgeryId,
              baseSymptomId
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
                baseSymptomId,
                isEnabled: false,
                isOverridden: false,
                lastEditedAt: now,
                lastEditedBy: editedBy
              }
            })
          }
        }

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

        return NextResponse.json({ ok: true })
      }

      case 'REVERT_TO_BASE': {
        if (!statusRowId && !baseSymptomId) {
          return NextResponse.json(
            { error: 'statusRowId or baseSymptomId is required' },
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

          if (!status.isOverridden) {
            return NextResponse.json(
              { error: 'Nothing to revert' },
              { status: 400 }
            )
          }

          targetBaseSymptomId = status.baseSymptomId
          targetSurgeryId = status.surgeryId
        }
        // Otherwise, find or create status row by baseSymptomId
        else if (baseSymptomId && resolvedSurgeryId) {
          const existing = await prisma.surgerySymptomStatus.findFirst({
            where: {
              surgeryId: resolvedSurgeryId,
              baseSymptomId
            },
            select: { id: true, isOverridden: true }
          })

          if (existing) {
            actualStatusRowId = existing.id
            if (!existing.isOverridden) {
              return NextResponse.json(
                { error: 'Nothing to revert' },
                { status: 400 }
              )
            }
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
            { error: 'Insufficient parameters' },
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

