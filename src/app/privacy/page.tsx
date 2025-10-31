import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Privacy & Cookies — Signposting Toolkit',
}

export default function PrivacyPage() {
  return (
    <div>
      {/* Branded header */}
      <section className="bg-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-3xl font-bold text-gray-900">Privacy and Cookies</h1>
          <p className="text-base text-gray-600 text-center max-w-2xl mx-auto mt-4">
            The Signposting Toolkit is developed and maintained by Ide Lane Surgery. This page explains how we handle staff user data and cookies when you use the Toolkit.
          </p>
        </div>
      </section>

      {/* Main content */}
      <main className="max-w-3xl mx-auto px-6 py-12 text-gray-700">
        <section>
          <h2 className="text-xl font-semibold text-gray-900 mt-0 mb-3">Who we are</h2>
          <p className="text-base leading-relaxed text-gray-700">
            The Signposting Toolkit is a digital signposting platform developed and maintained by Ide Lane Surgery, led by Dr Daniel Webber-Rookes. It is designed to support GP practices and their care navigation teams in directing patients safely and efficiently to the right service.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">What information we collect</h2>
          <p className="text-base leading-relaxed text-gray-700">
            When using the Toolkit, we collect limited personal information about staff users, including their name, email address, and usage activity (such as which symptoms were viewed or approved). This information is used solely for authentication, audit, and governance.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">Why we collect this information</h2>
          <p className="text-base leading-relaxed text-gray-700">We use this data to:</p>
          <ul className="list-disc pl-6 space-y-1 text-base leading-relaxed text-gray-700">
            <li>manage secure login and user roles;</li>
            <li>record who has approved or updated clinical content;</li>
            <li>maintain an audit trail for information governance purposes; and</li>
            <li>evidence safe care navigation and local clinical sign-off.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">Lawful basis</h2>
          <p className="text-base leading-relaxed text-gray-700">
            Processing is carried out under the lawful basis of <em>legitimate interests</em> — to enable safe, auditable use of the Toolkit within participating GP practices.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">Data storage and security</h2>
          <p className="text-base leading-relaxed text-gray-700">
            All data is stored securely in the cloud using encrypted connections. The Toolkit does not store any patient-identifiable information or clinical records.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">Data retention</h2>
          <p className="text-base leading-relaxed text-gray-700">
            User and audit data are retained for as long as required for operational and governance purposes by Ide Lane Surgery and participating practices, and may be securely deleted when no longer required.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">Cookies</h2>
          <p className="text-base leading-relaxed text-gray-700">
            This site uses only essential cookies required for secure login sessions. We do not use analytics, advertising, or tracking cookies. By using the Toolkit, you agree to the use of these essential cookies.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">Contact</h2>
          <p className="text-base leading-relaxed text-gray-700">For any privacy or data protection queries, please contact:</p>
          <p className="text-base leading-relaxed text-gray-700">
            Email: <a href="mailto:d.webber-rookes2@nhs.net" className="text-blue-600 hover:text-blue-700 underline">d.webber-rookes2@nhs.net</a>
          </p>
        </section>

        {/* Back link */}
        <div className="text-center mt-12">
          <Link href="/" className="text-blue-600 hover:text-blue-700 underline font-medium">
            Back to the Signposting Toolkit
          </Link>
        </div>
      </main>

      {/* Footer (reused markup from landing page) */}
      <footer className="py-8 text-center text-sm text-gray-500">
        <p>
          © {new Date().getFullYear()} The Signposting Toolkit · Built by GPs for GPs and their care navigators
        </p>
        <p>
          <a href="/privacy" className="text-blue-600 hover:text-blue-700 underline">Privacy & Cookies</a>{' '}
          · Contact{' '}
          <a href="mailto:d.webber-rookes2@nhs.net" className="text-blue-600 underline">d.webber-rookes2@nhs.net</a>
        </p>
      </footer>
    </div>
  )
}


