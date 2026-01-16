import 'server-only'

import Link from 'next/link'
import { addDaysUtc, AdminToolkitPinnedPanel } from '@/server/adminToolkit'

interface AdminToolkitPinnedPanelProps {
  surgeryId: string
  canWrite: boolean
  onTakeWeekCommencingUtc: Date
  onTakeGpName: string | null
  panel: AdminToolkitPinnedPanel
  variant?: 'fixed' | 'inline'
}

function formatDateNoWeekday(date: Date): string {
  return date.toLocaleDateString('en-GB', { timeZone: 'Europe/London', day: 'numeric', month: 'long', year: 'numeric' })
}

export default function AdminToolkitPinnedPanel({
  surgeryId,
  canWrite,
  onTakeWeekCommencingUtc,
  onTakeGpName,
  panel,
  variant = 'fixed',
}: AdminToolkitPinnedPanelProps) {
  const weekEndUtc = addDaysUtc(onTakeWeekCommencingUtc, 6)

  const outerClassName =
    variant === 'fixed'
      ? 'sticky bottom-0 z-10 border-t border-gray-200 bg-white shadow-sm'
      : 'mt-8 border-t border-gray-200 bg-white'

  return (
    <div className={outerClassName}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="divide-y divide-gray-200 md:divide-y-0 md:divide-x md:flex">
            <section className="p-4 md:flex-1">
              <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">On-take GP</div>
              <div className="mt-1">
                {onTakeGpName ? (
                  <div className="text-base font-semibold text-gray-900">{onTakeGpName}</div>
                ) : (
                  <div className="text-base font-semibold text-gray-400">Not set</div>
                )}
                <div className="mt-1 text-xs text-gray-500">
                  Week of Monday {formatDateNoWeekday(onTakeWeekCommencingUtc)} to Sunday {formatDateNoWeekday(weekEndUtc)}
                </div>
              </div>
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

            <section className="p-4 md:flex-1">
              <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">Task buddy system</div>
              <div className="mt-2 text-sm text-gray-800 whitespace-pre-wrap">
                {panel.taskBuddyText?.trim() ? panel.taskBuddyText : <span className="text-gray-400">Not set</span>}
              </div>
            </section>

            <section className="p-4 md:flex-1">
              <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">Post route</div>
              <div className="mt-2 text-sm text-gray-800 whitespace-pre-wrap">
                {panel.postRouteText?.trim() ? panel.postRouteText : <span className="text-gray-400">Not set</span>}
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}

