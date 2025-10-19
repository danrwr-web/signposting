import 'server-only'
import { getSessionUser } from '@/lib/rbac'
import { redirect } from 'next/navigation'

/**
 * Middleware to check if test users have exceeded their usage limit
 * Redirects to lockout page if limit is reached
 */
export async function checkTestUserUsageLimit(): Promise<void> {
  const user = await getSessionUser()
  
  if (!user) {
    return // Not logged in, let other middleware handle this
  }

  if (!user.isTestUser || !user.symptomUsageLimit) {
    return // Not a test user or no limit set
  }

  if (user.symptomsUsed >= user.symptomUsageLimit) {
    redirect('/test-user-lockout')
  }
}

/**
 * Hook to get test user usage information
 * Returns null if user is not a test user
 */
export async function getTestUserUsageInfo(): Promise<{
  isTestUser: boolean
  symptomsUsed: number
  symptomUsageLimit: number | null
  remaining: number | null
} | null> {
  const user = await getSessionUser()
  
  if (!user || !user.isTestUser || !user.symptomUsageLimit) {
    return null
  }

  return {
    isTestUser: true,
    symptomsUsed: user.symptomsUsed,
    symptomUsageLimit: user.symptomUsageLimit,
    remaining: user.symptomUsageLimit - user.symptomsUsed
  }
}
