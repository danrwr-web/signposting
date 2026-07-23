'use client'

import { Card } from '@/components/ui'
import type { MemberStats } from './types'

interface MemberStatsRowProps {
  stats: MemberStats
}

export default function MemberStatsRow({ stats }: MemberStatsRowProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
      <Card padding="md">
        <div className="text-xs uppercase text-nhs-grey">Total members</div>
        <div className="text-2xl font-semibold text-nhs-dark-blue">{stats.total}</div>
      </Card>
      <Card padding="md">
        <div className="text-xs uppercase text-nhs-grey">Practice admins</div>
        <div className="text-2xl font-semibold text-green-700">{stats.practiceAdmins}</div>
      </Card>
      <Card padding="md">
        <div className="text-xs uppercase text-nhs-grey">Active last 30 days</div>
        <div className="text-2xl font-semibold text-nhs-blue">{stats.activeLast30Days}</div>
      </Card>
      <Card padding="md">
        <div className="text-xs uppercase text-nhs-grey">Never signed in</div>
        <div className="text-2xl font-semibold text-amber-700">{stats.neverActive}</div>
      </Card>
    </div>
  )
}
