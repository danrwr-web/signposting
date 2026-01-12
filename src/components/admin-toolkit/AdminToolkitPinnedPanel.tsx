import 'server-only'

import { AdminToolkitDutyEntry, AdminToolkitPinnedPanel } from '@/server/adminToolkit'

interface AdminToolkitPinnedPanelProps {
  today: AdminToolkitDutyEntry | null
  week: AdminToolkitDutyEntry[]
  weekStartUtc: Date
  panel: AdminToolkitPinnedPanel
}

function formatDayLabel(date: Date): string {
  return date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
}

export default function AdminToolkitPinnedPanel({ today, week, weekStartUtc, panel }: AdminToolkitPinnedPanelProps) {
  const weekMap = new Map(week.map((e) => [e.date.toISOString(), e.name]))

  return (
    <div className="fixed inset-x-0 bottom-0 border-t border-gray-200 bg-white/95 backdrop-blur-sm">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <section>
              <h2 className="text-sm font-semibold text-nhs-dark-blue">GP taking on</h2>
              <p className="mt-1 text-sm text-nhs-grey">
                {today?.name ? <span className="font-semibold text-gray-900">{today.name}</span> : 'Not set for today'}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {Array.from({ length: 7 }).map((_, idx) => {
                  const d = new Date(weekStartUtc.getTime())
                  d.setUTCDate(d.getUTCDate() + idx)
                  const key = d.toISOString()
                  const name = weekMap.get(key) || ''
                  return (
                    <div
                      key={key}
                      className="rounded-lg border border-gray-200 bg-gray-50 px-2 py-1"
                      title={name ? `${formatDayLabel(d)}: ${name}` : `${formatDayLabel(d)}: not set`}
                    >
                      <span className="text-xs font-medium text-gray-600">{d.toLocaleDateString('en-GB', { weekday: 'short' })}</span>{' '}
                      <span className="text-xs text-gray-900">{name || '—'}</span>
                    </div>
                  )
                })}
              </div>
            </section>

            <section>
              <h2 className="text-sm font-semibold text-nhs-dark-blue">Task buddy system</h2>
              <div className="mt-1 text-sm text-nhs-grey whitespace-pre-wrap">
                {panel.taskBuddyText?.trim() ? panel.taskBuddyText : 'Not set yet.'}
              </div>
            </section>

            <section>
              <h2 className="text-sm font-semibold text-nhs-dark-blue">Post route</h2>
              <div className="mt-1 text-sm text-nhs-grey whitespace-pre-wrap">
                {panel.postRouteText?.trim() ? panel.postRouteText : 'Not set yet.'}
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}

