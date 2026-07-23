/**
 * CSV building + download helpers for the Engagement Analytics export.
 * Client-safe and pure (no server imports) so the export runs entirely from
 * the data already fetched into the page.
 */

import type { EngagementTopRes } from '@/lib/api-contracts'

export interface EngagementCsvMeta {
  /** e.g. "Last 30 days" */
  rangeLabel: string
  /** e.g. "Mount Pleasant Health Centre" or "All surgeries" */
  scopeLabel: string
  generatedAt: Date
}

export function escapeCsvField(value: string | number): string {
  const text = String(value)
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`
  }
  return text
}

function row(...fields: Array<string | number>): string {
  return fields.map(escapeCsvField).join(',')
}

const WEEKDAY_LABELS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

export function buildEngagementCsv(data: EngagementTopRes, meta: EngagementCsvMeta): string {
  const lines: string[] = []

  lines.push(row('Engagement analytics export'))
  lines.push(row('Scope', meta.scopeLabel))
  lines.push(row('Date range', meta.rangeLabel))
  lines.push(row('Generated', meta.generatedAt.toISOString()))
  lines.push('')

  lines.push(row('Summary'))
  lines.push(row('Total symptom views', data.totals.totalViews))
  lines.push(row('Active users', data.totals.distinctUsers))
  lines.push(row('Symptoms accessed', data.totals.distinctSymptoms))
  if (data.totals.activeSurgeries !== null) {
    lines.push(row('Active surgeries', data.totals.activeSurgeries))
  }
  if (data.previousTotals) {
    lines.push(row('Total symptom views (previous period)', data.previousTotals.totalViews))
    lines.push(row('Active users (previous period)', data.previousTotals.distinctUsers))
  }
  lines.push('')

  lines.push(row('Most viewed symptoms'))
  lines.push(row('Rank', 'Symptom', 'Age group', 'Views'))
  data.topSymptoms.forEach((s, i) => {
    lines.push(row(i + 1, s.name, s.ageGroup, s.viewCount))
  })
  lines.push('')

  lines.push(row('Most active users'))
  lines.push(row('Rank', 'User', 'Views'))
  data.topUsers.forEach((u, i) => {
    lines.push(row(i + 1, u.userEmail, u.engagementCount))
  })
  lines.push('')

  if (data.surgeryBreakdown && data.surgeryBreakdown.length > 0) {
    lines.push(row('Surgery breakdown'))
    lines.push(row('Rank', 'Surgery', 'Views'))
    data.surgeryBreakdown.forEach((s, i) => {
      lines.push(row(i + 1, s.surgeryName, s.engagementCount))
    })
    lines.push('')
  }

  lines.push(row('Least viewed symptoms'))
  lines.push(row('Symptom', 'Age group', 'Views'))
  data.insights.leastViewed.forEach(s => {
    lines.push(row(s.name, s.ageGroup, s.viewCount))
  })
  lines.push('')

  lines.push(row('Views by weekday (UK local time)'))
  lines.push(row('Weekday', 'Views'))
  data.insights.byWeekday.forEach((views, i) => {
    lines.push(row(WEEKDAY_LABELS[i] ?? `Day ${i + 1}`, views))
  })
  lines.push('')

  lines.push(row(`Daily views${data.trend.capped ? ' (last 90 days)' : ''}`))
  lines.push(row('Date', 'Views'))
  data.trend.points.forEach(p => {
    lines.push(row(p.date, p.views))
  })

  return lines.join('\n')
}

export function downloadCsv(csvData: string, filename: string): void {
  const blob = new Blob([csvData], { type: 'text/csv' })
  const url = window.URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  window.URL.revokeObjectURL(url)
}
