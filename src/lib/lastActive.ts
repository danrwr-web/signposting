import 'server-only'

import { prisma } from '@/lib/prisma'

/**
 * Retrieves the most recent activity timestamp for a list of users.
 * 
 * "Last active" is derived from the most recent engagement event:
 * - AdminToolkitEngagementEvent (by userId)
 * - EngagementEvent (by userEmail) - if userId is available
 * 
 * Returns a Map of userId -> lastActiveAt (Date or null if no activity).
 */
export async function getLastActiveForUsers(
  userIds: string[]
): Promise<Map<string, Date | null>> {
  if (userIds.length === 0) {
    return new Map()
  }

  // Get the latest AdminToolkitEngagementEvent for each user
  const adminToolkitEvents = await prisma.adminToolkitEngagementEvent.groupBy({
    by: ['userId'],
    where: {
      userId: { in: userIds }
    },
    _max: {
      createdAt: true
    }
  })

  // Build initial map from admin toolkit events
  const lastActiveMap = new Map<string, Date | null>()
  
  for (const event of adminToolkitEvents) {
    lastActiveMap.set(event.userId, event._max.createdAt)
  }

  // Get user emails for those we need to check EngagementEvent table
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, email: true }
  })

  const userEmailMap = new Map(users.map(u => [u.email, u.id]))
  const userIdToEmailMap = new Map(users.map(u => [u.id, u.email]))

  // Get the latest EngagementEvent for each user email
  const engagementEvents = await prisma.engagementEvent.groupBy({
    by: ['userEmail'],
    where: {
      userEmail: { in: users.map(u => u.email) }
    },
    _max: {
      createdAt: true
    }
  })

  // Merge engagement events - take the most recent activity from either source
  for (const event of engagementEvents) {
    if (!event.userEmail || !event._max.createdAt) continue
    
    const userId = userEmailMap.get(event.userEmail)
    if (!userId) continue

    const existingDate = lastActiveMap.get(userId)
    const eventDate = event._max.createdAt

    if (!existingDate || eventDate > existingDate) {
      lastActiveMap.set(userId, eventDate)
    }
  }

  // Fill in null for users with no activity
  for (const userId of userIds) {
    if (!lastActiveMap.has(userId)) {
      lastActiveMap.set(userId, null)
    }
  }

  return lastActiveMap
}

/**
 * Retrieves the most recent activity timestamp for users within a specific surgery.
 * 
 * Filters activity to only include events related to the specified surgery.
 * Returns a Map of userId -> lastActiveAt (Date or null if no activity).
 */
export async function getLastActiveForSurgeryUsers(
  surgeryId: string,
  userIds: string[]
): Promise<Map<string, Date | null>> {
  if (userIds.length === 0) {
    return new Map()
  }

  // Get the latest AdminToolkitEngagementEvent for each user in this surgery
  const adminToolkitEvents = await prisma.adminToolkitEngagementEvent.groupBy({
    by: ['userId'],
    where: {
      userId: { in: userIds },
      surgeryId: surgeryId
    },
    _max: {
      createdAt: true
    }
  })

  // Build initial map from admin toolkit events
  const lastActiveMap = new Map<string, Date | null>()
  
  for (const event of adminToolkitEvents) {
    lastActiveMap.set(event.userId, event._max.createdAt)
  }

  // Get user emails for those we need to check EngagementEvent table
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, email: true }
  })

  const userEmailMap = new Map(users.map(u => [u.email, u.id]))

  // Get the latest EngagementEvent for each user email in this surgery
  const engagementEvents = await prisma.engagementEvent.groupBy({
    by: ['userEmail'],
    where: {
      userEmail: { in: users.map(u => u.email) },
      surgeryId: surgeryId
    },
    _max: {
      createdAt: true
    }
  })

  // Merge engagement events - take the most recent activity from either source
  for (const event of engagementEvents) {
    if (!event.userEmail || !event._max.createdAt) continue
    
    const userId = userEmailMap.get(event.userEmail)
    if (!userId) continue

    const existingDate = lastActiveMap.get(userId)
    const eventDate = event._max.createdAt

    if (!existingDate || eventDate > existingDate) {
      lastActiveMap.set(userId, eventDate)
    }
  }

  // Fill in null for users with no activity
  for (const userId of userIds) {
    if (!lastActiveMap.has(userId)) {
      lastActiveMap.set(userId, null)
    }
  }

  return lastActiveMap
}
