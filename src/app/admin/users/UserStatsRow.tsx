'use client'

import { Card } from '@/components/ui'
import type { UserStats } from './types'

interface UserStatsRowProps {
  stats: UserStats
}

export default function UserStatsRow({ stats }: UserStatsRowProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
      <Card padding="md">
        <div className="text-xs uppercase text-nhs-grey">Total users</div>
        <div className="text-2xl font-semibold text-nhs-dark-blue">{stats.total}</div>
      </Card>
      <Card padding="md">
        <div className="text-xs uppercase text-nhs-grey">System admins</div>
        <div className="text-2xl font-semibold text-purple-700">{stats.systemAdmins}</div>
      </Card>
      <Card padding="md">
        <div className="text-xs uppercase text-nhs-grey">Active last 30 days</div>
        <div className="text-2xl font-semibold text-green-700">{stats.activeLast30Days}</div>
      </Card>
      <Card padding="md">
        <div className="text-xs uppercase text-nhs-grey">Never signed in</div>
        <div className="text-2xl font-semibold text-amber-700">{stats.neverActive}</div>
      </Card>
    </div>
  )
}
