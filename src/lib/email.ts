import nodemailer from 'nodemailer'

interface DemoRequestData {
  name: string
  role: string
  practice: string
  email: string
  phone?: string
  message?: string
}

export async function sendDemoRequestEmail(data: DemoRequestData): Promise<void> {
  const recipient = process.env.DEMO_REQUEST_RECIPIENT || 'contact@signpostingtool.co.uk'

  // Create transporter - use environment variables for SMTP configuration
  // For production, these should be set in Vercel environment variables
  const transporter = nodemailer.createTransport({
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

  // Build email body
  const emailBody = `
New demo request from ${data.practice}

Name: ${data.name}
Role: ${data.role}
Practice: ${data.practice}
Email: ${data.email}
${data.phone ? `Phone: ${data.phone}` : ''}
${data.message ? `\nMessage:\n${data.message}` : ''}
  `.trim()

  // Send email
  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@signpostingtool.co.uk',
    to: recipient,
    subject: `New demo request from ${data.practice}`,
    text: emailBody,
  })
}

