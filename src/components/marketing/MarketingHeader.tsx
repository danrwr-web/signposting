'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

type MarketingHeaderProps = {
  appEntryUrl: string
}

const navLinks = [
  { href: '/why-signposting-toolkit', label: 'Why Choose Us' },
  { href: '/inside-the-platform', label: 'Inside the Platform' },
  { href: '/faqs', label: 'FAQs' },
  {
    href: 'https://docs.signpostingtool.co.uk/wiki/User-Guide',
    label: 'User Guide',
    external: true,
  },
  { href: '/demo-request', label: 'Request a Demo' },
]

export default function MarketingHeader({ appEntryUrl }: MarketingHeaderProps) {
  const [isScrolled, setIsScrolled] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 10)
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsMobileMenuOpen(false)
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [])

  useEffect(() => {
    document.body.style.overflow = isMobileMenuOpen ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [isMobileMenuOpen])

  return (
    <>
      <header
        className={`sticky top-0 z-50 transition-all duration-300 ${
          isScrolled
            ? 'bg-white/95 backdrop-blur-md shadow-sm border-b border-gray-100'
            : 'bg-white border-b border-gray-200'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 sm:h-[4.5rem]">
            <Link href="/" className="flex items-center space-x-3 flex-shrink-0">
              <img
                src="/images/signposting_logo_head.png"
                alt="Signposting Toolkit logo"
                className="h-10 w-auto sm:h-12"
              />
            </Link>

            {/* Desktop nav */}
            <nav aria-label="Primary" className="hidden lg:flex items-center gap-x-1">
              {navLinks.map((link) =>
                link.external ? (
                  <a
                    key={link.href}
                    href={link.href}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="px-3 py-2 text-sm font-medium text-gray-600 hover:text-nhs-blue rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    {link.label}
                  </a>
                ) : (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="px-3 py-2 text-sm font-medium text-gray-600 hover:text-nhs-blue rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    {link.label}
                  </Link>
                )
              )}
              <Link
                href={appEntryUrl}
                className="ml-3 px-5 py-2.5 text-sm font-semibold text-white bg-nhs-blue rounded-lg hover:bg-nhs-dark-blue focus:outline-none focus:ring-2 focus:ring-nhs-blue focus:ring-offset-2 transition-colors shadow-sm"
              >
                Launch Toolkit
              </Link>
            </nav>

            {/* Mobile menu button */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="lg:hidden p-2 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-nhs-blue"
              aria-expanded={isMobileMenuOpen}
              aria-label="Toggle navigation menu"
            >
              {isMobileMenuOpen ? (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              ) : (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                </svg>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile menu overlay */}
      {isMobileMenuOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm lg:hidden"
            onClick={() => setIsMobileMenuOpen(false)}
            aria-hidden="true"
          />
          <nav
            className="fixed top-16 sm:top-[4.5rem] right-0 left-0 z-50 bg-white border-b border-gray-200 shadow-lg lg:hidden"
            aria-label="Mobile navigation"
          >
            <div className="max-w-7xl mx-auto px-4 py-3 space-y-1">
              {navLinks.map((link) =>
                link.external ? (
                  <a
                    key={link.href}
                    href={link.href}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="block px-4 py-3 text-base font-medium text-gray-700 hover:text-nhs-blue hover:bg-gray-50 rounded-lg transition-colors"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    {link.label}
                  </a>
                ) : (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="block px-4 py-3 text-base font-medium text-gray-700 hover:text-nhs-blue hover:bg-gray-50 rounded-lg transition-colors"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    {link.label}
                  </Link>
                )
              )}
              <div className="pt-2 pb-1 px-4">
                <Link
                  href={appEntryUrl}
                  className="block w-full text-center px-5 py-3 text-base font-semibold text-white bg-nhs-blue rounded-lg hover:bg-nhs-dark-blue transition-colors"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  Launch Toolkit
                </Link>
              </div>
            </div>
          </nav>
        </>
      )}
    </>
  )
}
