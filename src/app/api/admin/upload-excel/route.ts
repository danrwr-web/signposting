import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser, can } from '@/lib/rbac'
import { parseExcelFile } from '@/lib/excel-parser'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    // Check authentication and authorization
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Restrict Excel upload to superusers only (base symptom library management)
    if (!can(user).isSuperuser()) {
      return NextResponse.json(
        { error: 'Access denied. Excel upload is restricted to superusers only.' },
        { status: 403 }
      )
    }

    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    // Validate file type
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      return NextResponse.json(
        { error: 'File must be an Excel file (.xlsx or .xls)' },
        { status: 400 }
      )
    }

    // Read file buffer
    const buffer = Buffer.from(await file.arrayBuffer())
    
    // Parse Excel file
    let symptoms
    try {
      symptoms = parseExcelFile(buffer)
    } catch (parseError) {
      console.error('Excel parsing error:', parseError)
      return NextResponse.json(
        { error: `Failed to parse Excel file: ${parseError instanceof Error ? parseError.message : 'Unknown error'}` },
        { status: 400 }
      )
    }

    if (symptoms.length === 0) {
      return NextResponse.json(
        { error: 'No valid symptoms found in the Excel file. Please check that your file has the required columns: Symptom, AgeGroup, BriefInstruction, Instructions' },
        { status: 400 }
      )
    }

    // Upsert symptoms
    let created = 0
    let updated = 0

    for (const symptomData of symptoms) {
      // Check if symptom already exists by slug
      const existing = await prisma.baseSymptom.findFirst({
        where: { slug: symptomData.slug }
      })

      if (existing) {
        await prisma.baseSymptom.update({
          where: { id: existing.id },
          data: {
            name: symptomData.name,
            ageGroup: symptomData.ageGroup,
            briefInstruction: symptomData.briefInstruction,
            instructions: symptomData.instructions,
            highlightedText: symptomData.highlightedText,
            linkToPage: symptomData.linkToPage,
          }
        })
        updated++
      } else {
        await prisma.baseSymptom.create({
          data: {
            slug: symptomData.slug,
            name: symptomData.name,
            ageGroup: symptomData.ageGroup,
            briefInstruction: symptomData.briefInstruction,
            instructions: symptomData.instructions,
            highlightedText: symptomData.highlightedText,
            linkToPage: symptomData.linkToPage,
          }
        })
        created++
      }
    }

    return NextResponse.json({
      message: 'Excel file processed successfully',
      stats: {
        total: symptoms.length,
        created,
        updated,
      }
    })
  } catch (error) {
    console.error('Error processing Excel file:', error)
    return NextResponse.json(
      { error: 'Failed to process Excel file' },
      { status: 500 }
    )
  }
}
