/**
 * Admin symptoms by ID API route
 * Handles individual symptom operations (update, delete)
 */

import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser, requireSuperuser, requireSurgeryAdmin } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const data = await request.json()

    const { source, surgeryId, name, ageGroup, briefInstruction, instructions, highlightedText, linkToPage } = data

    if (source === 'base') {
      // Superusers can update base symptoms
      await requireSuperuser()

      const updatedSymptom = await prisma.baseSymptom.update({
        where: { id },
        data: {
          name,
          ageGroup,
          briefInstruction,
          instructions,
          highlightedText,
          linkToPage,
        }
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
      // Superuser restoring a hidden symptom for a surgery
      await requireSuperuser()
      
      const surgeryId = searchParams.get('surgeryId')
      if (!surgeryId) {
        return NextResponse.json(
          { message: 'Surgery ID required for restore' },
          { status: 400 }
        )
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
      
      await prisma.baseSymptom.delete({
        where: { id }
      })

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

      console.log(`Successfully hidden base symptom ${id} for surgery ${surgeryId}`)
      return NextResponse.json({ success: true })
    } else if (source === 'custom' && surgeryId) {
      // Delete custom symptom
      await requireSurgeryAdmin(surgeryId)
      
      await prisma.surgeryCustomSymptom.delete({
        where: {
          id,
          surgeryId: surgeryId
        }
      })

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