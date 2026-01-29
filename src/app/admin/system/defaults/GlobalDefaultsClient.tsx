'use client'

import Link from 'next/link'
import SimpleHeader from '@/components/SimpleHeader'

interface GlobalDefaultsClientProps {
  globalDefaults: {
    recentChangesWindowDays: number
  }
}

export default function GlobalDefaultsClient({
  globalDefaults,
}: GlobalDefaultsClientProps) {
  return (
    <div className="min-h-screen bg-nhs-light-grey">
      <SimpleHeader surgeries={[]} currentSurgeryId={undefined} />
      
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page header */}
        <div className="mb-8">
          <nav className="text-sm text-nhs-grey mb-2">
            <Link href="/admin" className="hover:text-nhs-blue">
              Settings
            </Link>
            <span className="mx-2">/</span>
            <Link href="/admin/system" className="hover:text-nhs-blue">
              System management
            </Link>
            <span className="mx-2">/</span>
            <span>Global defaults</span>
          </nav>
          <h1 className="text-3xl font-bold text-nhs-dark-blue">
            Global defaults
          </h1>
          <p className="text-nhs-grey mt-2">
            System-wide default settings that apply to all surgeries unless overridden at the surgery level.
          </p>
        </div>

        {/* Defaults section */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-nhs-dark-blue mb-4">
            Current defaults
          </h2>

          <div className="space-y-6">
            {/* Recent changes window */}
            <div className="border-b border-gray-100 pb-6">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-base font-medium text-nhs-dark-blue">
                    Recent changes window
                  </h3>
                  <p className="text-sm text-nhs-grey mt-1">
                    Default number of days to show in &quot;What&apos;s changed&quot; feeds across all modules.
                    Surgeries can set their own baselines to override this window.
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-semibold text-nhs-blue">
                    {globalDefaults.recentChangesWindowDays}
                  </span>
                  <span className="text-sm text-nhs-grey ml-1">days</span>
                </div>
              </div>
            </div>

            {/* Future defaults placeholder */}
            <div className="text-sm text-nhs-grey">
              <p>
                Additional global defaults will be configurable here as the platform evolves.
                Current defaults are system-wide and apply consistently across all surgeries.
              </p>
            </div>
          </div>
        </div>

        {/* Info panel */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-nhs-blue flex-shrink-0 mt-0.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
            </svg>
            <div>
              <h3 className="text-sm font-medium text-nhs-dark-blue">
                About global defaults
              </h3>
              <p className="text-sm text-nhs-grey mt-1">
                These values provide sensible starting points for all surgeries. Individual surgeries can
                configure their own settings through Surgery Management or their admin panels.
                Changes to global defaults will not affect surgeries that have already customised their settings.
              </p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <div className="mt-8 flex gap-4">
          <Link
            href="/admin/system"
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-nhs-grey hover:bg-gray-50 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 mr-2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
            Back to System management
          </Link>
          <Link
            href="/admin/system/changes"
            className="inline-flex items-center px-4 py-2 bg-nhs-blue text-white rounded-md text-sm font-medium hover:bg-nhs-dark-blue transition-colors"
          >
            Configure change awareness
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 ml-2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
            </svg>
          </Link>
        </div>
      </main>
    </div>
  )
}
