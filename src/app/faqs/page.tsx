import type { Metadata } from 'next'
import Link from 'next/link'
import MarketingHeader from '@/components/marketing/MarketingHeader'
import MarketingFooter from '@/components/marketing/MarketingFooter'
import Accordion, { type AccordionItem } from '@/components/marketing/Accordion'

export const metadata: Metadata = {
  metadataBase: new URL('https://www.signpostingtool.co.uk'),
  title: 'FAQs — Signposting Toolkit',
  description: 'Answers to common questions about setup, governance, and optional AI tools.',
  alternates: {
    canonical: 'https://www.signpostingtool.co.uk/faqs',
  },
}

const sections: Array<{
  id: string
  title: string
  items: AccordionItem[]
}> = [
  {
    id: 'getting-started',
    title: 'Getting started',
    items: [
      {
        id: 'setup-time',
        question: 'How long does it take to get set up?',
        answer:
          "Most practices can be up and running in a short onboarding session. We’ll help you import or configure your appointment types, review key settings, and ensure your team is comfortable using the toolkit.",
      },
      {
        id: 'it-support',
        question: 'Do we need IT support to install it?',
        answer:
          "No. The toolkit is web-based and works in a standard browser. There’s no local software to install for day-to-day use.",
      },
      {
        id: 'customise',
        question: 'Can we customise it to match how our practice works?',
        answer:
          'Yes. You can tailor wording, appointment types, local pathways, and which symptoms are enabled—so the guidance reflects your practice model.',
      },
    ],
  },
  {
    id: 'governance-safety',
    title: 'Governance & safety',
    items: [
      {
        id: 'clinical-content',
        question: 'Who is responsible for the clinical content?',
        answer:
          'Each practice is responsible for its final, live wording. The toolkit supports a clinical review workflow so content can be signed off locally and reviewed periodically.',
      },
      {
        id: 'review-workflow',
        question: 'How does the clinical review workflow work?',
        answer:
          'Symptoms can be marked as pending review until a clinician (or authorised reviewer) approves them. This provides a clear audit trail of sign-off and supports re-review cycles.',
      },
      {
        id: 'patient-data',
        question: 'Does the toolkit store patient data?',
        answer:
          'No. The toolkit is designed for guidance and routing. It does not store patient-identifiable information.',
      },
    ],
  },
  {
    id: 'ai-optional',
    title: 'AI (optional)',
    items: [
      {
        id: 'uses-ai',
        question: 'Does the toolkit use AI?',
        answer:
          'Optional tools are available to help administrators improve clarity of instructions or generate suggested questions. These features can be switched off.',
      },
      {
        id: 'ai-shown-to-staff',
        question: 'Is AI content automatically shown to reception staff?',
        answer:
          'No. Any AI-generated content is treated as draft and must be reviewed and approved locally before it can be used live.',
      },
      {
        id: 'disable-ai',
        question: 'Can we disable AI completely?',
        answer:
          'Yes. AI features are controlled with feature flags and can be disabled at practice level.',
      },
    ],
  },
  {
    id: 'support',
    title: 'Support',
    items: [
      {
        id: 'support-provide',
        question: 'What support do you provide?',
        answer:
          'We provide onboarding support and practical help to get your practice set up, plus ongoing support for questions and updates.',
      },
      {
        id: 'suggest-improvements',
        question: 'What if we want to suggest improvements or report an issue?',
        answer:
          'The toolkit includes a suggestions mechanism for continuous improvement, and you can also contact us directly.',
      },
    ],
  },
]

export default function FAQsPage() {
  const appBaseUrl =
    process.env.NEXT_PUBLIC_APP_BASE_URL?.replace(/\/$/, '') ||
    (process.env.NODE_ENV === 'development' ? '' : 'https://app.signpostingtool.co.uk')
  const appEntryUrl = appBaseUrl || '/'

  return (
    <div className="min-h-screen bg-white">
      <MarketingHeader appEntryUrl={appEntryUrl} />

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-10">
          <h1 className="text-4xl font-bold text-gray-900">FAQs</h1>
          <p className="mt-4 text-lg text-gray-700">
            Answers to common questions about setup, governance, and optional AI tools.
          </p>
          <p className="mt-4 text-sm text-gray-600">
            Looking for detailed guidance for day-to-day use?{' '}
            <a
              href="https://docs.signpostingtool.co.uk/wiki/User-Guide"
              target="_blank"
              rel="noreferrer noopener"
              className="text-blue-600 hover:text-blue-700 underline font-medium"
            >
              Read the User Guide
            </a>
            .
          </p>
        </div>

        <div className="space-y-10">
          {sections.map((section) => (
            <section key={section.id} aria-labelledby={section.id}>
              <h2 id={section.id} className="text-2xl font-bold text-gray-900 mb-4">
                {section.title}
              </h2>
              <Accordion items={section.items} />
            </section>
          ))}
        </div>

        <section className="mt-12">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-8">
            <h2 className="text-2xl font-bold text-gray-900">Still have questions?</h2>
            <p className="mt-3 text-gray-700">Get in touch and we’ll be happy to help.</p>
            <p className="mt-4">
              <a
                href="mailto:contact@signpostingtool.co.uk"
                className="text-blue-600 hover:text-blue-700 font-medium underline"
              >
                contact@signpostingtool.co.uk
              </a>
            </p>
          </div>
        </section>

        <div className="mt-10 text-center">
          <Link href="/" className="text-blue-600 hover:text-blue-700 underline font-medium">
            Back to the homepage
          </Link>
        </div>
      </main>

      <MarketingFooter />
    </div>
  )
}

