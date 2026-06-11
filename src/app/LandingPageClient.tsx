'use client'

import Link from 'next/link'
import Image from 'next/image'
import MarketingHeader from '@/components/marketing/MarketingHeader'
import MarketingFooter from '@/components/marketing/MarketingFooter'
import AnimatedDemo from '@/components/marketing/AnimatedDemo'

function CheckIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      className={`mt-0.5 h-5 w-5 flex-shrink-0 text-nhs-blue ${className}`}
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M16.704 5.29a1 1 0 010 1.414l-7.5 7.5a1 1 0 01-1.414 0l-3.5-3.5A1 1 0 015.704 9.29l2.793 2.793 6.793-6.793a1 1 0 011.414 0z"
        clipRule="evenodd"
      />
    </svg>
  )
}

const platformModules = [
  {
    title: 'Signposting Toolkit',
    subtitle: 'The foundation of the platform',
    image: '/images/symptom-page.png',
    imageAlt: 'Symptom page showing plain-English signposting instructions with high-risk highlighting',
    description:
      'Structured symptom guidance written in plain English, designed for use at the front desk during a call.',
    bullets: [
      'High-risk highlighting and escalation prompts',
      'Age-aware routing for under-5s, over-5s, and adults',
      'Every instruction editable, with local clinical sign-off',
    ],
  },
  {
    title: 'Practice Handbook',
    subtitle: 'Internal practice guidance',
    image: '/images/practice-handbook.png',
    imageAlt: 'Practice Handbook page showing internal practice policies and procedures',
    description:
      'A single place for the processes and policies your team looks up every day, owned and updated by the practice.',
    bullets: [
      'Reduces interruptions and ad-hoc questions for clinical staff',
      'Review dates and restricted editing where needed',
    ],
  },
  {
    title: 'Workflow Guidance',
    subtitle: 'Step-by-step workflow support',
    image: '/images/workflow-guidance.png',
    imageAlt: 'Workflow canvas showing a step-by-step admin process',
    description:
      'Visual, step-by-step workflows for the admin tasks that are complex, high-risk, or easy to get wrong.',
    bullets: [
      'Helps newer staff handle unfamiliar tasks consistently',
      'Governed in the same way as all other platform content',
    ],
  },
]

const differentiators = [
  {
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
      />
    ),
    title: 'Built and governed by working GPs',
    description:
      'Developed at Ide Lane Surgery in Exeter and used daily by its own reception team, not designed at arm’s length.',
  },
  {
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
      />
    ),
    title: 'Configurable to your local pathways',
    description:
      'Edit any symptom, add your own, and tailor appointment types and services. Every surgery keeps full local clinical sign-off.',
  },
  {
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
      />
    ),
    title: 'Written for non-clinical staff',
    description:
      'Plain-English instructions with colour-coded urgency cues that reception and care navigation teams can follow confidently.',
  },
  {
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z"
      />
    ),
    title: 'Faster onboarding for new staff',
    description:
      'Consistent wording and a familiar layout mean new and temporary staff can signpost safely from their first week.',
  },
  {
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
      />
    ),
    title: 'A full audit trail',
    description:
      'Usage, approvals, and changes are logged, supporting local clinical governance and re-review cycles.',
  },
  {
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
      />
    ),
    title: 'Runs in the browser',
    description:
      'No installation and nothing for your IT team to maintain. Works on any practice PC with a modern browser.',
  },
]

