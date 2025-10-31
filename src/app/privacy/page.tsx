import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Privacy & Cookies — Signposting Toolkit',
}

export default function PrivacyPage() {
  return (
    <main className="max-w-3xl mx-auto px-6 py-12 text-gray-700">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Privacy and Cookies</h1>

      <section className="space-y-4 mb-8">
        <h2 className="sr-only">Who we are</h2>
        <p>
          <strong>Who we are</strong>{' '}
          The Signposting Toolkit is a digital signposting platform developed and maintained by{' '}
          <strong>Ide Lane Surgery</strong>, led by Dr Daniel Webber-Rookes. It is designed to support GP
          practices and their care navigation teams in directing patients safely and efficiently to the right
          service.
        </p>
      </section>

      <section className="space-y-4 mb-8">
        <h2 className="sr-only">What information we collect</h2>
        <p>
          <strong>What information we collect</strong>{' '}
          When using the Toolkit, we collect limited personal information about staff users, including their
          name, email address, and usage activity (such as symptom views or approvals). This information is used
          solely for authentication, audit, and governance.
        </p>
      </section>

      <section className="space-y-4 mb-8">
        <h2 className="sr-only">Why we collect this information</h2>
        <p className="mb-2"><strong>Why we collect this information</strong></p>
        <ul className="list-disc pl-6 space-y-1">
          <li>manage secure login and user roles;</li>
          <li>record who has approved or updated clinical content; and</li>
          <li>maintain an audit trail for information governance purposes.</li>
        </ul>
      </section>

      <section className="space-y-4 mb-8">
        <h2 className="sr-only">Lawful basis</h2>
        <p>
          <strong>Lawful basis</strong>{' '}
          Processing is carried out under the lawful basis of <em>legitimate interests</em> — to enable safe,
          auditable use of the Toolkit within participating GP practices.
        </p>
      </section>

      <section className="space-y-4 mb-8">
        <h2 className="sr-only">Data storage and security</h2>
        <p>
          <strong>Data storage and security</strong>{' '}
          All data is stored securely in the cloud using encrypted connections. The Toolkit does not store any
          patient-identifiable information or clinical records.
        </p>
      </section>

      <section className="space-y-4 mb-8">
        <h2 className="sr-only">Data retention</h2>
        <p>
          <strong>Data retention</strong>{' '}
          User and audit data are retained for as long as required for operational and governance purposes, after
          which they may be securely deleted.
        </p>
      </section>

      <section className="space-y-4 mb-8">
        <h2 className="sr-only">Cookies</h2>
        <p>
          <strong>Cookies</strong>{' '}
          This site uses only essential cookies required for secure login sessions. We do not use analytics,
          advertising, or tracking cookies. By using the Toolkit, you agree to the use of these essential
          cookies.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="sr-only">Contact</h2>
        <p>
          <strong>Contact</strong>{' '}
          For any privacy or data protection queries, please contact:
        </p>
        <p>
          📧{' '}
          <a href="mailto:d.webber-rookes2@nhs.net" className="text-blue-600 hover:text-blue-700 underline">
            d.webber-rookes2@nhs.net
          </a>
        </p>
      </section>
    </main>
  )
}


