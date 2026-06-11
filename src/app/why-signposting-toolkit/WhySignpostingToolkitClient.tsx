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

export default function WhySignpostingToolkitClient() {
  const appBaseUrl =
    process.env.NEXT_PUBLIC_APP_BASE_URL?.replace(/\/$/, '') ||
    (process.env.NODE_ENV === 'development' ? '' : 'https://app.signpostingtool.co.uk')
  const appEntryUrl = appBaseUrl || '/'

  return (
    <div className="min-h-screen bg-white">
      <MarketingHeader appEntryUrl={appEntryUrl} />

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-slate-50 py-20">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(0,94,184,0.04)_1px,transparent_0)] bg-[length:32px_32px]" />
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl font-bold text-gray-900 sm:text-5xl md:text-6xl leading-tight tracking-tight mb-6">
              Why choose the{' '}
              <span className="text-nhs-blue">Signposting Toolkit?</span>
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
          <h2 className="text-3xl font-bold text-gray-900 mb-6">
            Built for real GP workflows
          </h2>
          <div className="space-y-5 text-lg text-gray-700">
            <p>
              The toolkit wasn&apos;t designed in the abstract. It was built at Ide Lane Surgery in Exeter and refined through daily use by the reception team there, around the realities of phone queues, walk-ins, and the judgement calls reception staff make every hour.
            </p>
            <p>
              That shapes its priorities: safe delegation and continuity of care, not just &ldquo;deflection&rdquo; of demand away from GPs.
            </p>
          </div>
        </div>
      </section>

      {/* Local clinical governance and customisation */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-6">
            Local clinical governance and customisation
          </h2>
          <div className="space-y-5 text-lg text-gray-700">
            <p>
              Every instruction can be edited locally, so each surgery (or PCN) can align the toolkit with its own pathways and services. Changes go through a built-in clinical review workflow: nothing goes live to your team without local clinical sign-off, and every approval is recorded in an audit trail.
            </p>
            <p>
              The practice keeps full ownership of its content — the toolkit provides the structure, your clinicians provide the authority.
            </p>
          </div>
        </div>
      </section>

      {/* Safety-first design */}
      <section className="py-20 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-6">
            Safety-first design
          </h2>
          <div className="space-y-5 text-lg text-gray-700">
            <p>
              The toolkit supports safe decision-making by reception teams; it doesn&apos;t make clinical decisions. High-risk symptoms are prominently flagged with colour-coded warnings, and instructions include explicit &ldquo;stop and check&rdquo; points — for example, when to advise calling 999 before any routine booking steps.
            </p>
            <p>
              Optional AI tools can help improve the clarity of wording, but any draft content they produce must be reviewed and approved locally before staff ever see it. These tools can also be switched off entirely at practice level.
            </p>
          </div>
        </div>
      </section>

      {/* Designed for reception and care navigation teams */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-6">
            Designed for reception and care navigation teams
          </h2>
          <div className="space-y-5 text-lg text-gray-700">
            <p>
              The toolkit is written for non-clinical staff. Instructions are in plain English with colour-coded urgency cues, and every symptom follows the same layout — including separate guidance for under-5s, over-5s, and adults where age changes the right course of action.
            </p>
            <p>
              Because the wording and layout are consistent, new and temporary staff get up to speed quickly: they learn the pattern once and it applies everywhere.
            </p>
          </div>
        </div>
      </section>

      {/* Ready for multi-surgery use */}
      <section className="py-20 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-6">
            Ready for multi-surgery use
          </h2>
          <div className="space-y-5 text-lg text-gray-700">
            <p>
              The toolkit supports practices working together, whether as part of a PCN or across multiple sites.
            </p>
            <ul className="space-y-4">
              <li className="flex items-start">
                <CheckIcon />
                <span>Each site can keep its own local variants of shared guidance</span>
              </li>
              <li className="flex items-start">
                <CheckIcon />
                <span>Role-based access keeps editing, approval, and day-to-day use separate</span>
              </li>
              <li className="flex items-start">
                <CheckIcon />
                <span>Shared governance with clear accountability for who approved what, and when</span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* Audit and improvement */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-6">
            Audit and improvement
          </h2>
          <div className="space-y-5 text-lg text-gray-700">
            <p>
              Usage is logged, so practices can see which symptoms are looked up most, spot gaps in their guidance, and evidence how signposting decisions are supported. Content carries review dates, making it straightforward to keep guidance current rather than letting it quietly go stale.
            </p>
          </div>
        </div>
      </section>

      {/* Closing CTA */}
      <section className="bg-nhs-dark-blue py-20">
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
