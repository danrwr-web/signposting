'use client'

import Link from 'next/link'
import MarketingHeader from '@/components/marketing/MarketingHeader'
import MarketingFooter from '@/components/marketing/MarketingFooter'

function CheckIcon() {
  return (
    <svg className="w-5 h-5 text-nhs-blue mr-3 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  )
}

function WarningIcon() {
  return (
    <svg className="w-5 h-5 text-nhs-blue mr-3 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  )
}

export default function WhySignpostingToolkitClient() {
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
              Why choose the{' '}
              <span className="text-gradient-blue">Signposting Toolkit?</span>
            </h1>
            <p className="text-xl text-gray-600 mt-6 max-w-3xl mx-auto leading-relaxed">
              The Signposting Toolkit is built by practising GPs to support safer, clearer care navigation for reception and care navigation teams. Here&apos;s how it&apos;s different from generic symptom lists and basic signposting tools.
            </p>
            <div className="mt-10">
              <Link
                href="/demo-request"
                className="inline-flex items-center px-10 py-4 text-lg font-semibold rounded-lg text-white bg-nhs-blue hover:bg-nhs-dark-blue focus:outline-none focus:ring-2 focus:ring-nhs-blue focus:ring-offset-2 transition-all shadow-md hover:shadow-lg"
              >
                Request a demo
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Built for real GP workflows */}
      <section className="py-20 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-8">
            Built for real GP workflows
          </h2>
          <ul className="space-y-5 text-lg text-gray-700">
            <li className="flex items-start">
              <CheckIcon />
              <span>Developed and used in a real NHS GP surgery</span>
            </li>
            <li className="flex items-start">
              <CheckIcon />
              <span>Designed around day-to-day reception and care navigation work</span>
            </li>
            <li className="flex items-start">
              <CheckIcon />
              <span>Focused on safe delegation and continuity, not just &ldquo;deflection&rdquo;</span>
            </li>
          </ul>
        </div>
      </section>

      {/* Local clinical governance and customisation */}
      <section className="py-20 bg-gradient-to-b from-gray-50 to-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-8">
            Local clinical governance and customisation
          </h2>
          <div className="space-y-5 text-lg text-gray-700">
            <p>
              Every instruction can be edited locally. Each surgery (or PCN) can align the toolkit with its own pathways. The practice keeps full ownership and sign-off of the content.
            </p>
            <ul className="space-y-4 ml-1">
              <li className="flex items-start">
                <div className="w-1.5 h-1.5 rounded-full bg-nhs-blue mt-2.5 mr-4 flex-shrink-0" />
                <span>Full local control over all symptom instructions</span>
              </li>
              <li className="flex items-start">
                <div className="w-1.5 h-1.5 rounded-full bg-nhs-blue mt-2.5 mr-4 flex-shrink-0" />
                <span>Customise pathways to match your local services</span>
              </li>
              <li className="flex items-start">
                <div className="w-1.5 h-1.5 rounded-full bg-nhs-blue mt-2.5 mr-4 flex-shrink-0" />
                <span>Clinical sign-off required before any changes go live</span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* Safety-first design */}
      <section className="py-20 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-8">
            Safety-first design
          </h2>
          <div className="space-y-5 text-lg text-gray-700">
            <p>
              The Signposting Toolkit is designed to support safe decision-making, not replace clinical judgement.
            </p>
            <ul className="space-y-4">
              <li className="flex items-start">
                <WarningIcon />
                <span>High-risk symptoms are clearly flagged</span>
              </li>
              <li className="flex items-start">
                <WarningIcon />
                <span>Clear &ldquo;stop and check&rdquo; points built into the workflow</span>
              </li>
              <li className="flex items-start">
                <WarningIcon />
                <span>The toolkit supports reception teams; it doesn&apos;t make clinical decisions</span>
              </li>
              <li className="flex items-start">
                <WarningIcon />
                <span>Optional AI tools can help improve clarity of wording — any draft content must be reviewed locally before use</span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* Designed for reception and care navigation teams */}
      <section className="py-20 bg-gradient-to-b from-gray-50 to-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-8">
            Designed for reception and care navigation teams
          </h2>
          <div className="space-y-5 text-lg text-gray-700">
            <p>
              The toolkit is built specifically for non-clinical staff who need clear, consistent guidance they can use confidently.
            </p>
            <ul className="space-y-4">
              <li className="flex items-start">
                <CheckIcon />
                <span>Plain-English instructions that anyone can follow</span>
              </li>
              <li className="flex items-start">
                <CheckIcon />
                <span>Colour-coded urgency cues for quick visual scanning</span>
              </li>
              <li className="flex items-start">
                <CheckIcon />
                <span>Consistent layout across symptoms for faster navigation</span>
              </li>
              <li className="flex items-start">
                <CheckIcon />
                <span>Faster onboarding for new team members</span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* Ready for multi-surgery use */}
      <section className="py-20 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-8">
            Ready for multi-surgery use
          </h2>
          <div className="space-y-5 text-lg text-gray-700">
            <p>
              The toolkit supports practices working together, whether as part of a PCN or across multiple sites.
            </p>
            <ul className="space-y-4">
              <li className="flex items-start">
                <CheckIcon />
                <span>Works across practices or a PCN</span>
              </li>
              <li className="flex items-start">
                <CheckIcon />
                <span>Each site can have its own local variants</span>
              </li>
              <li className="flex items-start">
                <CheckIcon />
                <span>Shared governance with clear accountability</span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* Audit and improvement */}
      <section className="py-20 bg-gradient-to-b from-gray-50 to-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-8">
            Audit and improvement
          </h2>
          <div className="space-y-5 text-lg text-gray-700">
            <p>
              The toolkit provides visibility into how it&apos;s being used, helping practices improve their care navigation over time.
            </p>
            <ul className="space-y-4">
              <li className="flex items-start">
                <CheckIcon />
                <span>Activity is logged (what&apos;s viewed/clicked)</span>
              </li>
              <li className="flex items-start">
                <CheckIcon />
                <span>Content can be reviewed and updated over time</span>
              </li>
              <li className="flex items-start">
                <CheckIcon />
                <span>Practices can see how the toolkit is being used</span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* Closing CTA */}
      <section className="bg-gradient-to-r from-nhs-dark-blue to-nhs-blue py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-white mb-4">
              See how it could work in your surgery
            </h2>
            <p className="text-lg text-blue-100 mb-10 max-w-2xl mx-auto">
              Book a demo to see the Signposting Toolkit in action and discuss how it could support your reception and care navigation teams.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Link
                href="/demo-request"
                className="inline-flex items-center px-10 py-4 text-lg font-semibold rounded-lg text-nhs-dark-blue bg-white hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-nhs-dark-blue transition-all shadow-md"
              >
                Request a demo
              </Link>
              <Link
                href="/"
                className="inline-flex items-center px-10 py-4 text-lg font-medium rounded-lg text-white border-2 border-white/30 hover:border-white/60 hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-nhs-dark-blue transition-colors"
              >
                Back to homepage
              </Link>
            </div>
          </div>
        </div>
      </section>

      <MarketingFooter />
    </div>
  )
}
