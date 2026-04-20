'use client'

import { Fragment, useMemo, useState } from 'react'
import Link from 'next/link'
import SimpleHeader from '@/components/SimpleHeader'
import { Badge, Card, Input } from '@/components/ui'
import type { SetupFlag } from '@/server/surgerySetupFlags'

export type TrackerRow = {
  id: string
  name: string
  createdAt: string
  stage: 'not_started' | 'in_progress' | 'nearly_there' | 'live'
  essentialCount: number
  essentialTotal: number
  recommendedCount: number
  recommendedTotal: number
  flags: SetupFlag[]
  lastActivityAt: string | null
  daysSinceCreated: number
  daysSinceLastActivity: number | null
  goLiveDate: string | null
  features: string[]
  onboardingCompleted: boolean
  onboardingStarted: boolean
}

interface SetupTrackerClientProps {
  rows: TrackerRow[]
  windowDays: number
  generatedAt: string
}

const STAGE_LABEL: Record<TrackerRow['stage'], string> = {
  not_started: 'Not started',
  in_progress: 'In progress',
  nearly_there: 'Nearly there',
  live: 'Live',
}

const STAGE_COLOR: Record<TrackerRow['stage'], 'gray' | 'amber' | 'blue' | 'green'> = {
  not_started: 'gray',
  in_progress: 'amber',
  nearly_there: 'blue',
  live: 'green',
}

const ALL_STAGES: TrackerRow['stage'][] = ['not_started', 'in_progress', 'nearly_there', 'live']

type SortKey = 'flags' | 'name' | 'stage' | 'created' | 'lastActivity' | 'essential'

function relativeDays(days: number | null): string {
  if (days === null) return 'No activity'
  if (days === 0) return 'Today'
  if (days === 1) return '1 day ago'
  return `${days} days ago`
}

