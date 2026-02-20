'use client'

import Link from 'next/link'
import { useScrollReveal } from '@/hooks/useScrollReveal'
import { useFadeUpOnScroll } from '@/hooks/useFadeUpOnScroll'
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

export default function LandingPageClient() {
  const appBaseUrl =
    process.env.NEXT_PUBLIC_APP_BASE_URL?.replace(/\/$/, '') ||
    (process.env.NODE_ENV === 'development' ? '' : 'https://app.signpostingtool.co.uk')
  const appEntryUrl = appBaseUrl || '/'
  const { register } = useScrollReveal()

  // Fade-up hooks for "Why It Works" section with staggered delays
  const whyItWorks1 = useFadeUpOnScroll({ staggerDelay: 0 })
  const whyItWorks2 = useFadeUpOnScroll({ staggerDelay: 50 })
  const whyItWorks3 = useFadeUpOnScroll({ staggerDelay: 100 })
  const whyItWorks4 = useFadeUpOnScroll({ staggerDelay: 150 })

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
      <section className="relative overflow-hidden bg-gradient-to-b from-slate-50 via-white to-white py-16 md:py-28">
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
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-bold text-gray-900 leading-tight tracking-tight">
              The GP Signposting Toolkit for{' '}
              <span className="text-gradient-blue">safer, faster care navigation.</span>
            </h1>
            <p className="text-lg sm:text-xl text-gray-600 mt-6 md:mt-8 max-w-3xl mx-auto leading-relaxed">
              Over 200 locally governed symptoms with clear, consistent guidance your reception team can use confidently from day one.
            </p>
            <p className="text-base text-gray-500 mt-4 md:mt-5 max-w-3xl mx-auto leading-relaxed">
              Now part of a modular platform. Alongside symptom signposting, the Signposting Toolkit can also support practice teams with internal guidance (Practice Handbook) and step-by-step workflow support (Workflow Guidance) — all inside the same calm, governed interface.
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

      {/* Social Proof Strip */}
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

      {/* 3-Benefit Strip */}
      <section className="bg-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-10 md:grid-cols-3">
            <div className="text-center">
              <div className="w-14 h-14 mx-auto mb-5 flex items-center justify-center rounded-2xl bg-gradient-to-br from-nhs-blue/10 to-nhs-blue/5">
                <svg className="w-7 h-7 text-nhs-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Safer signposting</h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                Local, clinically governed guidance that your surgery controls.
              </p>
            </div>
            <div className="text-center">
              <div className="w-14 h-14 mx-auto mb-5 flex items-center justify-center rounded-2xl bg-gradient-to-br from-nhs-green/10 to-nhs-green/5">
                <svg className="w-7 h-7 text-nhs-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Fewer avoidable GP appointments</h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                Clear advice helps reception and care navigation teams direct patients first time.
              </p>
            </div>
            <div className="text-center">
              <div className="w-14 h-14 mx-auto mb-5 flex items-center justify-center rounded-2xl bg-gradient-to-br from-nhs-dark-blue/10 to-nhs-dark-blue/5">
                <svg className="w-7 h-7 text-nhs-dark-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Faster training for new staff</h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                Consistent wording and a familiar layout reduce the learning curve.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="py-24 bg-gradient-to-b from-gray-50 to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">How it works</h2>
          </div>

          <div className="grid grid-cols-1 gap-8 md:grid-cols-3 max-w-5xl mx-auto">
            <div ref={register} className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
              <div className="w-12 h-12 bg-gradient-to-br from-nhs-blue to-nhs-dark-blue rounded-xl flex items-center justify-center text-white font-bold text-xl mb-5 shadow-md">
                1
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Set up your local guidance</h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                Import or start from the preloaded symptom library. Agree pathways locally with your clinicians.
              </p>
            </div>

            <div ref={register} className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
              <div className="w-12 h-12 bg-gradient-to-br from-nhs-blue to-nhs-dark-blue rounded-xl flex items-center justify-center text-white font-bold text-xl mb-5 shadow-md">
                2
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Reception chooses a symptom</h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                Search or browse the symptoms. Colour-coded steps guide safe signposting and documentation.
              </p>
            </div>

            <div ref={register} className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
              <div className="w-12 h-12 bg-gradient-to-br from-nhs-blue to-nhs-dark-blue rounded-xl flex items-center justify-center text-white font-bold text-xl mb-5 shadow-md">
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
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">What&apos;s in the platform</h2>
            <p className="mt-4 text-lg text-gray-600 max-w-3xl mx-auto leading-relaxed">
              The Signposting Toolkit has grown into a modular platform — practices can use everything together or focus on the areas that help most.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-8 md:grid-cols-3 max-w-5xl mx-auto">
            {/* Signposting Toolkit card */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow">
              <div className="h-1 bg-gradient-to-r from-nhs-blue to-nhs-blue/50" />
              <div className="p-8">
                <h3 className="text-xl font-semibold text-gray-900 mb-1">Signposting Toolkit</h3>
                <p className="text-sm text-gray-500 mb-5">The foundation of the platform</p>
                <ul className="space-y-3 text-gray-700">
                  <li className="flex items-start gap-2.5">
                    <CheckIcon />
                    <span className="text-sm">Structured symptom guidance in plain English</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <CheckIcon />
                    <span className="text-sm">High-risk highlighting and escalation prompts</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <CheckIcon />
                    <span className="text-sm">Structured, age-aware routing for faster navigation</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <CheckIcon />
                    <span className="text-sm">Local customisation with clinical governance</span>
                  </li>
                </ul>
              </div>
            </div>

            {/* Practice Handbook card */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow">
              <div className="h-1 bg-gradient-to-r from-nhs-green to-nhs-green/50" />
              <div className="p-8">
                <h3 className="text-xl font-semibold text-gray-900 mb-1">Practice Handbook</h3>
                <p className="text-sm text-gray-500 mb-5">Internal practice guidance</p>
                <ul className="space-y-3 text-gray-700">
                  <li className="flex items-start gap-2.5">
                    <CheckIcon />
                    <span className="text-sm">A single source of truth for practice processes and policies</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <CheckIcon />
                    <span className="text-sm">Reduces interruptions and ad-hoc queries</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <CheckIcon />
                    <span className="text-sm">Owned and updated by the practice team</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <CheckIcon />
                    <span className="text-sm">Clear review dates and restricted editing where needed</span>
                  </li>
                </ul>
              </div>
            </div>

            {/* Workflow Guidance card */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow">
              <div className="h-1 bg-gradient-to-r from-nhs-dark-blue to-nhs-blue" />
              <div className="p-8">
                <h3 className="text-xl font-semibold text-gray-900 mb-1">Workflow Guidance</h3>
                <p className="text-sm text-gray-500 mb-5">Step-by-step workflow support</p>
                <ul className="space-y-3 text-gray-700">
                  <li className="flex items-start gap-2.5">
                    <CheckIcon />
                    <span className="text-sm">Visual workflows for complex or high-risk admin processes</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <CheckIcon />
                    <span className="text-sm">Helps newer staff build confidence quickly</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <CheckIcon />
                    <span className="text-sm">Reduces variation and unnecessary escalation</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <CheckIcon />
                    <span className="text-sm">Governed in the same way as core platform content</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          <p className="mt-10 text-center text-sm text-gray-500 max-w-3xl mx-auto">
            All modules share the same navigation, permissions, and governance model — so teams only learn one system.
          </p>
        </div>
      </section>

      {/* Interactive demo section */}
      <section id="demo-section" className="bg-gradient-to-b from-gray-50 to-white py-24">
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

      {/* Testimonial */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">What people are saying</h2>
          </div>

          <div className="max-w-4xl mx-auto">
            <figure className="relative bg-gradient-to-br from-slate-50 to-white border border-gray-100 rounded-2xl p-8 sm:p-12 shadow-sm">
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
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-24 bg-gradient-to-b from-gray-50 to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">Pricing</h2>
          </div>

          <div className="max-w-4xl mx-auto">
            <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
              <div className="h-1.5 bg-gradient-to-r from-nhs-blue via-nhs-blue/80 to-nhs-green" />
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
                            practice — helping you get up and running quickly and confidently.{' '}
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
        </div>
      </section>

      {/* Pharmacy First Impact Statement */}
      <section className="bg-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="inline-flex items-center px-4 py-1.5 rounded-full bg-nhs-green/10 text-nhs-green text-sm font-semibold mb-4">
              Proven in practice
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3">#1 in Devon</h2>
            <p className="text-lg text-gray-600 max-w-3xl mx-auto leading-relaxed">
              Highest Pharmacy First referrer — supported by consistent, safe routing using the Signposting Toolkit.
            </p>
            <p className="text-base text-gray-500 mt-3 max-w-2xl mx-auto">
              Ide Lane Surgery is now the highest referrer to Pharmacy First in Devon.
            </p>
          </div>
        </div>
      </section>

      {/* Why It Works Section */}
      <section className="bg-gradient-to-b from-gray-50 to-white py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">Why it works</h2>
          </div>
          <div className="grid grid-cols-1 gap-12 sm:grid-cols-2 lg:grid-cols-4">
            <div
              ref={whyItWorks1.ref}
              className={`text-center transition-all duration-500 ease-out ${
                whyItWorks1.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-[10px]'
              }`}
            >
              <div className="w-14 h-14 mx-auto mb-5 flex items-center justify-center rounded-2xl bg-gradient-to-br from-nhs-blue/10 to-nhs-blue/5">
                <svg className="w-7 h-7 text-nhs-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Clear rules</h3>
              <p className="text-sm text-gray-600 leading-relaxed">
                Every symptom comes with simple, plain-English instructions.
              </p>
            </div>

            <div
              ref={whyItWorks2.ref}
              className={`text-center transition-all duration-500 ease-out ${
                whyItWorks2.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-[10px]'
              }`}
            >
              <div className="w-14 h-14 mx-auto mb-5 flex items-center justify-center rounded-2xl bg-gradient-to-br from-nhs-green/10 to-nhs-green/5">
                <svg className="w-7 h-7 text-nhs-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Consistent outcomes</h3>
              <p className="text-sm text-gray-600 leading-relaxed">
                Teams make the same safe decisions — even on the busiest days.
              </p>
            </div>

            <div
              ref={whyItWorks3.ref}
              className={`text-center transition-all duration-500 ease-out ${
                whyItWorks3.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-[10px]'
              }`}
            >
              <div className="w-14 h-14 mx-auto mb-5 flex items-center justify-center rounded-2xl bg-gradient-to-br from-nhs-dark-blue/10 to-nhs-dark-blue/5">
                <svg className="w-7 h-7 text-nhs-dark-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Faster routing</h3>
              <p className="text-sm text-gray-600 leading-relaxed">
                Reduce delays and help patients reach the right place first time.
              </p>
            </div>

            <div
              ref={whyItWorks4.ref}
              className={`text-center transition-all duration-500 ease-out ${
                whyItWorks4.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-[10px]'
              }`}
            >
              <div className="w-14 h-14 mx-auto mb-5 flex items-center justify-center rounded-2xl bg-gradient-to-br from-nhs-blue/10 to-nhs-green/5">
                <svg className="w-7 h-7 text-nhs-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Improved access</h3>
              <p className="text-sm text-gray-600 leading-relaxed">
                Higher-quality Pharmacy First referrals and fewer unnecessary GP appointments.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* What it does section */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">What it does</h2>
          </div>

          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3 max-w-5xl mx-auto">
            <div ref={register} className="group bg-white p-7 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md hover:border-gray-200 transition-all">
              <div className="w-12 h-12 bg-gradient-to-br from-nhs-blue/15 to-nhs-blue/5 rounded-xl flex items-center justify-center mb-5 group-hover:scale-105 transition-transform">
                <svg className="w-6 h-6 text-nhs-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Comprehensive symptom library</h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                Over 200 symptoms pre-loaded, all standardised and editable for your practice — making the signposting tool easy to tailor.
              </p>
            </div>

            <div ref={register} className="group bg-white p-7 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md hover:border-gray-200 transition-all">
              <div className="w-12 h-12 bg-gradient-to-br from-nhs-green/15 to-nhs-green/5 rounded-xl flex items-center justify-center mb-5 group-hover:scale-105 transition-transform">
                <svg className="w-6 h-6 text-nhs-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Local customisation</h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                Adapt shared wording to reflect your local processes and services.
              </p>
            </div>

            <div ref={register} className="group bg-white p-7 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md hover:border-gray-200 transition-all">
              <div className="w-12 h-12 bg-gradient-to-br from-nhs-dark-blue/15 to-nhs-dark-blue/5 rounded-xl flex items-center justify-center mb-5 group-hover:scale-105 transition-transform">
                <svg className="w-6 h-6 text-nhs-dark-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Simple daily workflow</h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                Designed for fast use at the front desk, with colour-coded urgency, plain-English instructions, and a dependable primary care workflow.
              </p>
            </div>

            <div ref={register} className="group bg-white p-7 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md hover:border-gray-200 transition-all">
              <div className="w-12 h-12 bg-gradient-to-br from-nhs-blue/15 to-nhs-green/5 rounded-xl flex items-center justify-center mb-5 group-hover:scale-105 transition-transform">
                <svg className="w-6 h-6 text-nhs-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6l4 2m6-2a10 10 0 11-20 0 10 10 0 0120 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Onboarding &amp; support</h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                Guided setup and practical support—built by a working NHS practice team.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Personalisation section */}
      <section className="py-20 bg-gradient-to-b from-gray-50 to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 border-l-4 border-l-nhs-blue">
              <p className="text-gray-700 text-lg leading-relaxed">
                Choose from the shared library or add your own symptoms. Every surgery can shape the toolkit around its own services.
              </p>
            </div>

            <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 border-l-4 border-l-nhs-green">
              <p className="text-gray-700 text-lg leading-relaxed">
                Built for every team member — from reception to clinical admin — with clear, consistent language and easy navigation.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Optional tools */}
      <section className="py-24 bg-white">
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
            <div ref={register} className="group bg-gradient-to-br from-slate-50 to-white p-7 rounded-2xl shadow-sm border border-gray-100 transition-all duration-300 hover:shadow-md hover:border-gray-200 lg:hover:-translate-y-0.5">
              <div className="w-11 h-11 bg-gradient-to-br from-nhs-blue/15 to-nhs-blue/5 rounded-xl flex items-center justify-center mb-5 group-hover:scale-105 transition-transform">
                <svg className="w-5 h-5 text-nhs-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">AI instruction editor</h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                Improve clarity and tone. Generate clearer, patient-friendly instructions — ready for review before publishing.
              </p>
            </div>

            <div ref={register} className="group bg-gradient-to-br from-slate-50 to-white p-7 rounded-2xl shadow-sm border border-gray-100 transition-all duration-300 hover:shadow-md hover:border-gray-200 lg:hover:-translate-y-0.5">
              <div className="w-11 h-11 bg-gradient-to-br from-nhs-green/15 to-nhs-green/5 rounded-xl flex items-center justify-center mb-5 group-hover:scale-105 transition-transform">
                <svg className="w-5 h-5 text-nhs-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">AI question prompts</h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                Generate patient-friendly questions to help staff gather the information they need to follow the instructions for each symptom.
              </p>
            </div>

            <div ref={register} className="group bg-gradient-to-br from-slate-50 to-white p-7 rounded-2xl shadow-sm border border-gray-100 transition-all duration-300 hover:shadow-md hover:border-gray-200 lg:hover:-translate-y-0.5">
              <div className="w-11 h-11 bg-gradient-to-br from-nhs-dark-blue/15 to-nhs-dark-blue/5 rounded-xl flex items-center justify-center mb-5 group-hover:scale-105 transition-transform">
                <svg className="w-5 h-5 text-nhs-dark-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Smart symptom updates</h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                Stay current with centrally maintained content and automatic improvements as new guidance evolves.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Coming soon: Daily Dose */}
      <section className="py-14 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto bg-white p-8 rounded-2xl shadow-sm border border-gray-100 overflow-hidden relative">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-nhs-yellow to-nhs-yellow/50" />
            <div className="flex items-start gap-3">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-nhs-yellow/15 text-amber-700 whitespace-nowrap mt-0.5">
                Coming soon
              </span>
              <div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Daily Dose</h3>
                <p className="text-gray-600 leading-relaxed">
                  Short, role-appropriate learning cards built from real practice workflows — designed to support confidence and consistency. Daily Dose will be offered as an optional module.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Why Practices Choose the Signposting Toolkit */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">Why practices choose the Signposting Toolkit</h2>
            <p className="mt-4">
              <Link
                href="/why-signposting-toolkit"
                className="text-base text-nhs-blue hover:text-nhs-dark-blue font-medium underline underline-offset-2"
              >
                Learn more about why practices choose us
              </Link>
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 max-w-6xl mx-auto mb-14">
            {[
              {
                icon: (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                ),
                title: 'Built and clinically governed by real GPs',
                description: 'Developed at Ide Lane Surgery in Exeter, used daily by real reception teams.',
              },
              {
                icon: (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                ),
                title: 'Fully configurable to your local pathways',
                description: 'Not a generic national template — every surgery keeps full local clinical sign-off.',
              },
              {
                icon: (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                ),
                title: 'Full audit trail of signposting activity',
                description: 'Complete tracking of usage, approvals, and suggestions for governance.',
              },
              {
                icon: (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                ),
                title: 'Onboarding and support',
                description: 'Guided setup and practical support — built by a working NHS practice team.',
              },
              {
                icon: (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                ),
                title: 'Works in the browser on any PC',
                description: 'No installation required — accessible from any device with a modern browser.',
              },
            ].map((feature) => (
              <div key={feature.title} className="flex items-start space-x-4">
                <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-nhs-blue/10 to-nhs-blue/5 rounded-xl flex items-center justify-center">
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

          {/* Comparison Table */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-12">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gradient-to-r from-gray-50 to-white border-b border-gray-200">
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 w-1/4">Feature</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-nhs-blue w-2/4">Signposting Toolkit</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-400 w-2/4">Other Toolkits</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {[
                    {
                      feature: 'Clinical Governance',
                      ours: 'Built-in clinical sign-off and audit trail',
                      theirs: 'Vendor pre-approved content, limited local control.',
                    },
                    {
                      feature: 'Customisation',
                      ours: 'Editable symptoms, local overrides & highlight rules',
                      theirs: 'Basic edits within fixed structure.',
                    },
                    {
                      feature: 'Technology',
                      ours: 'Built using modern, sustainable technology with secure cloud hosting.',
                      theirs: 'Uses older web frameworks with limited flexibility.',
                    },
                    {
                      feature: 'Audit & Security',
                      ours: 'Role-based access, secure data model, no patient-identifiable information stored.',
                      theirs: 'Limited role differentiation.',
                    },
                    {
                      feature: 'Optional tools for clarity and training',
                      ours: 'Optional AI-assisted editing and suggested questions (review before use; can be disabled)',
                      theirs: 'Manual editing only.',
                    },
                  ].map((row, i) => (
                    <tr key={row.feature} ref={register} className={i % 2 === 1 ? 'bg-gray-50/50' : ''}>
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">{row.feature}</td>
                      <td className="px-6 py-4 text-sm text-gray-700">{row.ours}</td>
                      <td className="px-6 py-4 text-sm text-gray-400">{row.theirs}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="text-center">
            <p className="text-base text-gray-600 mb-8">
              For further information or to discuss pricing and onboarding options, please contact{' '}
              <a
                href="mailto:contact@signpostingtool.co.uk"
                className="text-nhs-blue hover:text-nhs-dark-blue font-medium underline underline-offset-2"
              >
                contact@signpostingtool.co.uk
              </a>
              .
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Link
                href="/demo-request"
                className="inline-flex items-center px-8 py-3 text-base font-semibold rounded-lg text-white bg-nhs-blue hover:bg-nhs-dark-blue focus:outline-none focus:ring-2 focus:ring-nhs-blue focus:ring-offset-2 transition-colors shadow-sm"
              >
                Request a Demo
              </Link>
              <Link
                href={appEntryUrl}
                className="inline-flex items-center px-8 py-3 text-base font-semibold rounded-lg text-gray-700 bg-white border border-gray-300 hover:border-gray-400 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-nhs-blue focus:ring-offset-2 transition-colors"
              >
                Launch Toolkit
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Inside the platform link */}
      <section className="py-12 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <Link
              href="/inside-the-platform"
              className="text-base text-gray-600 hover:text-nhs-blue font-medium underline underline-offset-2 inline-flex items-center gap-1.5 transition-colors"
            >
              See what the platform looks like
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        </div>
      </section>

      {/* Trust section */}
      <section className="py-20 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-gradient-to-br from-slate-50 to-white rounded-2xl shadow-sm border border-gray-100 p-10">
            <h2 className="text-2xl font-bold text-gray-900 mb-5 text-center">Built by GPs for GPs</h2>
            <div className="space-y-3 text-center text-gray-600">
              <p className="text-lg">
                Developed at Ide Lane Surgery in Exeter
              </p>
              <p className="text-base">
                Used daily by reception and care navigation teams
              </p>
              <p className="text-base">
                Designed so each surgery keeps full local clinical sign-off
              </p>
            </div>
            <div className="mt-6 flex justify-center">
              <img
                src="/images/logo.png"
                alt="Ide Lane Surgery logo"
                className="h-10 w-auto opacity-80"
              />
            </div>
          </div>
        </div>
      </section>

      {/* CTA Banner */}
      <section className="bg-gradient-to-r from-nhs-dark-blue to-nhs-blue py-16">
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
              Request a Demo
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
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-8">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-amber-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-lg font-medium text-amber-800">Disclaimer &amp; Governance</h3>
                <div className="mt-2 text-sm text-amber-700">
                  <p className="mb-2">
                    This toolkit is provided for informational purposes only and should not replace
                    professional medical advice, diagnosis, or treatment. Always seek the advice of
                    qualified health professionals with any questions you may have regarding medical conditions.
                  </p>
                  <p className="mb-2">
                    <strong>Use at your own risk:</strong> This tool is designed to assist healthcare
                    admin teams but requires local clinical sign-off before implementation.
                    Each practice should review and validate all guidance before use.
                  </p>
                  <p>
                    The developers and Ide Lane Surgery accept no responsibility for any decisions
                    made based on the information provided by this toolkit.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <MarketingFooter />
    </div>
  )
}
