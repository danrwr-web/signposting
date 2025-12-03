'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useScrollReveal } from '@/hooks/useScrollReveal'

export default function LandingPageClient() {
  const [showDonationTooltip, setShowDonationTooltip] = useState(false)
  const { register } = useScrollReveal()

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center space-x-4">
              {/* Logo */}
              <img 
                src="/images/logo.png" 
                alt="Signposting Toolkit Logo" 
                className="h-16 w-auto"
              />
              <p className="text-2xl font-bold text-gray-900">
                Signposting Toolkit
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <button
                className="relative px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                onMouseEnter={() => setShowDonationTooltip(true)}
                onMouseLeave={() => setShowDonationTooltip(false)}
              >
                Support development
                {showDonationTooltip && (
                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 text-sm text-white bg-gray-800 rounded-md whitespace-nowrap">
                    Coming soon
                    <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-800"></div>
                  </div>
                )}
              </button>
              <Link
                href="/login"
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                Launch Toolkit
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="bg-blue-50 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
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
          <div className="text-center">
            <h1 className="text-4xl font-bold text-gray-900 sm:text-5xl md:text-6xl">
              Helping reception and care navigation teams send patients to the right place — first time.
            </h1>
            <p className="text-lg text-gray-600 mt-4 max-w-3xl mx-auto">
              A ready-to-use GP care navigation software toolkit for primary care admin teams — with over 200 preloaded symptoms, clear guidance, and optional AI tools for improving clarity and training.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Link
                href="/login"
                className="inline-flex items-center px-8 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                Launch Toolkit
              </Link>
              <a
                href="#how-it-works"
                className="inline-flex items-center px-8 py-3 border border-gray-300 text-base font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                See how it works
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Promotional video section */}
      <section className="bg-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-6">
            <h2 className="text-3xl font-bold text-gray-900">
              See the Signposting Toolkit in action
            </h2>
            <p className="mt-4 text-lg text-gray-600 max-w-3xl mx-auto">
              A one-minute walkthrough showing how reception teams use the toolkit for triage support in real life.
            </p>
          </div>
          <div className="max-w-4xl mx-auto mt-8">
            <div className="w-full max-w-4xl mx-auto rounded-lg shadow-lg aspect-video overflow-hidden">
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

      {/* AI-Enabled Section */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900">AI-Enabled</h2>
          </div>
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
            <div ref={register} className="bg-gray-50 p-6 rounded-lg">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">AI instruction editor</h3>
              <p className="text-gray-600">
                Instantly improve clarity and tone. Generate clearer, patient-friendly instructions — ready for review before publishing.
              </p>
            </div>

            <div ref={register} className="bg-gray-50 p-6 rounded-lg">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">AI question prompts</h3>
              <p className="text-gray-600">
                Generate patient-friendly questions to help staff gather the information they need to follow the instructions for each symptom.
              </p>
            </div>

            <div ref={register} className="bg-gray-50 p-6 rounded-lg">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Smart symptom updates</h3>
              <p className="text-gray-600">
                Stay current with centrally maintained content and automatic improvements as new guidance evolves.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* What it does section */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-gray-900">What it does</h2>
          </div>
          
          <div className="mt-12 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
            <div ref={register} className="bg-gray-50 p-6 rounded-lg">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Comprehensive symptom library</h3>
              <p className="text-gray-600">
                Over 200 symptoms pre-loaded, all standardised and editable for your practice — making the signposting tool easy to tailor.
              </p>
            </div>

            <div ref={register} className="bg-gray-50 p-6 rounded-lg">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Local customisation</h3>
              <p className="text-gray-600">
                Adapt shared wording to reflect your local processes and services.
              </p>
            </div>

            <div ref={register} className="bg-gray-50 p-6 rounded-lg">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Simple daily workflow</h3>
              <p className="text-gray-600">
                Designed for fast use at the front desk, with colour-coded urgency, plain-English instructions, and a dependable primary care workflow.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How it works section */}
      <section id="how-it-works" className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900">How it works in practice</h2>
          </div>
          
          <div className="mt-12 space-y-8 max-w-3xl mx-auto">
            <div ref={register} className="flex items-start">
              <div className="flex-shrink-0 w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-xl">
                1
              </div>
              <div className="ml-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Set up once</h3>
                <p className="text-gray-600">
                  Choose which symptoms your team uses.
                </p>
              </div>
            </div>

            <div ref={register} className="flex items-start">
              <div className="flex-shrink-0 w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-xl">
                2
              </div>
              <div className="ml-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Reception uses it daily</h3>
                <p className="text-gray-600">
                  Always the latest, approved guidance.
                </p>
              </div>
            </div>

            <div ref={register} className="flex items-start">
              <div className="flex-shrink-0 w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-xl">
                3
              </div>
              <div className="ml-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Improve over time</h3>
                <p className="text-gray-600">
                  Add local notes or use AI to refine clarity.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Personalisation section */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
            <div className="bg-white p-8 rounded-lg shadow-sm">
              <p className="text-gray-700 text-lg">
                Choose from the shared library or add your own symptoms. Every surgery can shape the toolkit around its own services.
              </p>
            </div>

            <div className="bg-white p-8 rounded-lg shadow-sm">
              <p className="text-gray-700 text-lg">
                Built for every team member — from reception to clinical admin — with clear, consistent language and easy navigation.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Why Practices Choose the Signposting Toolkit */}
      <section className="py-16 bg-blue-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900">Why Practices Choose the Signposting Toolkit</h2>
            <p className="mt-4 text-lg text-gray-600 max-w-3xl mx-auto">
              Developed in a working NHS practice, the Signposting Toolkit is trusted by teams who want clarity, speed, and confidence when helping patients find the right care.
            </p>
          </div>
          
          {/* Comparison Table */}
          <div className="bg-white rounded-lg shadow-sm overflow-hidden mb-8">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 w-1/4">Feature</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-blue-600 w-2/4">Signposting Toolkit</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600 w-2/4">Other Toolkits</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  <tr ref={register}>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">Clinical Governance</td>
                    <td className="px-6 py-4 text-sm text-gray-700">Built-in clinical sign-off and audit trail</td>
                    <td className="px-6 py-4 text-sm text-gray-700">Vendor pre-approved content, limited local control.</td>
                  </tr>
                  <tr ref={register} className="bg-gray-50">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">Customisation</td>
                    <td className="px-6 py-4 text-sm text-gray-700">Editable symptoms, local overrides & highlight rules</td>
                    <td className="px-6 py-4 text-sm text-gray-700">Basic edits within fixed structure.</td>
                  </tr>
                  <tr ref={register}>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">Technology</td>
                    <td className="px-6 py-4 text-sm text-gray-700">Built using modern, sustainable technology with secure cloud hosting.</td>
                    <td className="px-6 py-4 text-sm text-gray-700">Uses older web frameworks with limited flexibility.</td>
                  </tr>
                  <tr ref={register} className="bg-gray-50">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">Audit & Security</td>
                    <td className="px-6 py-4 text-sm text-gray-700">Role-based access, secure data model, no patient-identifiable information stored.</td>
                    <td className="px-6 py-4 text-sm text-gray-700">Limited role differentiation.</td>
                  </tr>
                  <tr ref={register}>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">AI support for clarity and training</td>
                    <td className="px-6 py-4 text-sm text-gray-700">✓ AI-powered instruction editor and training mode</td>
                    <td className="px-6 py-4 text-sm text-gray-700">Manual editing only.</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="text-center mb-8">
            <p className="text-base text-gray-700 mb-6">
              For further information or to discuss pricing and onboarding options, please contact{' '}
              <a 
                href="mailto:d.webber-rookes2@nhs.net" 
                className="text-blue-600 hover:text-blue-700 font-medium underline"
              >
                d.webber-rookes2@nhs.net
              </a>
              .
            </p>
            <Link
              href="/login"
              className="inline-flex items-center px-8 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              Launch Toolkit
            </Link>
          </div>
        </div>
      </section>

      {/* Disclaimer section */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-8">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-lg font-medium text-yellow-800">Disclaimer & Governance</h3>
                <div className="mt-2 text-sm text-yellow-700">
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

      {/* Footer */}
      <footer className="py-8 text-center text-sm text-gray-500">
        <p>
          © {new Date().getFullYear()} The Signposting Toolkit · Built by GPs for GPs and their care navigators
        </p>
        <p>
          <a href="/privacy" className="text-blue-600 hover:text-blue-700 underline">Privacy & Cookies</a>{' '}
          · Contact:{' '}
          <a href="mailto:d.webber-rookes2@nhs.net" className="text-blue-600 underline">d.webber-rookes2@nhs.net</a>
        </p>
      </footer>
    </div>
  )
}