function ProgressBar({ count, total, critical = false }: { count: number; total: number; critical?: boolean }) {
  const pct = total === 0 ? 0 : Math.round((count / total) * 100)
  const complete = count === total
  const bar = complete
    ? 'bg-green-500'
    : critical
      ? 'bg-red-500'
      : count > 0
        ? 'bg-nhs-blue'
        : 'bg-gray-300'
  return (
    <div className="flex items-center gap-2 min-w-[100px]">
      <span className="text-xs text-nhs-grey tabular-nums w-8">
        {count}/{total}
      </span>
      <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
        <div className={`h-full ${bar}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function countCritical(flags: SetupFlag[]): number {
  return flags.filter(f => f.severity === 'critical').length
}

export default function SetupTrackerClient({ rows, windowDays, generatedAt }: SetupTrackerClientProps) {
  const [search, setSearch] = useState('')
  const [selectedStages, setSelectedStages] = useState<Set<TrackerRow['stage']>>(new Set(ALL_STAGES))
  const [onlyFlagged, setOnlyFlagged] = useState(false)
  const [onlyCritical, setOnlyCritical] = useState(false)
  const [sortKey, setSortKey] = useState<SortKey>('flags')
  const [sortDesc, setSortDesc] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const totals = useMemo(() => {
    return {
      total: rows.length,
      notStarted: rows.filter(r => r.stage === 'not_started').length,
      inProgress: rows.filter(r => r.stage === 'in_progress').length,
      nearlyThere: rows.filter(r => r.stage === 'nearly_there').length,
      live: rows.filter(r => r.stage === 'live').length,
      withFlags: rows.filter(r => r.flags.length > 0).length,
      withCritical: rows.filter(r => countCritical(r.flags) > 0).length,
    }
  }, [rows])

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return rows.filter(r => {
      if (needle && !r.name.toLowerCase().includes(needle)) return false
      if (!selectedStages.has(r.stage)) return false
      if (onlyFlagged && r.flags.length === 0) return false
      if (onlyCritical && countCritical(r.flags) === 0) return false
      return true
    })
  }, [rows, search, selectedStages, onlyFlagged, onlyCritical])

  const sorted = useMemo(() => {
    const copy = [...filtered]
    copy.sort((a, b) => {
      let cmp = 0
      switch (sortKey) {
        case 'flags': {
          const ac = countCritical(a.flags)
          const bc = countCritical(b.flags)
          if (ac !== bc) cmp = ac - bc
          else cmp = a.flags.length - b.flags.length
          if (cmp === 0) cmp = a.daysSinceCreated - b.daysSinceCreated
          break
        }
        case 'name':
          cmp = a.name.localeCompare(b.name)
          break
        case 'stage':
          cmp = ALL_STAGES.indexOf(a.stage) - ALL_STAGES.indexOf(b.stage)
          break
        case 'created':
          cmp = a.daysSinceCreated - b.daysSinceCreated
          break
        case 'lastActivity': {
          const av = a.daysSinceLastActivity ?? Number.MAX_SAFE_INTEGER
          const bv = b.daysSinceLastActivity ?? Number.MAX_SAFE_INTEGER
          cmp = av - bv
          break
        }
        case 'essential':
          cmp = a.essentialCount / a.essentialTotal - b.essentialCount / b.essentialTotal
          break
      }
      return sortDesc ? -cmp : cmp
    })
    return copy
  }, [filtered, sortKey, sortDesc])

  function toggleStage(stage: TrackerRow['stage']) {
    const next = new Set(selectedStages)
    if (next.has(stage)) next.delete(stage)
    else next.add(stage)
    setSelectedStages(next)
  }

  function setSort(key: SortKey) {
    if (sortKey === key) setSortDesc(d => !d)
    else {
      setSortKey(key)
      setSortDesc(key === 'flags' || key === 'created')
    }
  }

  const sortIndicator = (key: SortKey) => (sortKey !== key ? '' : sortDesc ? ' ↓' : ' ↑')

  return (
    <div className="min-h-screen bg-nhs-light-grey">
      <SimpleHeader surgeries={[]} currentSurgeryId={undefined} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <Link href="/admin/system" className="text-sm text-nhs-blue hover:underline">
            ← Back to system management
          </Link>
        </div>

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-nhs-dark-blue">Surgery setup tracker</h1>
          <p className="text-nhs-grey mt-2">
            Track onboarding progress across every surgery and surface surgeries that may be stuck or need a nudge.
            Activity window is {windowDays} days. Last updated {new Date(generatedAt).toLocaleString('en-GB')}.
          </p>
        </div>

        {/* Summary strip */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
          <Card padding="md"><div className="text-xs uppercase text-nhs-grey">Total</div><div className="text-2xl font-semibold text-nhs-dark-blue">{totals.total}</div></Card>
          <Card padding="md"><div className="text-xs uppercase text-nhs-grey">Not started</div><div className="text-2xl font-semibold text-gray-700">{totals.notStarted}</div></Card>
          <Card padding="md"><div className="text-xs uppercase text-nhs-grey">In progress</div><div className="text-2xl font-semibold text-amber-700">{totals.inProgress}</div></Card>
          <Card padding="md"><div className="text-xs uppercase text-nhs-grey">Nearly there</div><div className="text-2xl font-semibold text-nhs-blue">{totals.nearlyThere}</div></Card>
          <Card padding="md"><div className="text-xs uppercase text-nhs-grey">Live</div><div className="text-2xl font-semibold text-green-700">{totals.live}</div></Card>
        </div>

        {totals.withCritical > 0 && (
          <button
            onClick={() => setOnlyCritical(v => !v)}
            className={`inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium mb-4 transition-colors ${
              onlyCritical
                ? 'bg-red-600 text-white'
                : 'bg-red-100 text-red-800 hover:bg-red-200'
            }`}
          >
            <span>⚠</span>
            {totals.withCritical} {totals.withCritical === 1 ? 'surgery' : 'surgeries'} with critical flags
            {onlyCritical ? ' (filtering)' : ' — click to filter'}
          </button>
        )}

        {/* Filter bar */}
        <Card padding="md" className="mb-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-[200px]">
              <Input
                type="search"
                placeholder="Search surgeries…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {ALL_STAGES.map(stage => {
                const active = selectedStages.has(stage)
                return (
                  <button
                    key={stage}
                    onClick={() => toggleStage(stage)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                      active
                        ? 'bg-nhs-blue text-white border-nhs-blue'
                        : 'bg-white text-nhs-grey border-gray-300 hover:border-nhs-blue'
                    }`}
                  >
                    {STAGE_LABEL[stage]}
                  </button>
                )
              })}
            </div>
            <label className="flex items-center gap-2 text-sm text-nhs-grey">
              <input type="checkbox" checked={onlyFlagged} onChange={e => setOnlyFlagged(e.target.checked)} />
              Only flagged
            </label>
            <label className="flex items-center gap-2 text-sm text-nhs-grey">
              <input type="checkbox" checked={onlyCritical} onChange={e => setOnlyCritical(e.target.checked)} />
              Only critical
            </label>
          </div>
        </Card>

        {/* Table */}
        <Card padding="none" className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr className="text-left text-nhs-grey">
                  <th className="px-4 py-3 font-medium cursor-pointer hover:text-nhs-dark-blue" onClick={() => setSort('name')}>Name{sortIndicator('name')}</th>
                  <th className="px-4 py-3 font-medium cursor-pointer hover:text-nhs-dark-blue" onClick={() => setSort('stage')}>Stage{sortIndicator('stage')}</th>
                  <th className="px-4 py-3 font-medium cursor-pointer hover:text-nhs-dark-blue" onClick={() => setSort('essential')}>Essential{sortIndicator('essential')}</th>
                  <th className="px-4 py-3 font-medium">Recommended</th>
                  <th className="px-4 py-3 font-medium cursor-pointer hover:text-nhs-dark-blue" onClick={() => setSort('flags')}>Flags{sortIndicator('flags')}</th>
                  <th className="px-4 py-3 font-medium cursor-pointer hover:text-nhs-dark-blue" onClick={() => setSort('created')}>Age{sortIndicator('created')}</th>
                  <th className="px-4 py-3 font-medium cursor-pointer hover:text-nhs-dark-blue" onClick={() => setSort('lastActivity')}>Last activity{sortIndicator('lastActivity')}</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sorted.length === 0 && (
                  <tr>
                    <td colSpan={8} className="text-center py-12 text-nhs-grey">
                      No surgeries match the current filters.
                    </td>
                  </tr>
                )}
                {sorted.map(row => {
                  const isExpanded = expandedId === row.id
                  const critical = countCritical(row.flags)
                  return (
                    <Fragment key={row.id}>
                      <tr
                        className={`border-b border-gray-100 hover:bg-gray-50 ${isExpanded ? 'bg-blue-50/30' : ''}`}
                      >
                        <td className="px-4 py-3">
                          <button
                            onClick={() => setExpandedId(isExpanded ? null : row.id)}
                            className="text-left font-medium text-nhs-dark-blue hover:text-nhs-blue"
                          >
                            {row.name}
                          </button>
                        </td>
                        <td className="px-4 py-3">
                          <Badge color={STAGE_COLOR[row.stage]}>{STAGE_LABEL[row.stage]}</Badge>
                        </td>
                        <td className="px-4 py-3">
                          <ProgressBar count={row.essentialCount} total={row.essentialTotal} critical />
                        </td>
                        <td className="px-4 py-3">
                          <ProgressBar count={row.recommendedCount} total={row.recommendedTotal} />
                        </td>
                        <td className="px-4 py-3">
                          {row.flags.length === 0 ? (
                            <span className="text-xs text-nhs-grey">—</span>
                          ) : (
                            <button
                              onClick={() => setExpandedId(isExpanded ? null : row.id)}
                              className="inline-flex items-center gap-1.5"
                            >
                              <Badge color={critical > 0 ? 'red' : 'amber'} size="sm">
                                {row.flags.length}
                              </Badge>
                              {critical > 0 && <span className="text-xs text-red-700 font-medium">({critical} critical)</span>}
                            </button>
                          )}
                        </td>
                        <td className="px-4 py-3 text-nhs-grey tabular-nums">{row.daysSinceCreated}d</td>
                        <td className="px-4 py-3 text-nhs-grey">{relativeDays(row.daysSinceLastActivity)}</td>
                        <td className="px-4 py-3 text-right space-x-3 text-xs">
                          <Link href={`/s/${row.id}/admin/setup-checklist`} className="text-nhs-blue hover:underline">
                            Checklist
                          </Link>
                          <Link href={`/s/${row.id}/admin/onboarding`} className="text-nhs-blue hover:underline">
                            Onboarding
                          </Link>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="bg-blue-50/30 border-b border-gray-100">
                          <td colSpan={8} className="px-4 py-4">
                            <ExpandedRow row={row} />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>

        <div className="mt-6 text-xs text-nhs-grey">
          Setup signals come from existing onboarding, users, clinical review, engagement and feature-flag data; no
          schema changes are required. Expand a row above for per-flag detail.
        </div>
      </main>
    </div>
  )
}

function ExpandedRow({ row }: { row: TrackerRow }) {
  return (
    <div className="space-y-3">
      {row.goLiveDate && (
        <div className="text-xs text-nhs-grey">
          Contracted go-live: <span className="font-medium text-nhs-dark-blue">{new Date(row.goLiveDate).toLocaleDateString('en-GB')}</span>
        </div>
      )}
      {row.flags.length === 0 ? (
        <div className="text-sm text-green-700">No flags raised — surgery looks healthy.</div>
      ) : (
        <ul className="space-y-2">
          {row.flags.map(f => (
            <li key={f.code} className="flex items-start gap-3">
              <Badge color={f.severity === 'critical' ? 'red' : 'amber'} size="sm">
                {f.severity === 'critical' ? 'Critical' : 'Warning'}
              </Badge>
              <div className="flex-1">
                <div className="text-sm text-nhs-dark-blue">{f.message}</div>
                <div className="text-xs text-nhs-grey font-mono">{f.code}</div>
              </div>
            </li>
          ))}
        </ul>
      )}
      {row.features.length > 0 && (
        <div className="text-xs text-nhs-grey">
          Features enabled: {row.features.map(f => (
            <Badge key={f} color="blue" size="sm" className="mr-1">{f}</Badge>
          ))}
        </div>
      )}
    </div>
  )
}
