/**
 * Admin symptoms API route
 * Handles CRUD operations for effective symptoms (base + overrides + custom)
 */

import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/server/auth'
import { getEffectiveSymptoms } from '@/server/effectiveSymptoms'
import { prisma } from '@/lib/prisma'
import { GetEffectiveSymptomsResZ, CreateSymptomReqZ } from '@/lib/api-contracts'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth()
    const { searchParams } = new URL(request.url)
    const letter = searchParams.get('letter') ?? 'All'
    const q = (searchParams.get('q') ?? '').trim().toLowerCase()

    // Get effective symptoms for this surgery (or all if superuser)
    let allSymptoms
    if (session.type === 'surgery' && session.surgeryId) {
      allSymptoms = await getEffectiveSymptoms(session.surgeryId)
    } else if (session.type === 'superuser') {
      // For superuser, get all base symptoms
      allSymptoms = await prisma.baseSymptom.findMany({
        select: { 
          id: true, 
          slug: true, 
          name: true, 
          ageGroup: true,
          briefInstruction: true, 
          highlightedText: true, 
          instructions: true, 
          linkToPage: true 
        },
        orderBy: { name: 'asc' }
      }).then(results => 
        results.map(s => ({ ...s, source: 'base' as const }))
      )
    } else {
      return NextResponse.json(
        { error: 'Invalid session type' },
        { status: 403 }
      )
    }

    // Apply filters
    let symptoms = allSymptoms

    if (letter !== 'All') {
      symptoms = symptoms.filter(s => 
        s.name.trim().toUpperCase().startsWith(letter)
      )
    }

    if (q) {
      symptoms = symptoms.filter(s =>
        s.name.toLowerCase().includes(q) ||
        s.briefInstruction?.toLowerCase().includes(q) ||
        s.instructions?.toLowerCase().includes(q)
      )
    }

    return NextResponse.json(
      GetEffectiveSymptomsResZ.parse({ symptoms }),
      { headers: { 'Cache-Control': 'private, max-age=30' } }
    )
  } catch (error) {
    console.error('Error fetching admin symptoms:', error)
    return NextResponse.json(
      { error: 'Failed to fetch symptoms' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth()
    
    // Check session type and handle accordingly
    if (session.type !== 'surgery' && session.type !== 'superuser') {
      return NextResponse.json(
        { error: 'Invalid session type' },
        { status: 403 }
      )
    }
    
    if (session.type === 'surgery' && !session.surgeryId) {
      return NextResponse.json(
        { error: 'Surgery session missing surgery ID' },
        { status: 403 }
      )
    }
    
    const body = await request.json()
    const { name, slug, ageGroup, briefInstruction, instructions, highlightedText, linkToPage } = CreateSymptomReqZ.parse(body)

    if (session.type === 'superuser') {
      // Superusers create base symptoms visible to all surgeries
      const existingSymptom = await prisma.baseSymptom.findUnique({
        where: { slug }
      })

      if (existingSymptom) {
        return NextResponse.json(
          { error: 'A symptom with this slug already exists' },
          { status: 409 }
        )
      }

      const symptom = await prisma.baseSymptom.create({
        data: {
          slug,
          name,
          ageGroup,
          briefInstruction,
          instructions,
          highlightedText,
          linkToPage,
        },
        select: {
          id: true,
          slug: true,
          name: true,
          ageGroup: true,
          briefInstruction: true,
          highlightedText: true,
          instructions: true,
          linkToPage: true,
        }
      })

      return NextResponse.json({ symptom }, { status: 201 })
    } else {
      // Surgery admins create custom symptoms visible only to their surgery
      const existingSymptom = await prisma.surgeryCustomSymptom.findUnique({
        where: {
          surgeryId_slug: {
            surgeryId: session.surgeryId!,
            slug: slug
          }
        }
      })

      if (existingSymptom) {
        return NextResponse.json(
          { error: 'A symptom with this slug already exists for this surgery' },
          { status: 409 }
        )
      }

      const symptom = await prisma.surgeryCustomSymptom.create({
        data: {
          surgeryId: session.surgeryId!,
          slug,
          name,
          ageGroup,
          briefInstruction,
          instructions,
          highlightedText,
          linkToPage,
        },
        select: {
          id: true,
          slug: true,
          name: true,
          ageGroup: true,
          briefInstruction: true,
          highlightedText: true,
          instructions: true,
          linkToPage: true,
        }
      })

      return NextResponse.json({ symptom }, { status: 201 })
    }
  } catch (error) {
    console.error('Error creating custom symptom:', error)
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Invalid request format' },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: 'Failed to create symptom' },
      { status: 500 }
    )
  }
}