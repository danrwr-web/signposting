import nodemailer from 'nodemailer'

interface DemoRequestData {
  name: string
  role: string
  practice: string
  email: string
  phone?: string
  message?: string
}

// SMTP configuration comes from environment variables
// (set in Vercel environment variables for production).
function createTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
    auth: process.env.SMTP_USER && process.env.SMTP_PASSWORD
      ? {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASSWORD,
        }
      : undefined,
  })
}

const FROM_ADDRESS = () =>
  process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@signpostingtool.co.uk'

export async function sendDemoRequestEmail(data: DemoRequestData): Promise<void> {
  const recipient = process.env.DEMO_REQUEST_RECIPIENT || 'contact@signpostingtool.co.uk'

  const emailBody = `
New demo request from ${data.practice}

Name: ${data.name}
Role: ${data.role}
Practice: ${data.practice}
Email: ${data.email}
${data.phone ? `Phone: ${data.phone}` : ''}
${data.message ? `\nMessage:\n${data.message}` : ''}
  `.trim()

  await createTransporter().sendMail({
    from: FROM_ADDRESS(),
    to: recipient,
    subject: `New demo request from ${data.practice}`,
    text: emailBody,
  })
}

interface SuggestionNotificationData {
  type: string
  title: string | null
  text: string
  submitterEmail: string
  surgeryName: string | null
  symptomName: string | null
  pageContext: string | null
  /** Overrides the central notify address, e.g. surgery admins for symptom-content suggestions. */
  recipients?: string[]
  /** Review link path; defaults to the central superuser triage page. */
  reviewPath?: string
}

const SUGGESTION_TYPE_LABELS: Record<string, string> = {
  FEATURE: 'feature request',
  IMPROVEMENT: 'improvement suggestion',
  BUG: 'bug report',
  SYMPTOM_CONTENT: 'symptom content suggestion',
}

export async function sendSuggestionNotificationEmail(
  data: SuggestionNotificationData
): Promise<void> {
  const recipient = data.recipients?.length
    ? data.recipients.join(', ')
    : process.env.SUGGESTION_NOTIFY_RECIPIENT ||
      process.env.DEMO_REQUEST_RECIPIENT ||
      'contact@signpostingtool.co.uk'

  const typeLabel = SUGGESTION_TYPE_LABELS[data.type] || 'suggestion'
  // On Vercel, NEXTAUTH_URL is the deployment-specific *.vercel.app URL, which
  // is behind deployment protection and 404s for email recipients — only use
  // it for local development links.
  const baseUrl = (
    process.env.NEXT_PUBLIC_APP_BASE_URL ||
    (process.env.NODE_ENV === 'development'
      ? process.env.NEXTAUTH_URL || 'http://localhost:3000'
      : 'https://app.signpostingtool.co.uk')
  ).replace(/\/$/, '')

  const emailBody = `
New ${typeLabel} submitted in the Signposting Toolkit.

From: ${data.submitterEmail}
${data.surgeryName ? `Surgery: ${data.surgeryName}` : ''}
${data.title ? `Title: ${data.title}` : ''}
${data.symptomName ? `Symptom: ${data.symptomName}` : ''}
${data.pageContext ? `Page: ${data.pageContext}` : ''}

${data.text}

Review and respond: ${baseUrl}${
    data.reviewPath ??
    `/admin/system/suggestions${data.type === 'SYMPTOM_CONTENT' ? '?type=SYMPTOM_CONTENT' : ''}`
  }
  `
    .split('\n')
    .filter((line, i, lines) => line.trim() !== '' || (i > 0 && lines[i - 1].trim() !== ''))
    .join('\n')
    .trim()

  await createTransporter().sendMail({
    from: FROM_ADDRESS(),
    to: recipient,
    subject: `New ${typeLabel}${data.surgeryName ? ` from ${data.surgeryName}` : ''}`,
    text: emailBody,
  })
}
