import type { Metadata } from 'next'
import Link from 'next/link'
import MarketingHeader from '@/components/marketing/MarketingHeader'
import MarketingFooter from '@/components/marketing/MarketingFooter'
import Accordion, { type AccordionItem } from '@/components/marketing/Accordion'

export const metadata: Metadata = {
  metadataBase: new URL('https://www.signpostingtool.co.uk'),
  title: 'FAQs — Signposting Toolkit',
  description:
    'Answers about the Signposting Toolkit, including setup, pricing, governance, data protection and optional AI.',
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
    id: 'platform-setup',
    title: 'The platform and setup',
    items: [
      {
        id: 'included',
        question: 'What is included?',
        answer:
          'The platform has four modules: Signposting for symptom and care-navigation guidance; Appointment Directory for checking which appointments each staff type can book; Workflow Guidance for practice processes; and Practice Handbook for local reference information. Module availability is agreed with each practice.',
      },
      {
        id: 'setup-time',
        question: 'How long does it take to get set up?',
        answer:
          'The technical account setup is quick. The important part is the local review. As a guide, two clinicians reviewing the library of more than 200 symptoms together should allow about one session each. This gives them time to agree local wording, appointment types and pathways before the wider team starts using it.',
      },
      {
        id: 'it-support',
        question: 'Do we need IT support to install it?',
        answer:
          'No. The toolkit is web-based and works in a standard browser, so there is no local software to install for day-to-day use.',
      },
      {
        id: 'customise',
        question: 'Can we customise it to match how our practice works?',
        answer:
          'Yes. Authorised staff can tailor wording, appointment types, local pathways, workflows and handbook content. Practices can also choose which symptoms and modules are available to their team.',
      },
      {
        id: 'price',
        question: 'How much does it cost?',
        answer:
          'Our current early-adopter price is £0.07 per registered patient per year. We confirm availability, module scope and the practical details during the demo and proposal.',
      },
    ],
  },
  {
    id: 'governance-privacy',
    title: 'Governance, privacy and security',
    items: [
      {
        id: 'clinical-content',
        question: 'Who is responsible for the clinical content?',
        answer:
          'Each practice remains responsible for its live local wording and for deciding who may review or approve it. The toolkit provides content states, review dates and an audit trail to support that process.',
      },
      {
        id: 'review-workflow',
        question: 'How does the clinical review workflow work?',
        answer:
          'Content can be held as pending review until an authorised reviewer approves it. Review dates help practices plan re-review, and changes made manually or with optional AI tools return symptom content to the review workflow before it is used live.',
      },
      {
        id: 'patient-data',
        question: 'Does the toolkit store patient data?',
        answer:
          'The toolkit is not designed to hold patient records or patient-identifiable information. Staff should not enter it into local guidance, free-text fields, feedback, suggestions or optional AI tools. The platform does process limited staff account, activity and governance data so it can provide secure access and an audit trail.',
      },
      {
        id: 'dpia-required',
        question: 'Do we need to complete a Data Protection Impact Assessment (DPIA)?',
        answer:
          'Each organisation is responsible for screening its planned use and documenting the decision. The fact that the toolkit is not intended to process patient-identifiable information reduces the data protection risk, but it does not by itself decide whether a DPIA is needed. Your review should consider staff account and activity data, governance reporting and any optional AI features you plan to enable. We provide a Data Processing Agreement and technical information to support the assessment; your DPO or Caldicott Guardian can advise on the final position.',
      },
      {
        id: 'mhra-medical-device',
        question: 'Is the Signposting Toolkit a medical device?',
        answer:
          'The toolkit is intended as a care-navigation and operational support tool for practice staff. It presents practice-approved guidance and does not diagnose, recommend treatment or risk-stratify an individual patient. On that intended-use basis, we do not market it as a medical device. We keep the position under review as the product develops, and each organisation should consider whether its own planned use changes that assessment.',
      },
      {
        id: 'practice-access-privacy',
        question: 'Who can access our practice content and data?',
        answer:
          'Content and users are scoped to the relevant surgery, so another practice cannot access your local material. Role-based permissions control what staff and administrators can see or change. Access by the Signposting support team is limited to authorised people and used only where needed for support, maintenance or an agreed change.',
      },
      {
        id: 'hosting-security',
        question: 'Where is the platform hosted?',
        answer:
          'The web application is hosted on Vercel and the database service is provided by Neon. Optional AI requests are processed through Microsoft Azure OpenAI when those features are used. Secure connections, role-based access and tenant separation are built into the service. More detailed information is available for your information governance review.',
      },
    ],
  },
  {
    id: 'optional-ai',
    title: 'Optional AI',
    items: [
      {
        id: 'uses-ai',
        question: 'What is AI used for?',
        answer:
          'Authorised administrators can use optional tools to help draft clearer instructions, suggest questions or create a simple visual. AI is not used to make decisions about an individual patient.',
      },
      {
        id: 'ai-information',
        question: 'What information is sent to the AI service?',
        answer:
          'Only the content and local context selected by an authorised administrator for that task are sent from the server to Microsoft Azure OpenAI. Patient-identifiable information should never be entered. The resulting text or visual is returned to the toolkit as a draft for local review.',
      },
      {
        id: 'ai-shown-to-staff',
        question: 'Is AI content automatically shown to reception staff?',
        answer:
          'No. AI output is treated as draft content. It must go through the same local review and approval controls before it is used live.',
      },
      {
        id: 'disable-ai',
        question: 'Can we disable AI completely?',
        answer:
          'Yes. AI features are controlled separately and can be disabled for a practice.',
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
          'We provide practical onboarding help, guidance for the local review and ongoing support for questions or technical issues.',
      },
      {
        id: 'suggest-improvements',
        question: 'What if our team spots a problem or has an idea?',
        answer:
          'Staff can send feedback and suggestions from within the toolkit. You can also contact us directly if something needs a faster response.',
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

      <main>
        <section className="border-b border-slate-200 bg-slate-50">
          <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-nhs-blue">
              Questions, answered
            </p>
            <h1 className="mt-4 text-4xl font-bold tracking-tight text-slate-950 sm:text-5xl">
              Frequently asked questions
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600">
              The practical details about setup, local governance, data protection and optional AI.
            </p>
          </div>
        </section>

        <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
          <div className="space-y-12">
            {sections.map((section) => (
              <section key={section.id} aria-labelledby={section.id}>
                <h2 id={section.id} className="mb-5 text-2xl font-bold text-slate-950">
                  {section.title}
                </h2>
                <Accordion items={section.items} />
              </section>
            ))}
          </div>

          <section className="mt-14 border-t border-slate-200 pt-10">
            <h2 className="text-2xl font-bold text-slate-950">A question we haven&apos;t covered?</h2>
            <p className="mt-3 leading-7 text-slate-600">
              Email{' '}
              <a
                href="mailto:contact@signpostingtool.co.uk"
                className="font-medium text-nhs-blue underline underline-offset-2 hover:text-nhs-dark-blue"
              >
                contact@signpostingtool.co.uk
              </a>{' '}
              or book a demo and we&apos;ll talk it through.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/demo-request"
                className="inline-flex items-center justify-center rounded-md bg-nhs-blue px-5 py-2.5 text-sm font-semibold text-white hover:bg-nhs-dark-blue focus:outline-none focus:ring-2 focus:ring-nhs-blue focus:ring-offset-2"
              >
                Book a demo
              </Link>
              <a
                href="https://docs.signpostingtool.co.uk/getting-started/user-guide"
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center justify-center rounded-md border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-nhs-blue focus:ring-offset-2"
              >
                Read the User Guide
              </a>
            </div>
          </section>
        </div>
      </main>

      <MarketingFooter />
    </div>
  )
}
