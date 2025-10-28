import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/server/auth'
// Note: Sharp is heavy, using basic file handling for now
// import sharp from 'sharp'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'

const MAX_FILE_SIZE = 2 * 1024 * 1024 // 2MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const UPLOAD_DIR = join(process.cwd(), 'public', 'icons')

// Ensure upload directory exists
export async function ensureUploadDir() {
  try {
    await mkdir(UPLOAD_DIR, { recursive: true })
  } catch (error) {
    // Directory might already exist
  }
}

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const phrase = url.searchParams.get('phrase')
    
    // Check if ImageIcon model exists
    if (!('imageIcon' in prisma)) {
      if (phrase) {
        return NextResponse.json(null, { status: 200 })
      } else {
        return NextResponse.json({ icons: [] }, { status: 200 })
      }
    }
    
    // If phrase provided, return matching icon (for client-side use - no auth required)
    if (phrase) {
      const icons = await (prisma as any).imageIcon.findMany({
        where: { isEnabled: true }, // Only return enabled icons
        orderBy: { createdAt: 'desc' }
      })
      
      // Find first icon whose phrase appears in the provided text (case-insensitive)
      const matchingIcon = icons.find((icon: any) => 
        phrase.toLowerCase().includes(icon.phrase.toLowerCase())
      )
      
      return NextResponse.json(matchingIcon || null)
    }
    
    // Otherwise, return all icons (for admin use - requires superuser)
    const session = await getSession()
    
    if (!session || session.type !== 'superuser') {
      return NextResponse.json(
        { error: 'Unauthorized - superuser only' },
        { status: 403 }
      )
    }
    
    const icons = await (prisma as any).imageIcon.findMany({
      orderBy: { createdAt: 'desc' }
    })
    return NextResponse.json({ icons })
  } catch (error: any) {
    console.error('Error fetching image icons:', error)
    // Always return 200 to prevent client errors for phrase lookups
    if (request.url.includes('?phrase=')) {
      return NextResponse.json(null, { status: 200 })
    } else {
      return NextResponse.json({ icons: [] }, { status: 200 })
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    
    // Check if user is authenticated and is superuser
    if (!session || session.type !== 'superuser') {
      return NextResponse.json(
        { error: 'Unauthorized - superuser only' },
        { status: 403 }
      )
    }

    const formData = await request.formData()
    const file = formData.get('file') as File
    const phrase = formData.get('phrase') as string
    const alt = formData.get('alt') as string || undefined

    if (!file || !phrase) {
      return NextResponse.json(
        { error: 'File and phrase are required' },
        { status: 400 }
      )
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Use JPEG, PNG, WebP, or GIF' },
        { status: 400 }
      )
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File too large. Maximum 2MB.' },
        { status: 400 }
      )
    }

    // Check if phrase already exists
    try {
      const existing = await (prisma as any).imageIcon.findUnique({
        where: { phrase: phrase.trim() }
      })

      if (existing) {
        return NextResponse.json(
          { error: 'An icon for this phrase already exists' },
          { status: 409 }
        )
      }
    } catch (error) {
      // If imageIcon doesn't exist, return 503
      const errorMsg = error instanceof Error ? error.message : String(error)
      if (errorMsg.includes('imageIcon') || errorMsg.includes('not found')) {
        return NextResponse.json(
          { error: 'Image icon feature not available. Deployment may still be completing.' },
          { status: 503 }
        )
      }
      throw error
    }

    // For now, store file as base64 in database instead of filesystem (Vercel doesn't allow file writes)
    const buffer = Buffer.from(await file.arrayBuffer())
    const base64Data = buffer.toString('base64')
    const dataUri = `data:${file.type};base64,${base64Data}`
    
    const imageUrl = dataUri
    
    // TODO: Get actual dimensions from buffer or use a lightweight image library
    const width = null
    const height = null
    
    // Save to database with base64 data
    const icon = await (prisma as any).imageIcon.create({
      data: {
        phrase: phrase.trim(),
        filePath: '', // Not using filesystem storage
        imageUrl,
        alt: alt || phrase.trim(),
        width,
        height,
        createdBy: session.email || 'unknown'
      }
    })

    return NextResponse.json({ icon }, { status: 201 })
  } catch (error) {
    console.error('Error uploading image icon:', error)
    const errorMsg = error instanceof Error ? error.message : String(error)
    
    // Check if it's an imageIcon missing error
    if (errorMsg.includes('imageIcon') || errorMsg.includes('Cannot read properties of undefined') || errorMsg.includes('reading \'imageIcon\'')) {
      return NextResponse.json(
        { error: 'Image icon feature not available. The Prisma client needs to be regenerated. Please try again in a few minutes or contact support.' },
        { status: 503 }
      )
    }
    
    return NextResponse.json(
      { error: 'Failed to upload image icon', details: errorMsg },
      { status: 500 }
    )
  }
}
