import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from '@/lib/auth'
import prisma from '@/lib/prisma'
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
    
    // If phrase provided, return matching icon (for client-side use)
    if (phrase) {
      const icons = await prisma.imageIcon.findMany({
        orderBy: { createdAt: 'desc' }
      })
      
      // Find first icon whose phrase appears in the provided text (case-insensitive)
      const matchingIcon = icons.find(icon => 
        phrase.toLowerCase().includes(icon.phrase.toLowerCase())
      )
      
      return NextResponse.json(matchingIcon || null)
    }
    
    // Otherwise return all icons (for admin use)
    const icons = await prisma.imageIcon.findMany({
      orderBy: { createdAt: 'desc' }
    })
    return NextResponse.json({ icons })
  } catch (error) {
    console.error('Error fetching image icons:', error)
    return NextResponse.json(
      { error: 'Failed to fetch image icons' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession()
    
    // Only superusers can create image icons
    if (!session || (session.type !== 'superuser' && session.type !== 'surgery')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
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
    const existing = await prisma.imageIcon.findUnique({
      where: { phrase: phrase.trim() }
    })

    if (existing) {
      return NextResponse.json(
        { error: 'An icon for this phrase already exists' },
        { status: 409 }
      )
    }

    // Process and save image
    await ensureUploadDir()
    
    const buffer = Buffer.from(await file.arrayBuffer())
    
    // Generate safe filename
    const safePhrase = phrase.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-')
    const extension = file.name.split('.').pop()?.toLowerCase() || 'png'
    const filename = `${safePhrase}-${Date.now()}.${extension}`
    const filepath = join(UPLOAD_DIR, filename)
    
    // Save file as-is for now
    await writeFile(filepath, buffer)
    
    const imageUrl = `/icons/${filename}`
    
    // TODO: Get actual dimensions from buffer or use a lightweight image library
    const width = null
    const height = null
    
    // Save to database
    const icon = await prisma.imageIcon.create({
      data: {
        phrase: phrase.trim(),
        filePath: filepath,
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
    return NextResponse.json(
      { error: 'Failed to upload image icon' },
      { status: 500 }
    )
  }
}
