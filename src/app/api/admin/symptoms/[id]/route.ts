/**
 * Admin symptoms by ID API route
 * Handles individual symptom operations (update, delete)
 */

import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, requireSurgeryAuth } from '@/server/auth'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth()
    
    const { id } = await params
    const data = await request.json()

    const { source, name, ageGroup, briefInstruction, instructions, highlightedText, linkToPage } = data

    if (source === 'base') {
      // Superusers can update base symptoms
      if (session.type !== 'superuser') {
        return NextResponse.json(
          { error: 'Only superusers can update base symptoms' },
          { status: 403 }
        )
      }

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
      if (session.type !== 'surgery' || !session.surgeryId) {
        return NextResponse.json(
          { error: 'Only surgery admins can update custom symptoms' },
          { status: 403 }
        )
      }

      // Update custom symptom
      const updatedSymptom = await prisma.surgeryCustomSymptom.update({
        where: {
          id,
          surgeryId: session.surgeryId
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
      if (session.type !== 'surgery' || !session.surgeryId) {
        return NextResponse.json(
          { error: 'Only surgery admins can update overrides' },
          { status: 403 }
        )
      }

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
            surgeryId: session.surgeryId!,
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
          surgeryId: session.surgeryId,
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
    const session = await requireAuth()
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')

    if (action === 'restore' && session.type === 'superuser') {
      // Superuser restoring a hidden symptom for a surgery
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
    const session = await requireAuth()
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const source = searchParams.get('source')
    const action = searchParams.get('action') // 'permanent' for superuser, 'hide' for surgery admin

    if (source === 'base' && session.type === 'superuser' && action === 'permanent') {
      // Superuser permanent deletion of base symptom
      console.log(`Superuser deleting base symptom with id: ${id}`)
      
      await prisma.baseSymptom.delete({
        where: { id }
      })

      console.log(`Successfully deleted base symptom with id: ${id}`)
      return NextResponse.json({ success: true })
    } else if (source === 'base' && session.type === 'surgery' && session.surgeryId && action === 'hide') {
      // Surgery admin hiding a base symptom for their surgery
      await prisma.surgerySymptomOverride.upsert({
        where: {
          surgeryId_baseSymptomId: {
            surgeryId: session.surgeryId,
            baseSymptomId: id,
          }
        },
        update: {
          isHidden: true
        },
        create: {
          surgeryId: session.surgeryId,
          baseSymptomId: id,
          isHidden: true
        }
      })

      return NextResponse.json({ success: true })
    } else if (source === 'custom' && session.type === 'surgery' && session.surgeryId) {
      // Delete custom symptom
      await prisma.surgeryCustomSymptom.delete({
        where: {
          id,
          surgeryId: session.surgeryId
        }
      })

      return NextResponse.json({ success: true })
    } else if (source === 'override' && session.type === 'surgery' && session.surgeryId) {
      // Delete override (revert to base)
      await prisma.surgerySymptomOverride.delete({
        where: {
          surgeryId_baseSymptomId: {
            surgeryId: session.surgeryId,
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
    console.error('Error deleting symptom:', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}