/**
 * Admin symptoms by ID API route
 * Handles individual symptom operations (update, delete)
 */

import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser, requireSuperuser, requireSurgeryAdmin } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'
import { revalidateTag } from 'next/cache'
import { getCachedSymptomsTag } from '@/server/effectiveSymptoms'

export const runtime = 'nodejs'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const data = await request.json()

    const { source, surgeryId, name, ageGroup, briefInstruction, instructions, instructionsJson, instructionsHtml, highlightedText, linkToPage, variants } = data

    if (source === 'base') {
      // Superusers can update base symptoms
      await requireSuperuser()

      const updateData: any = {
        name,
        ageGroup,
        briefInstruction,
        instructions,
        instructionsJson: instructionsJson ? JSON.stringify(instructionsJson) : null,
        instructionsHtml,
        highlightedText,
        linkToPage,
      }
      // Only update variants if explicitly provided; otherwise leave unchanged
      if (Object.prototype.hasOwnProperty.call(data, 'variants')) {
        updateData.variants = variants ?? null
      }

      const updatedSymptom = await prisma.baseSymptom.update({
        where: { id },
        data: updateData,
      })

      return NextResponse.json(updatedSymptom)
    } else if (source === 'custom') {
      // Only surgery admins can update custom symptoms
      if (!surgeryId) {
        return NextResponse.json(
          { error: 'Surgery ID is required for custom symptoms' },
          { status: 400 }
        )
      }
      
      await requireSurgeryAdmin(surgeryId)

      // Update custom symptom
      const updatedSymptom = await prisma.surgeryCustomSymptom.update({
        where: {
          id,
          surgeryId: surgeryId
        },
        data: {
          name,
          ageGroup,
          briefInstruction,
          instructions,
          instructionsJson: instructionsJson ? JSON.stringify(instructionsJson) : null,
          instructionsHtml,
          highlightedText,
          linkToPage,
        }
      })

      return NextResponse.json(updatedSymptom)
    } else if (source === 'override') {
      // Only surgery admins can update overrides
      if (!surgeryId) {
        return NextResponse.json(
          { error: 'Surgery ID is required for overrides' },
          { status: 400 }
        )
      }
      
      await requireSurgeryAdmin(surgeryId)

      // Update or create override
      const baseSymptom = await prisma.baseSymptom.findUnique({
        where: { id }
      })

      if (!baseSymptom) {
        return NextResponse.json(
          { message: 'Base symptom not found' },
          { status: 404 }
        )
      }

      const updatedOverride = await prisma.surgerySymptomOverride.upsert({
        where: {
          surgeryId_baseSymptomId: {
            surgeryId: surgeryId,
            baseSymptomId: id,
          }
        },
        update: {
          name,
          ageGroup,
          briefInstruction,
          instructions,
          instructionsJson: instructionsJson ? JSON.stringify(instructionsJson) : null,
          instructionsHtml,
          highlightedText,
          linkToPage,
        },
        create: {
          surgeryId: surgeryId,
          baseSymptomId: id,
          name,
          ageGroup,
          briefInstruction,
          instructions,
          instructionsJson: instructionsJson ? JSON.stringify(instructionsJson) : null,
          instructionsHtml,
          highlightedText,
          linkToPage,
        }
      })

      return NextResponse.json(updatedOverride)
    }

    return NextResponse.json(
      { message: 'Invalid source' },
      { status: 400 }
    )
  } catch (error) {
    if (error instanceof Error && error.message.includes('required')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Error updating symptom:', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')

    if (action === 'restore') {
      // Allow superusers to restore any hidden symptom, or surgery admins to restore for their own surgery
      const surgeryId = searchParams.get('surgeryId')
      if (!surgeryId) {
        return NextResponse.json(
          { message: 'Surgery ID required for restore' },
          { status: 400 }
        )
      }

      // Check if user is superuser or surgery admin for this surgery
      const user = await getSessionUser()
      if (!user) {
        return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
      }

      const isSuperuser = user.globalRole === 'SUPERUSER'
      const isSurgeryAdmin = user.memberships.some(m => m.surgeryId === surgeryId && m.role === 'ADMIN')

      if (!isSuperuser && !isSurgeryAdmin) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }

      // Remove the hidden override
      await prisma.surgerySymptomOverride.delete({
        where: {
          surgeryId_baseSymptomId: {
            surgeryId,
            baseSymptomId: id,
          }
        }
      })

      // Invalidate cached effective symptoms for this surgery
      revalidateTag(getCachedSymptomsTag(surgeryId, false))
      revalidateTag(getCachedSymptomsTag(surgeryId, true))
      revalidateTag('symptoms')

      return NextResponse.json({ success: true })
    }

    return NextResponse.json(
      { message: 'Invalid operation or insufficient permissions' },
      { status: 400 }
    )
  } catch (error) {
    if (error instanceof Error && error.message.includes('required')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Error restoring symptom:', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const source = searchParams.get('source')
    const action = searchParams.get('action') // 'permanent' for superuser, 'hide' for surgery admin
    const surgeryId = searchParams.get('surgeryId')

    console.log('DELETE /api/admin/symptoms/[id]:', { id, source, action, surgeryId })

    if (source === 'base' && action === 'permanent') {
      // Superuser permanent deletion of base symptom
      await requireSuperuser()
      
      console.log(`Superuser deleting base symptom with id: ${id}`)
      
      // Clean up related rows (status rows, overrides) and delete base symptom
      await prisma.$transaction([
        prisma.surgerySymptomOverride.deleteMany({ where: { baseSymptomId: id } }),
        prisma.surgerySymptomStatus.deleteMany({ where: { baseSymptomId: id } }),
        prisma.baseSymptom.delete({ where: { id } }),
      ])

      // Base symptom changes can affect all surgeries.
      revalidateTag('symptoms')
      console.log(`Successfully deleted base symptom with id: ${id}`)
      return NextResponse.json({ success: true })
    } else if (source === 'base' && action === 'hide' && surgeryId) {
      // Surgery admin hiding a base symptom for their surgery
      console.log(`Surgery admin hiding base symptom ${id} for surgery ${surgeryId}`)
      await requireSurgeryAdmin(surgeryId)
      
      await prisma.surgerySymptomOverride.upsert({
        where: {
          surgeryId_baseSymptomId: {
            surgeryId: surgeryId,
            baseSymptomId: id,
          }
        },
        update: {
          isHidden: true
        },
        create: {
          surgeryId: surgeryId,
          baseSymptomId: id,
          isHidden: true
        }
      })

      revalidateTag(getCachedSymptomsTag(surgeryId, false))
      revalidateTag(getCachedSymptomsTag(surgeryId, true))
      revalidateTag('symptoms')
      console.log(`Successfully hidden base symptom ${id} for surgery ${surgeryId}`)
      return NextResponse.json({ success: true })
    } else if (source === 'custom' && surgeryId) {
      // Delete custom symptom - allow both superusers and surgery admins
      const user = await getSessionUser()
      if (!user) {
        return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
      }

      const isSuperuser = user.globalRole === 'SUPERUSER'
      const isSurgeryAdmin = user.memberships.some(m => m.surgeryId === surgeryId && m.role === 'ADMIN')

      if (!isSuperuser && !isSurgeryAdmin) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      
      // Soft delete + remove status rows so effective symptom list can't reference it.
      await prisma.$transaction([
        prisma.surgerySymptomStatus.deleteMany({ where: { surgeryId, customSymptomId: id } }),
        prisma.surgeryCustomSymptom.update({ where: { id, surgeryId }, data: { isDeleted: true } }),
      ])

      revalidateTag(getCachedSymptomsTag(surgeryId, false))
      revalidateTag(getCachedSymptomsTag(surgeryId, true))
      revalidateTag('symptoms')

      return NextResponse.json({ success: true })
    } else if (source === 'override' && surgeryId) {
      // Delete override (revert to base)
      await requireSurgeryAdmin(surgeryId)
      
      await prisma.surgerySymptomOverride.delete({
        where: {
          surgeryId_baseSymptomId: {
            surgeryId: surgeryId,
            baseSymptomId: id,
          }
        }
      })

      revalidateTag(getCachedSymptomsTag(surgeryId, false))
      revalidateTag(getCachedSymptomsTag(surgeryId, true))
      revalidateTag('symptoms')
      return NextResponse.json({ success: true })
    }

    return NextResponse.json(
      { message: 'Invalid operation or insufficient permissions' },
      { status: 400 }
    )
  } catch (error) {
    if (error instanceof Error && error.message.includes('required')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Error deleting symptom:', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}