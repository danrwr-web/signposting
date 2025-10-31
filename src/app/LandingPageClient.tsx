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
                Signposting Toolkit (Beta)
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              <button
                className="relative px-4 py-2 text-sm font-medium text-gray-500 bg-gray-100 rounded-md cursor-not-allowed"
                aria-disabled="true"
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
              Find the right place for care
            </h1>
            <p className="text-lg text-gray-600 mt-4 max-w-2xl mx-auto">
              A simple, safe toolkit that helps your reception and care navigation teams direct patients to the right service — with clear instructions, local clinical sign-off, and a full audit trail.
            </p>
            <p className="mt-3 text-base text-gray-700">
              Accessible anytime via browser — no installation needed for your reception team.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Link
                href="/login"
                className="inline-flex items-center px-8 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                Launch Toolkit
              </Link>
              <a
                href="mailto:d.webber-rookes2@nhs.net"
                className="inline-flex items-center px-8 py-3 border border-gray-300 text-base font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                Request a Demo
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* What it does section */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-gray-900">What it does</h2>
            <p className="mt-4 text-lg text-gray-600">
              Our toolkit helps healthcare admin teams provide accurate, consistent guidance to patients
            </p>
          </div>
          
          <div className="mt-12 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
            <div ref={register} className="bg-gray-50 p-6 rounded-lg">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Symptom Assessment</h3>
              <p className="text-gray-600">
                Quick, evidence-based symptom assessment to guide patients to appropriate care
              </p>
            </div>

            <div ref={register} className="bg-gray-50 p-6 rounded-lg">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Rapid Triage</h3>
              <p className="text-gray-600">
                Streamlined triage process that reduces wait times and improves patient outcomes
              </p>
            </div>

            <div ref={register} className="bg-gray-50 p-6 rounded-lg">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Data Insights</h3>
              <p className="text-gray-600">
                Track usage patterns and identify areas for improvement in your practice
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
            <p className="mt-4 text-lg text-gray-600 max-w-3xl mx-auto">
              Every practice is unique. Our toolkit allows you to customise symptom guidance, 
              highlight important information, and tailor the experience to your patients' needs.
            </p>
          </div>
          
          <div className="mt-12 grid grid-cols-1 gap-8 lg:grid-cols-2">
            <div className="bg-white p-8 rounded-lg shadow-sm">
              <h3 className="text-xl font-semibold text-gray-900 mb-4">Custom Symptom Guidance</h3>
              <p className="text-gray-600 mb-4">
                Override default symptom information with practice-specific guidance, 
                local contact details, and tailored instructions.
              </p>
              <ul className="text-gray-600 space-y-2">
                <li ref={register} className="flex items-center">
                  <svg className="w-5 h-5 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  Practice-specific contact information
                </li>
                <li ref={register} className="flex items-center">
                  <svg className="w-5 h-5 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  Local service availability
                </li>
                <li ref={register} className="flex items-center">
                  <svg className="w-5 h-5 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  Highlighted safety information
                </li>
              </ul>
            </div>

            <div className="bg-white p-8 rounded-lg shadow-sm">
              <h3 className="text-xl font-semibold text-gray-900 mb-4">Role-Based Access</h3>
              <p className="text-gray-600 mb-4">
                Secure, role-based access ensures the right people have the right permissions 
                to manage your practice's configuration.
              </p>
              <ul className="text-gray-600 space-y-2">
                <li ref={register} className="flex items-center">
                  <svg className="w-5 h-5 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  Practice administrators
                </li>
                <li ref={register} className="flex items-center">
                  <svg className="w-5 h-5 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  Standard users
                </li>
                <li ref={register} className="flex items-center">
                  <svg className="w-5 h-5 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  Secure user management
                </li>
              </ul>
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
              A modern, clinically governed signposting platform built by GPs for GPs and their care navigators.
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
