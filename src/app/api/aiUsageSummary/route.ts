import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  try {
    // Check authentication and superuser role
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (user.globalRole !== 'SUPERUSER') {
      return NextResponse.json({ error: 'Superuser access required' }, { status: 403 })
    }

    // Calculate date ranges
    const now = new Date()
    const sevenDaysAgo = new Date(now)
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    const thirtyDaysAgo = new Date(now)
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    // Get USD to GBP conversion rate
    const usdToGbpRate = parseFloat(process.env.USD_TO_GBP_RATE || '0.8')

    // Fetch data for last 7 days
    const logs7Days = await prisma.tokenUsageLog.findMany({
      where: {
        createdAt: {
          gte: sevenDaysAgo,
        },
      },
    })

    // Fetch data for last 30 days
    const logs30Days = await prisma.tokenUsageLog.findMany({
      where: {
        createdAt: {
          gte: thirtyDaysAgo,
        },
      },
    })

    // Helper function to aggregate data
    const aggregateData = (logs: typeof logs7Days) => {
      const byRoute: Record<
        string,
        {
          route: string
          calls: number
          promptTokens: number
          completionTokens: number
          costUsd: number
          costGbp: number
        }
      > = {}

      let overall = {
        calls: 0,
        promptTokens: 0,
        completionTokens: 0,
        costUsd: 0,
        costGbp: 0,
      }

      for (const log of logs) {
        if (!byRoute[log.route]) {
          byRoute[log.route] = {
            route: log.route,
            calls: 0,
            promptTokens: 0,
            completionTokens: 0,
            costUsd: 0,
            costGbp: 0,
          }
        }

        byRoute[log.route].calls++
        byRoute[log.route].promptTokens += log.promptTokens
        byRoute[log.route].completionTokens += log.completionTokens
        byRoute[log.route].costUsd += log.estimatedCostUsd

        overall.calls++
        overall.promptTokens += log.promptTokens
        overall.completionTokens += log.completionTokens
        overall.costUsd += log.estimatedCostUsd
      }

      // Calculate GBP costs
      for (const routeData of Object.values(byRoute)) {
        routeData.costGbp = routeData.costUsd * usdToGbpRate
      }
      overall.costGbp = overall.costUsd * usdToGbpRate

      return {
        byRoute: Object.values(byRoute),
        overall,
      }
    }

    const last7days = aggregateData(logs7Days)
    const last30days = aggregateData(logs30Days)

    return NextResponse.json({
      last7days,
      last30days,
    })
  } catch (error) {
    console.error('Error in aiUsageSummary:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
