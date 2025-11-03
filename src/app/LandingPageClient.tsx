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
              <h1 className="text-2xl font-bold text-gray-900">
                Signposting Toolkit
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              <button
                className="relative px-4 py-2 text-sm font-medium text-gray-500 bg-transparent border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                aria-disabled="false"
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
          <div className="text-center">
            <h1 className="text-4xl font-bold text-gray-900 sm:text-5xl md:text-6xl">
              Helping reception and care navigation teams send patients to the right place — first time.
            </h1>
            <p className="text-lg text-gray-600 mt-4 max-w-3xl mx-auto">
              A ready-to-use toolkit for primary care admin teams — with over 200 preloaded symptoms and optional AI tools for clearer instructions and staff training.
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

      {/* What's New / AI-Enabled Section */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900">AI-Enabled Features</h2>
            <p className="mt-4 text-lg text-gray-600">
              New AI tools to help your team deliver clearer guidance
            </p>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div ref={register} className="bg-blue-50 p-6 rounded-lg border border-blue-100">
              <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">AI instruction editor</h3>
              <p className="text-gray-600">
                Take an existing instruction and generate a clearer, plain-English version. Superusers and admins can review before publishing.
              </p>
            </div>

            <div ref={register} className="bg-blue-50 p-6 rounded-lg border border-blue-100">
              <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">AI explanation & training mode</h3>
              <p className="text-gray-600">
                Turn a rule into staff-friendly guidance — why it exists, what to ask, and common pitfalls.
              </p>
            </div>

            <div ref={register} className="bg-blue-50 p-6 rounded-lg border border-blue-100">
              <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Per-surgery feature control</h3>
              <p className="text-gray-600">
                Enable AI for a whole practice or selected users with the new Features tab.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* What it does section */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-gray-900">What it does</h2>
            <p className="mt-4 text-lg text-gray-600">
              Our toolkit helps healthcare admin teams provide accurate, consistent guidance to patients
            </p>
          </div>
          
          <div className="mt-12 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
            <div ref={register} className="bg-white p-6 rounded-lg shadow-sm">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Smart Symptom Library</h3>
              <p className="text-gray-600">
                Over 200 symptoms out of the box, ready for customisation by each practice.
              </p>
            </div>

            <div ref={register} className="bg-white p-6 rounded-lg shadow-sm">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Practice-specific wording</h3>
              <p className="text-gray-600">
                Override shared content with local processes or Pharmacy First messaging.
              </p>
            </div>

            <div ref={register} className="bg-white p-6 rounded-lg shadow-sm">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Admin dashboard</h3>
              <p className="text-gray-600">
                Manage users, feature flags (AI), and visibility settings — all in one place.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How it works section */}
      <section id="how-it-works" className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900">How it works in practice</h2>
          </div>
          
          <div className="mt-12 grid grid-cols-1 gap-8 md:grid-cols-3">
            <div ref={register} className="text-center">
              <div className="flex items-center justify-center w-16 h-16 mx-auto mb-4 bg-blue-100 rounded-full">
                <span className="text-2xl font-bold text-blue-600">1</span>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Set up your surgeries</h3>
              <p className="text-gray-600">
                Choose which symptoms to use or hide.
              </p>
            </div>

            <div ref={register} className="text-center">
              <div className="flex items-center justify-center w-16 h-16 mx-auto mb-4 bg-blue-100 rounded-full">
                <span className="text-2xl font-bold text-blue-600">2</span>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Daily use by reception team</h3>
              <p className="text-gray-600">
                Always sees up-to-date guidance.
              </p>
            </div>

            <div ref={register} className="text-center">
              <div className="flex items-center justify-center w-16 h-16 mx-auto mb-4 bg-blue-100 rounded-full">
                <span className="text-2xl font-bold text-blue-600">3</span>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Optionally enable AI</h3>
              <p className="text-gray-600">
                Superusers can activate AI tools for training or wording improvements.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Personalisation section */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-gray-900">Personalise it for your practice</h2>
          </div>
          
          <div className="mt-12 grid grid-cols-1 gap-8 lg:grid-cols-2">
            <div className="bg-white p-8 rounded-lg shadow-sm">
              <h3 className="text-xl font-semibold text-gray-900 mb-4">Customise your symptom library</h3>
              <p className="text-gray-600">
                Pick from the shared symptom library, add your own, or modify the local version — while keeping a clean view of base content.
              </p>
            </div>

            <div className="bg-white p-8 rounded-lg shadow-sm">
              <h3 className="text-xl font-semibold text-gray-900 mb-4">Control access and features</h3>
              <p className="text-gray-600">
                Control who sees what — from everyday users to superusers. Feature-level toggles let you enable AI per user or per surgery.
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
              Developed in a live NHS practice and now enhanced with AI support and a 200+ symptom library.
            </p>
          </div>
          <p className="text-base text-gray-700 max-w-3xl mx-auto mb-8">
            The Signposting Toolkit supports reception workflow, GP triage, Pharmacy First and self-care routing, and continuity of care. Each pathway is locally approved by a senior clinician, with an audit trail and clinical sign-off so practices can evidence safe care navigation.
          </p>
          <p className="text-base text-gray-700 max-w-3xl mx-auto mb-8" ref={register}>
            The Toolkit is already being used in live GP practice settings. Ide Lane Surgery is currently the highest referrer to Pharmacy First in Devon, and this approach supports safe diversion of same-day demand away from GP appointments.
          </p>
          
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