export default function LandingPageClient() {
  const appBaseUrl =
    process.env.NEXT_PUBLIC_APP_BASE_URL?.replace(/\/$/, '') ||
    (process.env.NODE_ENV === 'development' ? '' : 'https://app.signpostingtool.co.uk')
  const appEntryUrl = appBaseUrl || '/'

  const scrollToDemo = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault()
    const demoSection = document.getElementById('demo-section')
    if (demoSection) {
      demoSection.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  return (
    <div className="min-h-screen bg-white">
      <MarketingHeader appEntryUrl={appEntryUrl} />

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-slate-50 py-16 md:py-28">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(0,94,184,0.04)_1px,transparent_0)] bg-[length:32px_32px]" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({
                '@context': 'https://schema.org',
                '@type': 'SoftwareApplication',
                name: 'Signposting Toolkit',
                applicationCategory: 'Healthcare Software',
                operatingSystem: 'Web',
                description:
                  'A modern, clinically governed GP care navigation software platform built by GPs for GPs and their care navigators. Helps reception teams direct patients safely to the right service, with local clinical sign-off and audit trail.',
                url: 'https://www.signpostingtool.co.uk',
              }),
            }}
          />
          <div className="text-center max-w-4xl mx-auto">
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 leading-tight tracking-tight">
              The GP Signposting Toolkit for{' '}
              <span className="text-nhs-blue">safer, faster care navigation</span>
            </h1>
            <p className="text-lg sm:text-xl text-gray-600 mt-6 md:mt-8 max-w-3xl mx-auto leading-relaxed">
              Over 200 locally governed symptoms with clear, consistent guidance your reception team can use confidently from day one.
            </p>
            <div className="mt-10 md:mt-12 flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center items-center">
              <Link
                href="/demo-request"
                className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-3.5 text-base font-semibold rounded-lg text-white bg-nhs-blue hover:bg-nhs-dark-blue focus:outline-none focus:ring-2 focus:ring-nhs-blue focus:ring-offset-2 transition-all shadow-md hover:shadow-lg"
              >
                Request a demo
              </Link>
              <Link
                href={appEntryUrl}
                className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-3.5 text-base font-semibold rounded-lg text-gray-700 bg-white border border-gray-300 hover:border-gray-400 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-nhs-blue focus:ring-offset-2 transition-all shadow-sm"
              >
                Launch Toolkit
              </Link>
            </div>
            <div className="mt-4">
              <a
                href="#demo-section"
                onClick={scrollToDemo}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-nhs-blue transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Watch 1-minute demo
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Proof Strip */}
      <section className="border-y border-gray-100 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-10 text-sm text-gray-500">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-nhs-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              <span><strong className="text-gray-900">200+</strong> symptoms pre-loaded</span>
            </div>
            <div className="hidden sm:block w-px h-4 bg-gray-200" />
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-nhs-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
              <span><strong className="text-gray-900">#1</strong> Pharmacy First referrer in Devon</span>
            </div>
            <div className="hidden sm:block w-px h-4 bg-gray-200" />
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-nhs-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
              <span>Built at <strong className="text-gray-900">Ide Lane Surgery</strong></span>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">How it works</h2>
          </div>

          <div className="grid grid-cols-1 gap-8 md:grid-cols-3 max-w-5xl mx-auto">
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
              <div className="w-12 h-12 bg-nhs-blue rounded-xl flex items-center justify-center text-white font-bold text-xl mb-5">
                1
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Set up your local guidance</h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                Import or start from the preloaded symptom library. Agree pathways locally with your clinicians.
              </p>
            </div>

            <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
              <div className="w-12 h-12 bg-nhs-blue rounded-xl flex items-center justify-center text-white font-bold text-xl mb-5">
                2
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Reception chooses a symptom</h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                Search or browse the symptoms. Colour-coded steps guide safe signposting and documentation.
              </p>
            </div>

            <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
              <div className="w-12 h-12 bg-nhs-blue rounded-xl flex items-center justify-center text-white font-bold text-xl mb-5">
                3
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Govern and improve over time</h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                Use the clinical review tools to keep content up to date. Adapt pathways as your surgery changes.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* What's in the platform */}
      <section className="py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">What&apos;s in the platform</h2>
            <p className="mt-4 text-lg text-gray-600 max-w-3xl mx-auto leading-relaxed">
              Practices can use everything together or start with the areas that help most. All modules share the same navigation, permissions, and governance model, so teams only learn one system.
            </p>
          </div>

          <div className="space-y-20 max-w-6xl mx-auto">
            {platformModules.map((module, i) => (
              <div
                key={module.title}
                className={`flex flex-col gap-8 lg:gap-14 lg:items-center ${
                  i % 2 === 1 ? 'lg:flex-row-reverse' : 'lg:flex-row'
                }`}
              >
                <div className="lg:w-1/2">
                  <Image
                    src={module.image}
                    alt={module.imageAlt}
                    width={1200}
                    height={800}
                    className="w-full h-auto rounded-xl shadow-lg ring-1 ring-gray-200"
                  />
                </div>
                <div className="lg:w-1/2">
                  <p className="text-sm font-semibold text-nhs-blue uppercase tracking-wide mb-2">{module.subtitle}</p>
                  <h3 className="text-2xl font-bold text-gray-900 mb-4">{module.title}</h3>
                  <p className="text-gray-600 leading-relaxed mb-5">{module.description}</p>
                  <ul className="space-y-3 text-gray-700">
                    {module.bullets.map((bullet) => (
                      <li key={bullet} className="flex items-start gap-2.5">
                        <CheckIcon />
                        <span className="text-sm">{bullet}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-14 text-center">
            <Link
              href="/inside-the-platform"
              className="text-base text-nhs-blue hover:text-nhs-dark-blue font-medium underline underline-offset-2 inline-flex items-center gap-1.5 transition-colors"
            >
              See what the platform looks like
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        </div>
      </section>

      {/* Interactive demo section */}
      <section id="demo-section" className="bg-white py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">
              See the Signposting Toolkit in action
            </h2>
            <p className="mt-4 text-lg text-gray-600 max-w-3xl mx-auto leading-relaxed">
              Watch how reception teams search for a symptom and get clear, clinically approved guidance in seconds.
            </p>
          </div>

          {/* Animated demo — primary */}
          <div className="max-w-3xl mx-auto mb-12">
            <AnimatedDemo />
            <p className="text-center text-xs text-gray-400 mt-3">
              Hover to pause. The animation loops automatically.
            </p>
          </div>

          {/* Video walkthrough — secondary */}
          <div className="max-w-3xl mx-auto">
            <p className="text-center text-sm text-gray-500 mb-4">
              Or watch the full one-minute walkthrough:
            </p>
            <div className="w-full rounded-2xl shadow-xl overflow-hidden ring-1 ring-gray-200 aspect-video">
              <iframe
                src="https://www.youtube-nocookie.com/embed/-IIpq9X9n9Y?rel=0&modestbranding=1&controls=1&autohide=1&playsinline=1"
                className="w-full h-full object-cover"
                title="Signposting Toolkit Walkthrough"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              ></iframe>
            </div>
          </div>
        </div>
      </section>

      {/* Proven in practice */}
      <section className="py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">Proven in practice</h2>
            <p className="mt-4 text-lg text-gray-600 max-w-3xl mx-auto leading-relaxed">
              Ide Lane Surgery, where the toolkit was built and is used every day, is now the highest Pharmacy First referrer in Devon — supported by consistent, safe routing at reception.
            </p>
          </div>

          <div className="max-w-4xl mx-auto">
            <figure className="relative bg-white border border-gray-100 rounded-2xl p-8 sm:p-12 shadow-sm">
              <div className="absolute -top-4 left-8 sm:left-12">
                <div className="w-8 h-8 bg-nhs-blue rounded-full flex items-center justify-center shadow-md">
                  <svg className="w-3.5 h-3.5 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.731-9.57 8.983-10.609l.998 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.986z" />
                  </svg>
                </div>
              </div>

              <blockquote className="text-gray-700 leading-relaxed">
                <p className="text-base sm:text-lg">
                  &ldquo;I have seen a number of signposting tools and techniques in over 50 practices across the South West. This signposting tool is easy for receptionists/care navigators to use and gives clear guidance on how to direct patients appropriately.
                </p>
                <p className="mt-4 text-base sm:text-lg">
                  The visuals have been tailored to allow users to find the condition they require quickly. Having useful phrases and questions, which have been developed by both clinical and non-clinical team members, allows the user to navigate the patient promptly and capture the required information for the clinician without sounding robotic or lacking in empathy.
                </p>
                <p className="mt-4 text-base sm:text-lg">
                  The tool is excellent for new starters or temporary staff who are learning the practice systems and allows all users to carry out the correct booking process/urgency consistently.&rdquo;
                </p>
              </blockquote>

              <figcaption className="mt-8 pt-6 border-t border-gray-200">
                <p className="font-semibold text-gray-900">Emma Gregory</p>
                <p className="text-sm text-gray-500">PLS Programme Facilitator &amp; Former Practice Manager</p>
              </figcaption>
            </figure>

            <div className="mt-10 text-center">
              <p className="text-base text-gray-600">
                Developed at Ide Lane Surgery in Exeter. Designed so each surgery keeps full local clinical sign-off.
              </p>
              <div className="mt-4 flex justify-center">
                <Image
                  src="/images/logo.png"
                  alt="Ide Lane Surgery logo"
                  width={160}
                  height={84}
                  className="h-10 w-auto opacity-80"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Why practices choose the Signposting Toolkit */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">Why practices choose the Signposting Toolkit</h2>
          </div>

          <div className="grid grid-cols-1 gap-x-8 gap-y-10 md:grid-cols-2 lg:grid-cols-3 max-w-6xl mx-auto">
            {differentiators.map((feature) => (
              <div key={feature.title} className="flex items-start space-x-4">
                <div className="flex-shrink-0 w-10 h-10 bg-nhs-blue/10 rounded-xl flex items-center justify-center">
                  <svg className="w-5 h-5 text-nhs-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    {feature.icon}
                  </svg>
                </div>
                <div>
                  <h3 className="text-base font-semibold text-gray-900 mb-1">{feature.title}</h3>
                  <p className="text-sm text-gray-600">{feature.description}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-14 text-center">
            <Link
              href="/why-signposting-toolkit"
              className="text-base text-nhs-blue hover:text-nhs-dark-blue font-medium underline underline-offset-2"
            >
              Learn more about why practices choose us
            </Link>
          </div>
        </div>
      </section>

      {/* Optional tools */}
      <section className="py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">Optional tools</h2>
            <p className="mt-4 text-lg text-gray-600 max-w-3xl mx-auto leading-relaxed">
              Optional tools can help administrators improve clarity and consistency. Any suggested content is treated as draft, must be reviewed locally before use, and can be disabled at practice level.{' '}
              <Link href="/faqs" className="text-nhs-blue hover:text-nhs-dark-blue font-medium underline underline-offset-2">
                See FAQs
              </Link>{' '}
              for common questions about governance and AI.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3 max-w-5xl mx-auto">
            <div className="bg-white p-7 rounded-2xl shadow-sm border border-gray-100">
              <div className="w-11 h-11 bg-nhs-blue/10 rounded-xl flex items-center justify-center mb-5">
                <svg className="w-5 h-5 text-nhs-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">AI instruction editor</h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                Improve clarity and tone. Generate clearer, patient-friendly instructions, ready for review before publishing.
              </p>
            </div>

            <div className="bg-white p-7 rounded-2xl shadow-sm border border-gray-100">
              <div className="w-11 h-11 bg-nhs-green/10 rounded-xl flex items-center justify-center mb-5">
                <svg className="w-5 h-5 text-nhs-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">AI question prompts</h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                Generate patient-friendly questions to help staff gather the information they need to follow the instructions for each symptom.
              </p>
            </div>

            <div className="bg-white p-7 rounded-2xl shadow-sm border border-gray-100">
              <div className="w-11 h-11 bg-nhs-dark-blue/10 rounded-xl flex items-center justify-center mb-5">
                <svg className="w-5 h-5 text-nhs-dark-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Smart symptom updates</h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                Centrally suggested content updates as guidance evolves, for your practice to review and adopt locally.
              </p>
            </div>
          </div>

          {/* Coming soon: Daily Dose */}
          <div className="mt-12 max-w-3xl mx-auto bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
            <div className="flex items-start gap-3">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-nhs-yellow/15 text-amber-700 whitespace-nowrap mt-0.5">
                Coming soon
              </span>
              <div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Daily Dose</h3>
                <p className="text-gray-600 leading-relaxed">
                  Short, role-appropriate learning cards built from real practice workflows, designed to support confidence and consistency. Daily Dose will be offered as an optional module.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">Pricing</h2>
          </div>

          <div className="max-w-4xl mx-auto">
            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
              <div className="p-8 sm:p-10">
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-nhs-blue/10 text-nhs-blue">
                  Early adopter offer
                </span>
                <p className="mt-4 text-4xl sm:text-5xl font-bold text-gray-900">
                  &pound;0.07 <span className="text-lg sm:text-xl font-medium text-gray-500">per patient per year</span>
                </p>
                <p className="mt-3 text-base text-gray-600">Available to the first 10 practices to onboard.</p>
                <p className="mt-2 text-base text-gray-600">
                  Early adopters will also have the opportunity to share feedback and help shape future development.
                </p>

                <div className="mt-8 pt-6 border-t border-gray-100">
                  <h3 className="text-base font-semibold text-gray-900">What&apos;s included</h3>
                  <ul className="mt-5 space-y-4 text-gray-700">
                    {[
                      {
                        title: 'Clear symptom guidance',
                        description:
                          'Over 200 clinically structured symptoms, written in clear, plain English and designed for reception and care navigation teams.',
                      },
                      {
                        title: 'Clinical governance built in',
                        description: (
                          <>
                            Every practice reviews and signs off its own guidance. A built-in clinical review
                            workflow supports local approval, re-review cycles, and a clear audit trail.{' '}
                            <Link href="/faqs" className="text-nhs-blue underline underline-offset-2 hover:text-nhs-dark-blue">
                              See FAQs
                            </Link>
                            .
                          </>
                        ),
                      },
                      {
                        title: 'Local customisation',
                        description:
                          'Tailor wording, appointment types, and local pathways so the guidance reflects how your practice works.',
                      },
                      {
                        title: 'Onboarding & ongoing support',
                        description: (
                          <>
                            Guided setup and practical support from a team who run the toolkit in a live NHS
                            practice, helping you get up and running quickly and confidently.{' '}
                            <Link href="/faqs" className="text-nhs-blue underline underline-offset-2 hover:text-nhs-dark-blue">
                              Support FAQs
                            </Link>
                            .
                          </>
                        ),
                      },
                      {
                        title: 'Optional clarity tools',
                        description:
                          'Optional tools are available to help administrators improve clarity or generate suggested questions. These features can be switched off, and any generated content must be reviewed locally before use.',
                      },
                    ].map((item) => (
                      <li key={item.title} className="flex items-start gap-3">
                        <CheckIcon />
                        <div>
                          <p className="font-semibold text-gray-900">{item.title}</p>
                          <p className="mt-1 text-sm text-gray-600 max-w-prose">{item.description}</p>
                        </div>
                      </li>
                    ))}
                  </ul>

                  <p className="mt-6 text-sm text-gray-500">
                    Future pricing will be reviewed once the early adopter phase is complete.
                  </p>
                  <p className="mt-3 text-sm text-gray-500">
                    The platform currently includes core modules during early rollout. As additional modules and learning features are introduced, ongoing use may be priced as an optional add-on.
                  </p>

                  <div className="mt-8">
                    <Link
                      href="/demo-request"
                      className="inline-flex items-center px-8 py-3 text-base font-semibold rounded-lg text-white bg-nhs-blue hover:bg-nhs-dark-blue focus:outline-none focus:ring-2 focus:ring-nhs-blue focus:ring-offset-2 transition-colors shadow-sm"
                    >
                      Request a demo
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <p className="mt-10 text-center text-base text-gray-600">
            For further information or to discuss pricing and onboarding options, please contact{' '}
            <a
              href="mailto:contact@signpostingtool.co.uk"
              className="text-nhs-blue hover:text-nhs-dark-blue font-medium underline underline-offset-2"
            >
              contact@signpostingtool.co.uk
            </a>
            .
          </p>
        </div>
      </section>

      {/* CTA Banner */}
      <section className="bg-nhs-dark-blue py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">Ready to improve your care navigation?</h2>
          <p className="text-lg text-blue-100 mb-8 max-w-2xl mx-auto">
            Join practices across Devon already using the Signposting Toolkit for safer, faster patient routing.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/demo-request"
              className="inline-flex items-center justify-center px-8 py-3.5 text-base font-semibold rounded-lg text-nhs-dark-blue bg-white hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-nhs-dark-blue transition-colors shadow-md"
            >
              Request a demo
            </Link>
            <Link
              href={appEntryUrl}
              className="inline-flex items-center justify-center px-8 py-3.5 text-base font-semibold rounded-lg text-white border-2 border-white/30 hover:border-white/60 hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-nhs-dark-blue transition-colors"
            >
              Launch Toolkit
            </Link>
          </div>
        </div>
      </section>

      {/* Disclaimer section */}
      <section className="py-16 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 sm:p-8">
            <h3 className="text-base font-semibold text-amber-800 mb-2">Disclaimer &amp; governance</h3>
            <p className="text-sm text-amber-700 leading-relaxed">
              The Signposting Toolkit supports reception and care navigation teams. It does not provide
              medical advice, diagnosis, or treatment, and it does not replace clinical judgement. All
              guidance requires local clinical review and sign-off before use, and each practice remains
              responsible for the content it approves for its team. The developers and Ide Lane Surgery
              accept no responsibility for decisions made based on the information provided by this toolkit.
              See the{' '}
              <Link href="/faqs" className="underline underline-offset-2 hover:text-amber-900 font-medium">
                governance FAQs
              </Link>{' '}
              for more detail.
            </p>
          </div>
        </div>
      </section>

      <MarketingFooter />
    </div>
  )
}
