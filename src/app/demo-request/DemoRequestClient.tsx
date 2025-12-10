'use client'

import { useState } from 'react'
import Link from 'next/link'

interface FormErrors {
  name?: string
  role?: string
  practice?: string
  email?: string
  phone?: string
  message?: string
  general?: string
}

export default function DemoRequestClient() {
  const [formData, setFormData] = useState({
    name: '',
    role: '',
    practice: '',
    email: '',
    phone: '',
    message: '',
    website: '', // honeypot field
  })
  const [errors, setErrors] = useState<FormErrors>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setErrors({})
    setIsSubmitting(true)

    // Honeypot check - if website field is filled, silently ignore
    if (formData.website) {
      setIsSubmitting(false)
      return
    }

    try {
      const response = await fetch('/api/demo-request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name,
          role: formData.role,
          practice: formData.practice,
          email: formData.email,
          phone: formData.phone || undefined,
          message: formData.message || undefined,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        if (data.errors) {
          setErrors(data.errors)
        } else {
          setErrors({ general: data.error || 'Sorry, something went wrong while sending your request. Please try again later or email us at contact@signpostingtool.co.uk.' })
        }
        setIsSubmitting(false)
        return
      }

      // Success
      setIsSuccess(true)
    } catch (error) {
      setErrors({
        general: 'Sorry, something went wrong while sending your request. Please try again later or email us at contact@signpostingtool.co.uk.',
      })
      setIsSubmitting(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
    // Clear error for this field when user starts typing
    if (errors[name as keyof FormErrors]) {
      setErrors((prev) => {
        const newErrors = { ...prev }
        delete newErrors[name as keyof FormErrors]
        return newErrors
      })
    }
  }

  const appBaseUrl =
    process.env.NEXT_PUBLIC_APP_BASE_URL?.replace(/\/$/, '') ||
    (process.env.NODE_ENV === 'development' ? '' : 'https://app.signpostingtool.co.uk')
  const appEntryUrl = appBaseUrl || '/'

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
            <div className="flex items-center space-x-6">
              <a
                href="https://docs.signpostingtool.co.uk/wiki/User-Guide"
                target="_blank"
                rel="noreferrer noopener"
                className="text-base font-medium text-gray-700 hover:text-blue-600 transition-colors"
              >
                User Guide
              </a>
              <a
                href="https://docs.signpostingtool.co.uk/"
                target="_blank"
                rel="noreferrer noopener"
                className="text-base font-medium text-gray-700 hover:text-blue-600 transition-colors"
              >
                Docs
              </a>
              <Link
                href={appEntryUrl}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                Launch Toolkit
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Request a demo of the Signposting Toolkit
          </h1>
          <p className="text-lg text-gray-700">
            Tell us a bit about your surgery and we'll get in touch to arrange a walkthrough.
          </p>
        </div>

        {isSuccess ? (
          <div className="bg-green-50 border border-green-200 rounded-lg p-8 text-center">
            <div className="mb-4">
              <svg className="mx-auto h-12 w-12 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Thanks for your request</h2>
            <p className="text-lg text-gray-700">
              We'll get back to you within one working day to arrange a demo.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6 bg-white border border-gray-200 rounded-lg p-8">
            {errors.general && (
              <div className="bg-red-50 border border-red-200 rounded-md p-4">
                <p className="text-sm text-red-800">{errors.general}</p>
              </div>
            )}

            {/* Honeypot field */}
            <input
              type="text"
              name="website"
              value={formData.website}
              onChange={handleChange}
              tabIndex={-1}
              autoComplete="off"
              style={{ position: 'absolute', left: '-9999px' }}
              aria-hidden="true"
            />

            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                Name <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                id="name"
                name="name"
                required
                value={formData.name}
                onChange={handleChange}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  errors.name ? 'border-red-500' : 'border-gray-300'
                }`}
                aria-invalid={errors.name ? 'true' : 'false'}
                aria-describedby={errors.name ? 'name-error' : undefined}
              />
              {errors.name && (
                <p id="name-error" className="mt-1 text-sm text-red-600" role="alert">
                  {errors.name}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-1">
                Role <span className="text-red-600">*</span>
              </label>
              <select
                id="role"
                name="role"
                required
                value={formData.role}
                onChange={handleChange}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  errors.role ? 'border-red-500' : 'border-gray-300'
                }`}
                aria-invalid={errors.role ? 'true' : 'false'}
                aria-describedby={errors.role ? 'role-error' : undefined}
              >
                <option value="">Select a role</option>
                <option value="Practice Manager">Practice Manager</option>
                <option value="GP Partner">GP Partner</option>
                <option value="Care Navigation Lead">Care Navigation Lead</option>
                <option value="PCN Manager">PCN Manager</option>
                <option value="Other">Other</option>
              </select>
              {errors.role && (
                <p id="role-error" className="mt-1 text-sm text-red-600" role="alert">
                  {errors.role}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="practice" className="block text-sm font-medium text-gray-700 mb-1">
                Practice name <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                id="practice"
                name="practice"
                required
                value={formData.practice}
                onChange={handleChange}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  errors.practice ? 'border-red-500' : 'border-gray-300'
                }`}
                aria-invalid={errors.practice ? 'true' : 'false'}
                aria-describedby={errors.practice ? 'practice-error' : undefined}
              />
              {errors.practice && (
                <p id="practice-error" className="mt-1 text-sm text-red-600" role="alert">
                  {errors.practice}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                Email <span className="text-red-600">*</span>
              </label>
              <input
                type="email"
                id="email"
                name="email"
                required
                value={formData.email}
                onChange={handleChange}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  errors.email ? 'border-red-500' : 'border-gray-300'
                }`}
                aria-invalid={errors.email ? 'true' : 'false'}
                aria-describedby={errors.email ? 'email-error' : undefined}
              />
              {errors.email && (
                <p id="email-error" className="mt-1 text-sm text-red-600" role="alert">
                  {errors.email}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
                Phone
              </label>
              <input
                type="text"
                id="phone"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-1">
                Message
              </label>
              <textarea
                id="message"
                name="message"
                rows={4}
                value={formData.message}
                onChange={handleChange}
                placeholder="Anything particular you'd like to focus on?"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full px-10 py-4 border border-transparent text-lg font-semibold rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Submitting...' : 'Submit request'}
              </button>
            </div>
          </form>
        )}
      </main>

      {/* Footer */}
      <footer className="py-12 bg-white border-t border-gray-200 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center text-sm text-gray-500 space-y-2">
            <p>
              © {new Date().getFullYear()} The Signposting Toolkit · Built by GPs for GPs and their care navigators
            </p>
            <p>
              <a href="/privacy" className="text-blue-600 hover:text-blue-700 underline">Privacy & Cookies</a>{' '}
              · Contact:{' '}
              <a href="mailto:contact@signpostingtool.co.uk" className="text-blue-600 underline">contact@signpostingtool.co.uk</a>
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}

