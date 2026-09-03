import type { Metadata } from 'next'
import MarketingHeader from '@/components/marketing/MarketingHeader'
import MarketingFooter from '@/components/marketing/MarketingFooter'

export const metadata: Metadata = {
  metadataBase: new URL('https://www.signpostingtool.co.uk'),
  title: 'Privacy & Cookies — Signposting Toolkit',
  description:
    'How the Signposting Toolkit handles website enquiries, staff account information, usage records and essential cookies.',
  alternates: {
    canonical: 'https://www.signpostingtool.co.uk/privacy',
  },
}

const sectionHeading = 'mt-12 text-2xl font-bold tracking-tight text-slate-950'
const paragraph = 'mt-4 leading-7 text-slate-700'
const list = 'mt-4 list-disc space-y-2 pl-6 leading-7 text-slate-700'

export default function PrivacyPage() {
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
              Your information
            </p>
            <h1 className="mt-4 text-4xl font-bold tracking-tight text-slate-950 sm:text-5xl">
              Privacy and cookies
            </h1>
            <p className="mt-5 text-lg leading-8 text-slate-600">
              This notice explains what information we use when someone visits the public website,
              contacts us, requests a demo or uses a staff account in the Signposting Toolkit.
            </p>
            <p className="mt-4 text-sm text-slate-500">Last updated: 3 September 2026</p>
          </div>
        </section>

        <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
          <section aria-labelledby="short-version" className="border-l-4 border-nhs-blue bg-blue-50 p-6">
            <h2 id="short-version" className="text-xl font-bold text-slate-950">
              The short version
            </h2>
            <ul className="mt-4 list-disc space-y-2 pl-6 leading-7 text-slate-700">
              <li>The toolkit is not intended to hold patient records or patient-identifiable information.</li>
              <li>We use limited staff and enquiry information to run, secure and support the service.</li>
              <li>The public website does not use advertising or analytics cookies.</li>
            </ul>
          </section>

          <section aria-labelledby="who-we-are">
            <h2 id="who-we-are" className={sectionHeading}>Who we are</h2>
            <p className={paragraph}>
              The Signposting Toolkit is developed and operated by Ide Lane Surgery. In this notice,
              &ldquo;we&rdquo;, &ldquo;us&rdquo; and &ldquo;our&rdquo; refer to the team responsible for the
              Signposting Toolkit service.
            </p>
          </section>

          <section aria-labelledby="information-we-use">
            <h2 id="information-we-use" className={sectionHeading}>Information we use</h2>
            <p className={paragraph}>Depending on how you interact with us, this may include:</p>
            <ul className={list}>
              <li>
                <strong>Enquiry information</strong>, such as your name, role, practice, work contact
                details and anything you include in a demo or support request.
              </li>
              <li>
                <strong>Account information</strong>, such as a staff user&apos;s name, work email,
                role and surgery membership.
              </li>
              <li>
                <strong>Usage and governance records</strong>, such as content viewed, changes,
                reviews, approvals, feedback and suggestions.
              </li>
              <li>
                <strong>Technical and security information</strong>, such as dates and times of
                access, browser or device information and security logs.
              </li>
            </ul>
          </section>

          <section aria-labelledby="patient-information">
            <h2 id="patient-information" className={sectionHeading}>Patient information</h2>
            <p className={paragraph}>
              The toolkit is a staff guidance service, not a patient record. It is not designed to
              collect patient-identifiable information. Users must not enter it into local guidance,
              free-text fields, feedback, suggestions or optional AI tools. If information is sent
              to us in error, contact us promptly so that we can investigate and take appropriate
              action.
            </p>
          </section>

          <section aria-labelledby="why-we-use-information">
            <h2 id="why-we-use-information" className={sectionHeading}>Why we use information</h2>
            <ul className={list}>
              <li>to respond to enquiries, arrange demonstrations and provide support;</li>
              <li>to create accounts, manage roles and provide secure access;</li>
              <li>to keep an audit trail of local edits, reviews and approvals;</li>
              <li>to maintain, troubleshoot and protect the service; and</li>
              <li>to understand how the toolkit is used and plan improvements.</li>
            </ul>
          </section>

          <section aria-labelledby="lawful-bases">
            <h2 id="lawful-bases" className={sectionHeading}>Our lawful bases</h2>
            <p className={paragraph}>
              The appropriate lawful basis depends on the purpose and our relationship with you. We
              may process information where it is necessary to take steps towards, or deliver, a
              service agreement; for our legitimate interests in operating, securing and improving
              the toolkit; or to meet a legal obligation. We consider the purpose and lawful basis
              before using personal information for a new purpose.
            </p>
          </section>

          <section aria-labelledby="data-roles">
            <h2 id="data-roles" className={sectionHeading}>Our role and your practice&apos;s role</h2>
            <p className={paragraph}>
              For demo, sales and support enquiries sent directly to us, Ide Lane Surgery determines
              how that information is handled. For staff account, activity and governance information
              managed as part of a subscribing practice&apos;s service, the respective responsibilities
              are set out in the service agreement and Data Processing Agreement. Please contact us
              if you need a copy for your information governance review.
            </p>
          </section>

          <section aria-labelledby="sharing-providers">
            <h2 id="sharing-providers" className={sectionHeading}>Service providers and sharing</h2>
            <p className={paragraph}>
              We use carefully selected suppliers to provide the service. These include Vercel for
              application hosting, Neon for the database service and Microsoft Azure OpenAI when an
              authorised user invokes an optional AI feature. Suppliers may only use information as
              needed to provide their contracted service and are subject to data protection terms.
            </p>
            <p className={paragraph}>
              We may also disclose information where required by law, to protect the service or to
              deal with a security incident. We do not sell personal information.
            </p>
          </section>

          <section aria-labelledby="international-transfers">
            <h2 id="international-transfers" className={sectionHeading}>International transfers</h2>
            <p className={paragraph}>
              Some suppliers may process information outside the UK. Where that happens, we use an
              appropriate UK data transfer mechanism and contractual protections. Further details
              are available in the Data Processing Agreement or on request.
            </p>
          </section>

          <section aria-labelledby="retention">
            <h2 id="retention" className={sectionHeading}>How long we keep information</h2>
            <p className={paragraph}>
              We keep personal information only for as long as it is needed for the purpose it was
              collected, including support, security, contractual and legal requirements. Enquiry
              information is reviewed when it is no longer needed. Account and audit information is
              retained in line with the relevant service agreement, Data Processing Agreement and
              any applicable legal requirements, then deleted or anonymised where appropriate.
            </p>
          </section>

          <section aria-labelledby="security">
            <h2 id="security" className={sectionHeading}>Security</h2>
            <p className={paragraph}>
              We use technical and organisational measures designed to protect information. These
              include encrypted connections, surgery-scoped data access, role-based permissions and
              controlled support access. No online service can remove every risk, so we monitor and
              review these measures as the platform changes.
            </p>
          </section>

          <section aria-labelledby="cookies">
            <h2 id="cookies" className={sectionHeading}>Cookies</h2>
            <p className={paragraph}>
              The public website does not use advertising or analytics cookies. The signed-in
              application uses strictly necessary cookies for functions such as secure sessions,
              authentication and user preferences. These cookies are needed for the service to work
              and cannot be switched off through a consent control.
            </p>
          </section>

          <section aria-labelledby="your-rights">
            <h2 id="your-rights" className={sectionHeading}>Your rights</h2>
            <p className={paragraph}>
              Depending on the circumstances, you may have rights to ask for access to your personal
              information, correction, deletion, restriction or portability, or to object to its
              use. These rights are not absolute. If your request concerns your staff account, you may
              wish to contact your employing practice first; you can also contact us using the address
              below.
            </p>
            <p className={paragraph}>
              You can also raise a concern with the{' '}
              <a
                href="https://ico.org.uk/make-a-complaint/data-protection-complaints/data-protection-complaints/"
                target="_blank"
                rel="noreferrer noopener"
                className="font-medium text-nhs-blue underline underline-offset-2 hover:text-nhs-dark-blue"
              >
                Information Commissioner&apos;s Office
              </a>
              . We would appreciate the opportunity to look into the issue first.
            </p>
          </section>

          <section aria-labelledby="contact-us">
            <h2 id="contact-us" className={sectionHeading}>Contact us</h2>
            <p className={paragraph}>
              For a privacy question, rights request or copy of our data protection documentation,
              email{' '}
              <a
                href="mailto:contact@signpostingtool.co.uk"
                className="font-medium text-nhs-blue underline underline-offset-2 hover:text-nhs-dark-blue"
              >
                contact@signpostingtool.co.uk
              </a>
              .
            </p>
          </section>

          <section aria-labelledby="changes">
            <h2 id="changes" className={sectionHeading}>Changes to this notice</h2>
            <p className={paragraph}>
              We will update this page when our use of personal information or our suppliers changes.
              The date at the top shows when the notice was last revised.
            </p>
          </section>
        </div>
      </main>

      <MarketingFooter />
    </div>
  )
}
