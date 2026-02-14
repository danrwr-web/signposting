'use client'

import Link from 'next/link'

type MarketingFooterProps = {
  showRequestDemoLink?: boolean
  showSupportDevelopmentText?: boolean
}

export default function MarketingFooter({
  showRequestDemoLink = true,
}: MarketingFooterProps) {
  return (
    <footer className="bg-gray-50 border-t border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-2 gap-8 lg:grid-cols-4">
          {/* Brand */}
          <div className="col-span-2 lg:col-span-1">
            <img
              src="/images/signposting_logo_head.png"
              alt="Signposting Toolkit"
              className="h-10 w-auto mb-4"
            />
            <p className="text-sm text-gray-600 leading-relaxed max-w-xs">
              Built by GPs for GPs and their care navigators. Safer signposting for every practice.
            </p>
          </div>

          {/* Product */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 tracking-wide mb-3">Product</h3>
            <ul className="space-y-2.5">
              <li>
                <Link
                  href="/why-signposting-toolkit"
                  className="text-sm text-gray-600 hover:text-nhs-blue transition-colors"
                >
                  Why Choose Us
                </Link>
              </li>
              <li>
                <Link
                  href="/inside-the-platform"
                  className="text-sm text-gray-600 hover:text-nhs-blue transition-colors"
                >
                  Inside the Platform
                </Link>
              </li>
              {showRequestDemoLink && (
                <li>
                  <Link
                    href="/demo-request"
                    className="text-sm text-gray-600 hover:text-nhs-blue transition-colors"
                  >
                    Request a Demo
                  </Link>
                </li>
              )}
            </ul>
          </div>

          {/* Support */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 tracking-wide mb-3">Support</h3>
            <ul className="space-y-2.5">
              <li>
                <Link
                  href="/faqs"
                  className="text-sm text-gray-600 hover:text-nhs-blue transition-colors"
                >
                  FAQs
                </Link>
              </li>
              <li>
                <a
                  href="https://docs.signpostingtool.co.uk/wiki/User-Guide"
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-sm text-gray-600 hover:text-nhs-blue transition-colors"
                >
                  User Guide
                </a>
              </li>
              <li>
                <a
                  href="https://docs.signpostingtool.co.uk/"
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-sm text-gray-600 hover:text-nhs-blue transition-colors"
                >
                  Help & Documentation
                </a>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 tracking-wide mb-3">Contact</h3>
            <ul className="space-y-2.5">
              <li>
                <a
                  href="mailto:contact@signpostingtool.co.uk"
                  className="text-sm text-gray-600 hover:text-nhs-blue transition-colors"
                >
                  contact@signpostingtool.co.uk
                </a>
              </li>
              <li>
                <Link
                  href="/privacy"
                  className="text-sm text-gray-600 hover:text-nhs-blue transition-colors"
                >
                  Privacy & Cookies
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-gray-200">
          <p className="text-center text-xs text-gray-500">
            &copy; {new Date().getFullYear()} The Signposting Toolkit. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  )
}
