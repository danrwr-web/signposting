import 'server-only'

import Link from 'next/link'
import { addDaysUtc, AdminToolkitPinnedPanel } from '@/server/adminToolkit'

interface AdminToolkitPinnedPanelProps {
  surgeryId: string
  canWrite: boolean
  onTakeWeekCommencingUtc: Date
  onTakeGpName: string | null
  panel: AdminToolkitPinnedPanel
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-GB', { timeZone: 'Europe/London', weekday: 'long', day: 'numeric', month: 'long' })
}

export default function AdminToolkitPinnedPanel({
  surgeryId,
  canWrite,
  onTakeWeekCommencingUtc,
  onTakeGpName,
  panel,
}: AdminToolkitPinnedPanelProps) {
  const weekEndUtc = addDaysUtc(onTakeWeekCommencingUtc, 6)

  return (
    <div className="fixed inset-x-0 bottom-0 border-t border-gray-200 bg-white/95 backdrop-blur-sm">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <section>
              <h2 className="text-sm font-semibold text-nhs-dark-blue">Current On-Take GP</h2>
              <p className="mt-1 text-sm text-nhs-grey">
                {onTakeGpName ? <span className="font-semibold text-gray-900">{onTakeGpName}</span> : 'Not set'}
              </p>
              <p className="mt-1 text-xs text-gray-500">
                Week of Monday {formatDate(onTakeWeekCommencingUtc)} to Sunday {formatDate(weekEndUtc)}
              </p>
              {!onTakeGpName && canWrite ? (
                <div className="mt-2">
                  <Link
                    href={`/s/${surgeryId}/admin-toolkit/admin#on-take`}
                    className="text-sm font-medium text-nhs-blue hover:text-nhs-dark-blue underline-offset-2 hover:underline"
                  >
                    Set on-take GP
                  </Link>
                </div>
              ) : null}
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

