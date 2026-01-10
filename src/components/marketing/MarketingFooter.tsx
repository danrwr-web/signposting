'use client'

import Link from 'next/link'

type MarketingFooterProps = {
  showRequestDemoLink?: boolean
  showSupportDevelopmentText?: boolean
}

export default function MarketingFooter({
  showRequestDemoLink = true,
  showSupportDevelopmentText = true,
}: MarketingFooterProps) {
  return (
    <footer className="py-12 bg-white border-t border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center text-sm text-gray-500 space-y-2">
          <p>
            © {new Date().getFullYear()} The Signposting Toolkit · Built by GPs for GPs and their
            care navigators
          </p>
          <p>
            <Link href="/privacy" className="text-blue-600 hover:text-blue-700 underline">
              Privacy & Cookies
            </Link>{' '}
            ·{' '}
            <Link href="/faqs" className="text-blue-600 hover:text-blue-700 underline">
              FAQs
            </Link>{' '}
            {showRequestDemoLink && (
              <>
                ·{' '}
                <Link href="/demo-request" className="text-blue-600 hover:text-blue-700 underline">
                  Request a demo
                </Link>{' '}
              </>
            )}
            · Contact:{' '}
            <a href="mailto:contact@signpostingtool.co.uk" className="text-blue-600 underline">
              contact@signpostingtool.co.uk
            </a>
            {showSupportDevelopmentText && (
              <>
                {' '}
                · <span className="text-gray-400">Support development</span>
              </>
            )}
          </p>
        </div>
      </div>
    </footer>
  )
}

