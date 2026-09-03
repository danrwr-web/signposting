'use client'

import Image from 'next/image'
import Link from 'next/link'
import MarketingFooter from '@/components/marketing/MarketingFooter'
import MarketingHeader from '@/components/marketing/MarketingHeader'

const modules = [
  {
    number: '01',
    title: 'Signposting Toolkit',
    description:
      'Search more than 200 symptom topics and follow clear, age-aware guidance shaped around your local services.',
    details: ['High-risk cues', 'Local wording and pathways', 'Clinical review dates'],
  },
  {
    number: '02',
    title: 'Appointment Directory',
    description:
      'Keep appointment types, teams and booking notes in one searchable directory for reception and care navigation staff.',
    details: ['Local appointment types', 'Booking notes and images', 'CSV import'],
  },
  {
    number: '03',
    title: 'Workflow Guidance',
    description:
      'Turn complicated administrative processes into visual, step-by-step guidance that staff can follow while they work.',
    details: ['Branching workflows', 'Practice-owned content', 'Controlled editing'],
  },
  {
    number: '04',
    title: 'Practice Handbook',
    description:
      'Give the team a searchable home for local policies, everyday processes, quick links and on-call information.',
    details: ['Pages and categories', 'Quick Access', 'Roles and permissions'],
  },
]

function CheckIcon() {
  return (
    <svg className="mt-0.5 h-5 w-5 flex-none text-nhs-blue" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M16.704 5.29a1 1 0 010 1.414l-7.5 7.5a1 1 0 01-1.414 0l-3.5-3.5A1 1 0 015.704 9.29l2.793 2.793 6.793-6.793a1 1 0 011.414 0z"
        clipRule="evenodd"
      />
    </svg>
  )
}

