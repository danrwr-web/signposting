'use client'

import { useEffect, useState } from 'react'
import type { Session } from '@/server/auth'
import { FEATURE_HIDE_AGE_BANDS } from '@/lib/featureKeys'
import type { EngagementTopRes } from '@/lib/api-contracts'
import { buildEngagementCsv, downloadCsv } from '@/lib/engagementCsv'
import {
  AlertBanner,
  Badge,
  Button,
  Card,
  Dialog,
  EmptyState,
  Select,
  Skeleton,
  SkeletonCard,
} from '@/components/ui'
import { RankedList } from './RankedList'
import { SummaryTiles } from './SummaryTiles'
import { TrendChart } from './TrendChart'
import { LeastViewedCard } from './LeastViewedCard'
import { BusiestTimesCard } from './BusiestTimesCard'
import { ageGroupBadgeColor } from './ageGroupBadge'

type DateRange = '7d' | '30d' | '90d' | 'all'

const RANGE_LABELS: Record<DateRange, string> = {
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
  '90d': 'Last 90 days',
  all: 'All time',
}

const PERIOD_LABELS: Record<DateRange, string> = {
  '7d': '7 days',
  '30d': '30 days',
  '90d': '90 days',
  all: 'period',
}

interface EngagementAnalyticsProps {
  session: Session
  /** 'all' for the cross-surgery overview, or a surgery id. Owned by the parent
   *  page (see SurgeryContextBar on /admin). Only meaningful for superusers. */
  selectedSurgeryId?: string
  /** Called when the user drills into a surgery from the breakdown list. */
  onSelectSurgery?: (surgeryId: string) => void
}

