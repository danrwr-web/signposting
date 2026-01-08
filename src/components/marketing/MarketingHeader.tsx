'use client'

import Link from 'next/link'

type MarketingHeaderProps = {
  appEntryUrl: string
}

export default function MarketingHeader({ appEntryUrl }: MarketingHeaderProps) {
  return (
    <header className="bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 py-6 sm:flex-row sm:items-center sm:justify-between">
          <Link href="/" className="flex items-center space-x-4">
            <img
              src="/images/signposting_logo_head.png"
              alt="Signposting Toolkit logo"
              className="h-12 w-auto sm:h-14"
            />
          </Link>

          <nav aria-label="Primary" className="flex items-center gap-x-6 gap-y-2 flex-wrap">
            <Link
              href="/why-signposting-toolkit"
              className="text-base font-medium text-gray-700 hover:text-blue-600 transition-colors"
            >
              Why Choose Us
            </Link>
            <Link
              href="/faqs"
              className="text-base font-medium text-gray-700 hover:text-blue-600 transition-colors"
            >
              FAQs
            </Link>
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
              href="/demo-request"
              className="text-base font-medium text-gray-700 hover:text-blue-600 transition-colors"
            >
              Request a Demo
            </Link>
            <Link
              href={appEntryUrl}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              Launch Toolkit
            </Link>
          </nav>
        </div>
      </div>
    </header>
  )
}