export default function LandingPageClient() {
  const appBaseUrl =
    process.env.NEXT_PUBLIC_APP_BASE_URL?.replace(/\/$/, '') ||
    (process.env.NODE_ENV === 'development' ? '' : 'https://app.signpostingtool.co.uk')
  const appEntryUrl = appBaseUrl || '/'

  return (
    <div className="min-h-screen bg-white">
      <MarketingHeader appEntryUrl={appEntryUrl} />

      <main>
        <section className="border-b border-gray-200 bg-slate-50 py-14 sm:py-20 lg:py-24">
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({
                '@context': 'https://schema.org',
                '@type': 'SoftwareApplication',
                name: 'Signposting Toolkit',
                applicationCategory: 'HealthcareApplication',
                operatingSystem: 'Web',
                description:
                  'A locally governed practice support platform for symptom guidance, appointment information, administrative workflows and practice handbooks.',
                url: 'https://www.signpostingtool.co.uk',
              }),
            }}
          />
          <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:px-8">
            <div>
              <p className="mb-5 text-sm font-semibold uppercase tracking-[0.16em] text-nhs-blue">
                For UK general practice teams
              </p>
              <h1 className="max-w-2xl text-4xl font-bold leading-[1.08] tracking-tight text-gray-950 sm:text-5xl lg:text-6xl">
                One reliable place for your practice team to check what happens next.
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-8 text-gray-600 sm:text-xl">
                Bring symptom guidance, appointment information, administrative workflows and your Practice Handbook into one web app—adapted to your surgery and governed locally.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/demo-request"
                  className="inline-flex items-center justify-center rounded-md bg-nhs-blue px-6 py-3.5 text-base font-semibold text-white shadow-sm transition-colors hover:bg-nhs-dark-blue focus:outline-none focus:ring-2 focus:ring-nhs-blue focus:ring-offset-2"
                >
                  Book a demo
                </Link>
                <a
                  href="#walkthrough"
                  className="inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-6 py-3.5 text-base font-semibold text-gray-800 transition-colors hover:border-gray-400 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-nhs-blue focus:ring-offset-2"
                >
                  Watch the one-minute walkthrough
                </a>
              </div>
              <p className="mt-5 text-sm leading-6 text-gray-500">
                Created and used at Ide Lane Surgery in Exeter. No patient-identifiable data is required.
              </p>
            </div>

            <div className="relative lg:pl-4">
              <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl shadow-slate-900/10">
                <Image
                  src="/images/symptom-page.png"
                  alt="The Signposting Toolkit showing structured symptom guidance"
                  width={895}
                  height={620}
                  className="h-auto w-full"
                  priority
                />
              </div>
              <p className="mt-3 text-right text-xs text-gray-500">A live symptom page in the platform</p>
            </div>
          </div>
        </section>

        <section aria-label="Platform facts" className="border-b border-gray-200 bg-white">
          <div className="mx-auto grid max-w-7xl divide-y divide-gray-200 px-4 sm:grid-cols-3 sm:divide-x sm:divide-y-0 sm:px-6 lg:px-8">
            <div className="py-5 sm:pr-8">
              <p className="text-sm text-gray-600"><strong className="font-semibold text-gray-950">200+ symptom topics</strong> ready to review and adapt</p>
            </div>
            <div className="py-5 sm:px-8">
              <p className="text-sm text-gray-600"><strong className="font-semibold text-gray-950">One browser-based system</strong> for the whole practice team</p>
            </div>
            <div className="py-5 sm:pl-8">
              <p className="text-sm text-gray-600"><strong className="font-semibold text-gray-950">Local ownership</strong> with roles, reviews and audit history</p>
            </div>
          </div>
        </section>

        <section className="py-16 sm:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl">
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-nhs-blue">The platform</p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight text-gray-950 sm:text-4xl">
                Four practical tools. One familiar way of working.
              </h2>
              <p className="mt-5 text-lg leading-8 text-gray-600">
                Staff can move between the information they need without learning a different system for every task.
              </p>
            </div>

            <div className="mt-12 grid border-y border-gray-200 md:grid-cols-2">
              {modules.map((module, index) => (
                <article
                  key={module.title}
                  className={`py-8 md:p-10 ${index % 2 === 0 ? 'md:border-r md:border-gray-200' : ''} ${index < 2 ? 'border-b border-gray-200' : index === 2 ? 'border-b border-gray-200 md:border-b-0' : ''}`}
                >
                  <p className="text-sm font-semibold tabular-nums text-nhs-blue">{module.number}</p>
                  <h3 className="mt-3 text-2xl font-semibold text-gray-950">{module.title}</h3>
                  <p className="mt-3 max-w-xl leading-7 text-gray-600">{module.description}</p>
                  <ul className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm text-gray-600">
                    {module.details.map((detail) => (
                      <li key={detail} className="flex items-center gap-2">
                        <span className="h-1.5 w-1.5 rounded-full bg-nhs-blue" aria-hidden="true" />
                        {detail}
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
            <Link href="/inside-the-platform" className="mt-8 inline-flex font-semibold text-nhs-blue underline underline-offset-4 hover:text-nhs-dark-blue">
              See inside the platform
            </Link>
          </div>
        </section>

        <section id="walkthrough" className="scroll-mt-24 border-y border-gray-200 bg-slate-50 py-16 sm:py-24">
          <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 sm:px-6 lg:grid-cols-[0.72fr_1.28fr] lg:px-8">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-nhs-blue">See it in use</p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight text-gray-950 sm:text-4xl">
                Clear enough for a busy front desk.
              </h2>
              <p className="mt-5 text-lg leading-8 text-gray-600">
                The interface puts the instruction, local context and next step close together. This short walkthrough shows the core symptom-search journey.
              </p>
            </div>
            <div className="aspect-video overflow-hidden rounded-xl border border-gray-200 bg-black shadow-lg">
              <iframe
                src="https://www.youtube-nocookie.com/embed/-IIpq9X9n9Y?rel=0&modestbranding=1&controls=1&playsinline=1"
                className="h-full w-full"
                title="One-minute Signposting Toolkit walkthrough"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                loading="lazy"
                allowFullScreen
              />
            </div>
          </div>
        </section>

        <section id="governance" className="scroll-mt-24 py-16 sm:py-24">
          <div className="mx-auto grid max-w-7xl gap-12 px-4 sm:px-6 lg:grid-cols-2 lg:px-8">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-nhs-blue">Local governance</p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight text-gray-950 sm:text-4xl">
                Your practice remains responsible for what staff see.
              </h2>
              <p className="mt-5 text-lg leading-8 text-gray-600">
                Shared content gives you a starting point. Local teams decide how it should read, who can change it and when it needs another review.
              </p>
              <p className="mt-5 leading-7 text-gray-600">
                The toolkit supports staff with information and process guidance. It does not diagnose patients or replace clinical judgement.
              </p>
            </div>

            <div className="border-l-4 border-nhs-blue bg-slate-50 p-7 sm:p-9">
              <ul className="space-y-5">
                {[
                  'Clinical review dates and local sign-off for symptom guidance',
                  'Role-based access for everyday users, editors and administrators',
                  'Staff suggestions and feedback with visible status tracking',
                  'Usage reporting and CSV exports for authorised administrators',
                ].map((item) => (
                  <li key={item} className="flex gap-3 leading-7 text-gray-700">
                    <CheckIcon />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-7 border-t border-gray-200 pt-6 text-sm leading-6 text-gray-600">
                Optional clarity tools can help administrators draft wording or suggested questions. They can be switched off, and generated content must be reviewed locally before use.
              </p>
            </div>
          </div>
        </section>

        <section className="border-y border-gray-200 bg-slate-50 py-16 sm:py-20">
          <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
            <figure className="border-l-4 border-nhs-green pl-6 sm:pl-9">
              <blockquote className="text-xl leading-9 text-gray-800 sm:text-2xl">
                “This signposting tool is easy for receptionists/care navigators to use and gives clear guidance on how to direct patients appropriately. The visuals have been tailored to allow users to find the condition they require quickly.”
              </blockquote>
              <figcaption className="mt-6">
                <p className="font-semibold text-gray-950">Emma Gregory</p>
                <p className="mt-1 text-sm text-gray-600">PLS Programme Facilitator and former Practice Manager</p>
              </figcaption>
            </figure>
          </div>
        </section>

        <section id="pricing" className="scroll-mt-24 py-16 sm:py-24">
          <div className="mx-auto grid max-w-5xl gap-10 px-4 sm:px-6 lg:grid-cols-[0.8fr_1.2fr] lg:px-8">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-nhs-blue">Early-adopter pricing</p>
              <p className="mt-4 text-4xl font-bold tracking-tight text-gray-950 sm:text-5xl">
                £0.07 <span className="text-lg font-medium text-gray-500">per patient, per year</span>
              </p>
              <p className="mt-4 text-sm leading-6 text-gray-500">
                Availability and module scope are confirmed during your demo.
              </p>
            </div>
            <div>
              <h2 className="text-3xl font-bold tracking-tight text-gray-950">Start with a conversation about your practice.</h2>
              <p className="mt-5 text-lg leading-8 text-gray-600">
                We’ll show you the live platform, talk through your local setup and answer questions about onboarding, governance and current pricing.
              </p>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <Link href="/demo-request" className="inline-flex items-center justify-center rounded-md bg-nhs-blue px-6 py-3.5 font-semibold text-white hover:bg-nhs-dark-blue focus:outline-none focus:ring-2 focus:ring-nhs-blue focus:ring-offset-2">
                  Book a demo
                </Link>
                <Link href={appEntryUrl} className="inline-flex items-center justify-center rounded-md border border-gray-300 px-6 py-3.5 font-semibold text-gray-800 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-nhs-blue focus:ring-offset-2">
                  Customer login
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <MarketingFooter />
    </div>
  )
}
