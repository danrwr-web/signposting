import 'server-only'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

export async function POST() {
  try {
    // Update surgeries that have null slugs
    const surgeries = await prisma.surgery.findMany({
      where: {
        slug: null
      }
    })

    const updates = []
    for (const surgery of surgeries) {
      // Generate slug from name
      const slug = surgery.name
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
        .replace(/\s+/g, '-') // Replace spaces with hyphens
        .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
        .trim()

      updates.push(
        prisma.surgery.update({
          where: { id: surgery.id },
          data: { slug }
        })
      )
    }

    await Promise.all(updates)

    return NextResponse.json({
      success: true,
      message: `Updated ${updates.length} surgeries with slugs`,
      surgeries: surgeries.map(s => ({
        id: s.id,
        name: s.name,
        slug: s.name
          .toLowerCase()
          .replace(/[^a-z0-9\s-]/g, '')
          .replace(/\s+/g, '-')
          .replace(/-+/g, '-')
          .trim()
      }))
    })
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
