'use client'

import Image from 'next/image'
import MarketingHeader from '@/components/marketing/MarketingHeader'
import MarketingFooter from '@/components/marketing/MarketingFooter'

export default function InsideThePlatformClient() {
  const appBaseUrl =
    process.env.NEXT_PUBLIC_APP_BASE_URL?.replace(/\/$/, '') ||
    (process.env.NODE_ENV === 'development' ? '' : 'https://app.signpostingtool.co.uk')
  const appEntryUrl = appBaseUrl || '/'

  return (
    <div className="min-h-screen bg-white">
      <MarketingHeader appEntryUrl={appEntryUrl} />

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-b from-slate-50 via-white to-white py-20">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(0,94,184,0.04)_1px,transparent_0)] bg-[length:32px_32px]" />
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl font-bold text-gray-900 sm:text-5xl md:text-6xl leading-tight tracking-tight mb-6">
              Inside the <span className="text-gradient-blue">platform</span>
            </h1>
            <p className="text-xl text-gray-600 mt-6 max-w-3xl mx-auto leading-relaxed">
              The Signposting Toolkit is designed to feel calm, familiar, and predictable for busy practice teams.
              The examples below show how the platform supports day-to-day work without overwhelming staff or replacing human judgement.
            </p>
          </div>
        </div>
      </section>

      {/* Screenshot Section 1 */}
      <section className="py-20 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Clear, structured signposting
            </h2>
            <p className="text-lg text-gray-600 max-w-3xl mx-auto leading-relaxed">
              Reception teams are guided by plain-English instructions, with high-risk cues and age-aware routing built in.
            </p>
          </div>
          <div className="mt-12 flex justify-center">
            <div className="w-full max-w-4xl relative">
              <Image
                src="/images/symptom-page.png"
                alt="Screenshot showing clear, structured signposting with plain-English instructions"
                width={1200}
                height={800}
                className="w-full h-auto rounded-2xl shadow-lg ring-1 ring-gray-200"
                priority={false}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Screenshot Section 2 */}
      <section className="py-20 bg-gradient-to-b from-gray-50 to-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Internal guidance, owned by the practice
            </h2>
            <p className="text-lg text-gray-600 max-w-3xl mx-auto leading-relaxed">
              Local processes and policies live alongside signposting, reducing interruptions and &apos;quick questions&apos; for clinical staff.
            </p>
          </div>
          <div className="mt-12 flex justify-center">
            <div className="w-full max-w-4xl relative">
              <Image
                src="/images/practice-handbook.png"
                alt="Screenshot showing internal guidance and practice policies"
                width={1200}
                height={800}
                className="w-full h-auto rounded-2xl shadow-lg ring-1 ring-gray-200"
                priority={false}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Screenshot Section 3 */}
      <section className="py-20 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Step-by-step workflow support
            </h2>
            <p className="text-lg text-gray-600 max-w-3xl mx-auto leading-relaxed">
              Visual workflows help staff handle complex or high-risk admin tasks consistently and with confidence.
            </p>
          </div>
          <div className="mt-12 flex justify-center">
            <div className="w-full max-w-4xl relative">
              <Image
                src="/images/workflow-guidance.png"
                alt="Screenshot showing step-by-step visual workflow support"
                width={1200}
                height={800}
                className="w-full h-auto rounded-2xl shadow-lg ring-1 ring-gray-200"
                priority={false}
              />
            </div>
          </div>
        </div>
      </section>

      <MarketingFooter />
    </div>
  )
}
