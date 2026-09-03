import Link from 'next/link'
import MarketingHeader from '@/components/marketing/MarketingHeader'
import MarketingFooter from '@/components/marketing/MarketingFooter'

const localDetails = [
  'the wording your team uses',
  'the appointments you actually offer',
  'your local services and referral routes',
  'the workflows and handbook guidance specific to your practice',
]

const governanceDetails = [
  'Pending and approved content states',
  'Named reviewers and review dates',
  'Role-based access for staff and administrators',
  'Usage information and a route for staff suggestions',
]

export default function WhySignpostingToolkitClient() {
  const appBaseUrl =
    process.env.NEXT_PUBLIC_APP_BASE_URL?.replace(/\/$/, '') ||
    (process.env.NODE_ENV === 'development' ? '' : 'https://app.signpostingtool.co.uk')
  const appEntryUrl = appBaseUrl || '/'

  return (
    <div className="min-h-screen bg-white">
      <MarketingHeader appEntryUrl={appEntryUrl} />

      <main>
        <section className="border-b border-slate-200 bg-slate-50 py-16 sm:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="max-w-4xl">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-nhs-blue">
                Why it works
              </p>
              <h1 className="mt-5 text-4xl font-bold tracking-tight text-slate-950 sm:text-6xl">
                Built in a practice, for the work practices actually do.
              </h1>
              <p className="mt-7 max-w-3xl text-xl leading-8 text-slate-600">
                The first version was created at Ide Lane Surgery because reception staff needed
                a dependable answer when a patient asked what should happen next. The platform has
                grown, but that practical starting point still shapes it.
              </p>
              <div className="mt-10 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/demo-request"
                  className="inline-flex items-center justify-center rounded-md bg-nhs-blue px-6 py-3 text-base font-semibold text-white shadow-sm transition-colors hover:bg-nhs-dark-blue focus:outline-none focus:ring-2 focus:ring-nhs-blue focus:ring-offset-2"
                >
                  Book a demo
                </Link>
                <Link
                  href="/inside-the-platform"
                  className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-6 py-3 text-base font-semibold text-slate-800 transition-colors hover:border-slate-400 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-nhs-blue focus:ring-offset-2"
                >
                  See the platform
                </Link>
              </div>
            </div>

            <dl className="mt-16 grid gap-px overflow-hidden rounded-xl border border-slate-200 bg-slate-200 sm:grid-cols-3">
              <div className="bg-white p-6">
                <dt className="text-sm font-medium text-slate-500">Where it started</dt>
                <dd className="mt-2 text-lg font-semibold text-slate-950">Ide Lane Surgery</dd>
              </div>
              <div className="bg-white p-6">
                <dt className="text-sm font-medium text-slate-500">Signposting library</dt>
                <dd className="mt-2 text-lg font-semibold text-slate-950">More than 200 symptoms</dd>
              </div>
              <div className="bg-white p-6">
                <dt className="text-sm font-medium text-slate-500">Patient records required</dt>
                <dd className="mt-2 text-lg font-semibold text-slate-950">None</dd>
              </div>
            </dl>
          </div>
        </section>

        <section className="py-16 sm:py-24">
          <div className="mx-auto grid max-w-6xl gap-12 px-4 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:gap-20 lg:px-8">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-nhs-blue">
                Local by design
              </p>
              <h2 className="mt-4 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
                The useful part is the local detail.
              </h2>
            </div>
            <div className="text-lg leading-8 text-slate-700">
              <p>
                A national list can provide a starting point. It cannot tell a receptionist which
                appointment to use at your surgery, how your duty team works, or which community
                service is available nearby.
              </p>
              <p className="mt-5">
                Signposting gives each practice a shared starting library, then lets authorised
                staff adapt it to reflect:
              </p>
              <ul className="mt-6 grid gap-3 sm:grid-cols-2">
                {localDetails.map((detail) => (
                  <li key={detail} className="border-l-2 border-nhs-blue pl-4 text-base leading-7">
                    {detail}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section className="bg-nhs-dark-blue py-16 text-white sm:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="grid gap-12 lg:grid-cols-2 lg:gap-20">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.16em] text-blue-200">
                  At the front desk
                </p>
                <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
                  Designed for the person answering the question.
                </h2>
              </div>
              <div className="space-y-5 text-lg leading-8 text-blue-50">
                <p>
                  The working day is busy. Guidance has to be easy to find, quick to scan and clear
                  about the next step. It should not depend on remembering which folder contains the
                  latest version or who happens to be on shift.
                </p>
                <p>
                  Signposting, Appointment Directory, Workflow Guidance and Practice Handbook put
                  those answers in one familiar place, using a consistent layout across the platform.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="py-16 sm:py-24">
          <div className="mx-auto grid max-w-6xl gap-12 px-4 sm:px-6 lg:grid-cols-2 lg:gap-20 lg:px-8">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-nhs-blue">
                Governance
              </p>
              <h2 className="mt-4 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
                Review information where it is used.
              </h2>
              <p className="mt-6 text-lg leading-8 text-slate-700">
                Local ownership matters. Practices decide what their live guidance says and who is
                authorised to change or approve it. The review information stays alongside the
                content rather than in a separate spreadsheet.
              </p>
            </div>
            <ul className="divide-y divide-slate-200 border-y border-slate-200">
              {governanceDetails.map((detail) => (
                <li key={detail} className="flex gap-4 py-5 text-base font-medium text-slate-800">
                  <svg
                    aria-hidden="true"
                    className="mt-0.5 h-5 w-5 shrink-0 text-nhs-blue"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="m5 13 4 4L19 7" />
                  </svg>
                  {detail}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="bg-slate-50 py-16 sm:py-24">
          <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
            <div className="border-l-4 border-nhs-blue bg-white p-7 shadow-sm sm:p-10">
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-nhs-blue">
                Optional AI
              </p>
              <h2 className="mt-4 text-3xl font-bold tracking-tight text-slate-950">
                Useful for a first draft. Never the final decision.
              </h2>
              <div className="mt-6 space-y-4 text-lg leading-8 text-slate-700">
                <p>
                  Authorised administrators can use optional AI tools to help draft clearer wording,
                  suggest questions or create a simple visual. The features can be switched off.
                </p>
                <p>
                  AI output is returned as a draft for local review. It does not bypass roles,
                  permissions or the practice&apos;s approval process, and patient-identifiable
                  information should never be entered.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="py-16 sm:py-20">
          <div className="mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
            <h2 className="text-3xl font-bold tracking-tight text-slate-950">
              See it with your own practice in mind.
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg leading-8 text-slate-600">
              We&apos;ll show you the four modules, the local editing and review process, and what
              setup would involve for your team.
            </p>
            <Link
              href="/demo-request"
              className="mt-8 inline-flex items-center justify-center rounded-md bg-nhs-blue px-7 py-3.5 text-base font-semibold text-white shadow-sm transition-colors hover:bg-nhs-dark-blue focus:outline-none focus:ring-2 focus:ring-nhs-blue focus:ring-offset-2"
            >
              Book a demo
            </Link>
          </div>
        </section>
      </main>

      <MarketingFooter />
    </div>
  )
}