export default function EngagementAnalytics({
  session,
  selectedSurgeryId = 'all',
  onSelectSurgery,
}: EngagementAnalyticsProps) {
  const [engagementData, setEngagementData] = useState<EngagementTopRes | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dateRange, setDateRange] = useState<DateRange>('30d')
  const [limit, setLimit] = useState(10)
  const [showExportModal, setShowExportModal] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  // Hide age badges when viewing a single surgery that runs in all-ages mode
  const [hideAgeBands, setHideAgeBands] = useState(false)

  const scopedSurgeryId =
    session.type === 'surgery' && session.surgeryId
      ? session.surgeryId
      : session.type === 'superuser' && selectedSurgeryId !== 'all'
        ? selectedSurgeryId
        : null

  useEffect(() => {
    if (!scopedSurgeryId) {
      setHideAgeBands(false)
      return
    }
    let cancelled = false
    fetch(`/api/surgeries/${scopedSurgeryId}/features`, { cache: 'no-store' })
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        if (!cancelled) setHideAgeBands(!!data?.features?.[FEATURE_HIDE_AGE_BANDS])
      })
      .catch(() => {
        if (!cancelled) setHideAgeBands(false)
      })
    return () => { cancelled = true }
  }, [scopedSurgeryId])

  useEffect(() => {
    let cancelled = false
    const fetchEngagementData = async () => {
      try {
        setIsLoading(true)
        setError(null)

        const params = new URLSearchParams({
          limit: limit.toString(),
        })

        if (dateRange !== 'all') {
          const days = dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : 90
          const startDate = new Date()
          startDate.setDate(startDate.getDate() - days)
          params.append('startDate', startDate.toISOString())
        }

        if (session.type === 'surgery' && session.surgeryId) {
          // Surgery admins see only their surgery's data
          params.append('surgeryId', session.surgeryId)
        } else if (session.type === 'superuser' && selectedSurgeryId !== 'all') {
          // Superusers can drill down to specific surgeries
          params.append('surgeryId', selectedSurgeryId)
        }

        if (session.type === 'superuser') {
          params.append('includeSurgeryBreakdown', 'true')
        }

        const response = await fetch(`/api/engagement/top?${params}`)

        if (!response.ok) {
          throw new Error('Failed to fetch engagement data')
        }

        const data: EngagementTopRes = await response.json()
        if (!cancelled) setEngagementData(data)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'An error occurred')
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    fetchEngagementData()
    return () => { cancelled = true }
  }, [session, limit, dateRange, selectedSurgeryId, refreshKey])

  const handleExport = () => {
    if (!engagementData) return
    const csv = buildEngagementCsv(engagementData, {
      rangeLabel: RANGE_LABELS[dateRange],
      scopeLabel: scopedSurgeryId ?? 'All surgeries',
      generatedAt: new Date(),
    })
    downloadCsv(csv, `engagement-data-${dateRange}-${new Date().toISOString().split('T')[0]}.csv`)
    setShowExportModal(false)
  }

  const header = (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-xl font-semibold text-nhs-dark-blue">Engagement Analytics</h2>
      <div className="flex items-center gap-3">
        <Select
          value={dateRange}
          onChange={e => setDateRange(e.target.value as DateRange)}
          disabled={isLoading}
          aria-label="Date range"
          className="w-auto"
        >
          {(Object.keys(RANGE_LABELS) as DateRange[]).map(range => (
            <option key={range} value={range}>
              {RANGE_LABELS[range]}
            </option>
          ))}
        </Select>
        <Select
          value={limit}
          onChange={e => setLimit(Number(e.target.value))}
          disabled={isLoading}
          aria-label="Number of results"
          className="w-auto"
        >
          <option value={5}>Top 5</option>
          <option value={10}>Top 10</option>
          <option value={20}>Top 20</option>
        </Select>
        <Button
          variant="success"
          onClick={() => setShowExportModal(true)}
          disabled={isLoading || !engagementData}
        >
          Export Data
        </Button>
      </div>
    </div>
  )

  if (isLoading) {
    return (
      <div className="space-y-6">
        {header}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <Card key={i} elevation="flat" padding="md">
              <Skeleton height="h-4" width="w-2/3" />
              <Skeleton height="h-8" width="w-1/3" className="mt-2" />
            </Card>
          ))}
        </div>
        <SkeletonCard lines={4} />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <SkeletonCard lines={5} />
          <SkeletonCard lines={5} />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        <h2 className="text-xl font-semibold text-nhs-dark-blue">Engagement Analytics</h2>
        <AlertBanner variant="error">
          <div>
            <p className="font-medium">Error loading engagement data</p>
            <p className="mt-1">{error}</p>
            <Button
              variant="danger-soft"
              size="sm"
              className="mt-3"
              onClick={() => setRefreshKey(k => k + 1)}
            >
              Retry
            </Button>
          </div>
        </AlertBanner>
      </div>
    )
  }

  const isSuperuser = session.type === 'superuser'

  return (
    <div className="space-y-6">
      {header}

      {engagementData && (
        <SummaryTiles
          totals={engagementData.totals}
          previousTotals={engagementData.previousTotals}
          periodLabel={PERIOD_LABELS[dateRange]}
          isSuperuser={isSuperuser}
        />
      )}

      {/* Views over time */}
      <Card elevation="flat" padding="lg">
        <div className="mb-4 flex items-baseline justify-between gap-3">
          <h3 className="text-lg font-medium text-gray-900">Views Over Time</h3>
          <span className="text-sm text-gray-500">
            {engagementData?.trend.capped ? 'Last 90 days' : RANGE_LABELS[dateRange]}
          </span>
        </div>
        {engagementData && <TrendChart points={engagementData.trend.points} />}
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Top Symptoms */}
        <Card elevation="flat" padding="lg">
          <h3 className="mb-4 text-lg font-medium text-gray-900">Most Viewed Symptoms</h3>
          {engagementData && engagementData.topSymptoms.length > 0 ? (
            <RankedList
              countClass="text-nhs-blue"
              barClass="bg-nhs-blue/10"
              items={engagementData.topSymptoms.map(symptom => ({
                key: symptom.id,
                label: symptom.name,
                badge: hideAgeBands ? undefined : (
                  <Badge color={ageGroupBadgeColor(symptom.ageGroup)} size="sm">
                    {symptom.ageGroup}
                  </Badge>
                ),
                count: symptom.viewCount,
                unit: 'views',
              }))}
            />
          ) : (
            <EmptyState
              illustration="search"
              title="No engagement data"
              description="Symptom views will appear here once staff start using the directory."
            />
          )}
        </Card>

        {/* Top Users */}
        <Card elevation="flat" padding="lg">
          <h3 className="mb-4 text-lg font-medium text-gray-900">Most Active Users</h3>
          {engagementData && engagementData.topUsers.length > 0 ? (
            <RankedList
              countClass="text-nhs-green"
              barClass="bg-nhs-green/10"
              items={engagementData.topUsers.map(user => ({
                key: user.userEmail,
                label: user.userEmail,
                count: user.engagementCount,
                unit: 'views',
              }))}
            />
          ) : (
            <EmptyState
              illustration="users"
              title="No user activity"
              description="Signed-in symptom views will appear here."
            />
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {engagementData && (
          <LeastViewedCard insights={engagementData.insights} hideAgeBands={hideAgeBands} />
        )}
        {engagementData && (
          <BusiestTimesCard
            byWeekday={engagementData.insights.byWeekday}
            byHour={engagementData.insights.byHour}
          />
        )}
      </div>

      {/* Surgery Breakdown - Only for Superusers */}
      {isSuperuser &&
        engagementData?.surgeryBreakdown &&
        engagementData.surgeryBreakdown.length > 0 && (
          <Card elevation="flat" padding="lg">
            <h3 className="mb-4 text-lg font-medium text-gray-900">Surgery Breakdown</h3>
            <RankedList
              countClass="text-purple-600"
              barClass="bg-purple-600/10"
              items={engagementData.surgeryBreakdown.map(surgery => ({
                key: surgery.surgeryId,
                label: surgery.surgeryName,
                action: onSelectSurgery ? (
                  <Button
                    variant="link"
                    size="sm"
                    onClick={() => onSelectSurgery(surgery.surgeryId)}
                  >
                    View Details
                  </Button>
                ) : undefined,
                count: surgery.engagementCount,
                unit: 'views',
              }))}
            />
          </Card>
        )}

      {/* Data Info */}
      <AlertBanner variant="info">
        <div>
          <p className="font-medium">About Engagement Analytics</p>
          <p className="mt-1">
            This data shows symptom views and user activity. Data is collected when users view
            symptom pages.
            {session.type === 'surgery'
              ? ' Data is filtered to show only activity for your surgery.'
              : session.type === 'superuser'
                ? ' As a superuser, you can view system-wide data and drill down by surgery using the dropdown above.'
                : ''}
          </p>
        </div>
      </AlertBanner>

      {/* Export Modal */}
      <Dialog
        open={showExportModal}
        onClose={() => setShowExportModal(false)}
        title="Export Engagement Data"
        description="Downloads the data currently shown — summary totals, top lists, least viewed symptoms and the daily trend — as a CSV file."
        width="md"
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setShowExportModal(false)}>
              Cancel
            </Button>
            <Button variant="success" onClick={handleExport}>
              Export CSV
            </Button>
          </div>
        }
      >
        <p className="text-sm text-gray-600">
          The export reflects the selected date range ({RANGE_LABELS[dateRange]}) and result limit
          (Top {limit}).
        </p>
      </Dialog>
    </div>
  )
}
