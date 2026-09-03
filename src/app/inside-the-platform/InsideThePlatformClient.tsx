'use client'

import Image from 'next/image'
import Link from 'next/link'
import MarketingFooter from '@/components/marketing/MarketingFooter'
import MarketingHeader from '@/components/marketing/MarketingHeader'

const platformModules = [
  {
    title: 'Signposting Toolkit',
    description: 'Structured, searchable symptom guidance with age variants, high-risk cues and local pathways.',
  },
  {
    title: 'Appointment Directory',
    description: 'A searchable directory of local appointment types, teams, booking notes and supporting images.',
  },
  {
    title: 'Workflow Guidance',
    description: 'Visual, step-by-step guidance for administrative processes that need a consistent approach.',
  },
  {
    title: 'Practice Handbook',
    description: 'Practice policies, everyday processes, Quick Access links and on-call information in one place.',
  },
]

const screenshots = [
  {
    eyebrow: 'Signposting Toolkit',
    title: 'Find the right guidance quickly',
    description:
      'Reception and care navigation teams can search by symptom, choose the relevant age group and work from clear, locally approved instructions.',
    image: '/images/symptom-page.png',
    alt: 'Structured symptom guidance in the Signposting Toolkit',
    width: 895,
    height: 620,
  },
  {
    eyebrow: 'Appointment Directory',
    title: 'Know what can be booked and how',
    description:
      'Search local appointment types, filter by staff team and keep the practical booking detail alongside each entry.',
    image: '/images/appointment-directory.png',
    alt: 'Searchable appointment types in the Appointment Directory',
    width: 1247,
    height: 852,
  },
  {
    eyebrow: 'Practice Handbook',
    title: 'Keep local knowledge close to the work',
    description:
      'Policies, processes, quick links and useful practice information sit in a searchable handbook that the practice team owns.',
    image: '/images/practice-handbook.png',
    alt: 'Local guidance in the Practice Handbook',
    width: 1200,
    height: 800,
  },
  {
    eyebrow: 'Workflow Guidance',
    title: 'Make complex processes easier to follow',
    description:
      'Branching workflows show staff the next step without flattening a real process into an over-simplified checklist.',
    image: '/images/workflow-guidance.png',
    alt: 'A step-by-step workflow in Workflow Guidance',
    width: 1200,
    height: 800,
  },
]

export default function InsideThePlatformClient() {
  const appBaseUrl =
    process.env.NEXT_PUBLIC_APP_BASE_URL?.replace(/\/$/, '') ||
    (process.env.NODE_ENV === 'development' ? '' : 'https://app.signpostingtool.co.uk')
  const appEntryUrl = appBaseUrl || '/'

  return (
    <div className="min-h-screen bg-white">
      <MarketingHeader appEntryUrl={appEntryUrl} />

      <main>
        <section className="border-b border-gray-200 bg-slate-50 py-16 sm:py-24">
          <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-nhs-blue">Inside the platform</p>
            <h1 className="mt-4 max-w-4xl text-4xl font-bold leading-tight tracking-tight text-gray-950 sm:text-5xl lg:text-6xl">
              Built around the questions practice teams answer every day.
            </h1>
            <p className="mt-6 max-w-3xl text-xl leading-8 text-gray-600">
              The platform brings clinical signposting, appointment information and internal practice guidance together without trying to replace human judgement.
            </p>
          </div>
        </section>

        <section className="py-14 sm:py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl font-bold text-gray-950 sm:text-3xl">What’s included</h2>
            <div className="mt-8 grid border-y border-gray-200 md:grid-cols-2">
              {platformModules.map((module, index) => (
                <article
                  key={module.title}
                  className={`py-7 md:p-8 ${index % 2 === 0 ? 'md:border-r md:border-gray-200' : ''} ${index < 2 ? 'border-b border-gray-200' : index === 2 ? 'border-b border-gray-200 md:border-b-0' : ''}`}
                >
                  <h3 className="text-xl font-semibold text-gray-950">{module.title}</h3>
                  <p className="mt-2 max-w-xl leading-7 text-gray-600">{module.description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {screenshots.map((item, index) => (
          <section key={item.title} className={`border-t border-gray-200 py-16 sm:py-24 ${index % 2 === 0 ? 'bg-slate-50' : 'bg-white'}`}>
            <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 sm:px-6 lg:grid-cols-2 lg:gap-14 lg:px-8">
              <div className={index % 2 === 1 ? 'lg:order-2' : ''}>
                <p className="text-sm font-semibold uppercase tracking-[0.16em] text-nhs-blue">{item.eyebrow}</p>
                <h2 className="mt-3 text-3xl font-bold tracking-tight text-gray-950 sm:text-4xl">{item.title}</h2>
                <p className="mt-5 text-lg leading-8 text-gray-600">{item.description}</p>
              </div>
              <div className={index % 2 === 1 ? 'lg:order-1' : ''}>
                <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg shadow-slate-900/10">
                  <Image src={item.image} alt={item.alt} width={item.width} height={item.height} className="h-auto w-full" />
                </div>
              </div>
            </div>
          </section>
        ))}

        <section className="border-t border-gray-200 py-16 sm:py-24">
          <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-2 lg:px-8">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-nhs-blue">Across every module</p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight text-gray-950 sm:text-4xl">The same controls follow the content.</h2>
            </div>
            <div className="grid gap-6 sm:grid-cols-2">
              {[
                ['Local editing', 'Adapt shared content and add practice-specific guidance.'],
                ['Roles and permissions', 'Control who can view, edit, review and administer content.'],
                ['Feedback and suggestions', 'Let staff flag an issue and follow what happens next.'],
                ['Usage reporting', 'See which content is being used and export authorised reports.'],
              ].map(([title, description]) => (
                <div key={title} className="border-t-2 border-nhs-blue pt-4">
                  <h3 className="font-semibold text-gray-950">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-gray-600">{description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-nhs-dark-blue py-14 text-white">
          <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-7 px-4 sm:px-6 md:flex-row md:items-center lg:px-8">
            <div>
              <h2 className="text-2xl font-bold sm:text-3xl">See how it would work in your practice.</h2>
              <p className="mt-2 text-blue-100">We’ll show you the live platform and focus on the parts most relevant to your team.</p>
            </div>
            <Link href="/demo-request" className="inline-flex flex-none items-center justify-center rounded-md bg-white px-6 py-3.5 font-semibold text-nhs-dark-blue hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-nhs-dark-blue">
              Book a demo
            </Link>
          </div>
        </section>
      </main>

      <MarketingFooter />
    </div>
  )
}
