import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/lib/rbac'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') // 'pending', 'actioned', 'discarded', or null for all
    const limit = parseInt(searchParams.get('limit') || '50')

    // Build where clause based on user role
    const where: any = {}
    
    if (user.globalRole === 'SUPERUSER') {
      // Superusers see all suggestions
    } else {
      // Surgery admins see only their surgery's suggestions
      const surgeryIds = user.memberships
        .filter(m => m.role === 'ADMIN')
        .map(m => m.surgeryId)
      
      if (surgeryIds.length === 0) {
        return NextResponse.json({ suggestions: [], unreadCount: 0 })
      }
      
      where.surgeryId = { in: surgeryIds }
    }

    // Add status filter
    if (status) {
      where.status = status
    }

    // Get suggestions with surgery details
    const suggestions = await prisma.suggestion.findMany({
      where,
      include: {
        surgery: {
          select: {
            id: true,
            name: true,
            slug: true,
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: limit
    })

    // Get unread count (pending suggestions)
    const unreadCount = await prisma.suggestion.count({
      where: {
        ...where,
        status: 'pending'
      }
    })

    return NextResponse.json({
      suggestions,
      unreadCount
    })
  } catch (error) {
    console.error('Error fetching suggestions:', error)
    return NextResponse.json(
      { error: 'Failed to fetch suggestions' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { suggestionId, status } = body

    if (!suggestionId || !status) {
      return NextResponse.json(
        { error: 'Missing suggestionId or status' },
        { status: 400 }
      )
    }

    if (!['pending', 'actioned', 'discarded'].includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status. Must be pending, actioned, or discarded' },
        { status: 400 }
      )
    }

    // Check if user has permission to update this suggestion
    const suggestion = await prisma.suggestion.findUnique({
      where: { id: suggestionId },
      include: {
        surgery: true
      }
    })

    if (!suggestion) {
      return NextResponse.json(
        { error: 'Suggestion not found' },
        { status: 404 }
      )
    }

    // Check permissions
    if (user.globalRole !== 'SUPERUSER') {
      const hasPermission = user.memberships.some(
        m => m.surgeryId === suggestion.surgeryId && m.role === 'ADMIN'
      )
      
      if (!hasPermission) {
        return NextResponse.json(
          { error: 'Insufficient permissions' },
          { status: 403 }
        )
      }
    }

    // Update the suggestion
    const updatedSuggestion = await prisma.suggestion.update({
      where: { id: suggestionId },
      data: {
        status,
        updatedAt: new Date()
      },
      include: {
        surgery: {
          select: {
            id: true,
            name: true,
            slug: true,
          }
        }
      }
    })

    return NextResponse.json({ suggestion: updatedSuggestion })
  } catch (error) {
    console.error('Error updating suggestion:', error)
    return NextResponse.json(
      { error: 'Failed to update suggestion' },
      { status: 500 }
    )
  }
}