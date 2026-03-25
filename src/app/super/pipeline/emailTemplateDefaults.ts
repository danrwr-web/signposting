/**
 * Default email templates for each pipeline communication stage.
 *
 * These are used to:
 * - Seed the PipelineEmailTemplate table
 * - Provide fallback content if the API fetch fails in CommsHub
 * - Power the "Reset to default" button in the Email Templates tab
 *
 * Templates use {{placeholder}} syntax. CommsHub replaces these at
 * render time with actual field values.
 */

export interface DefaultEmailTemplate {
  stage: string
  label: string
  subject: string
  body: string
  placeholders: string[]
}

export const DEFAULT_EMAIL_TEMPLATES: DefaultEmailTemplate[] = [
  {
    stage: 'enquiry',
    label: 'Enquiry Received',
    subject: 'Signposting Toolkit — Enquiry from {{practiceName}}',
    body: `Dear {{contactName}},

Thank you for your enquiry about the Signposting Toolkit. We'd love to show you how it can help your reception team at {{practiceName}} direct patients to the right service, first time.

Would you have 20 minutes for a short online demo? I'm flexible on times and happy to work around your schedule.

I look forward to hearing from you.

Kind regards,
Dan`,
    placeholders: ['{{contactName}}', '{{practiceName}}'],
  },
  {
    stage: 'demo_booked',
    label: 'Demo Booked',
    subject: 'Signposting Toolkit Demo — {{demoDate}} at {{demoTime}}',
    body: `Dear {{contactName}},

Great to speak with you. I've booked your demo for {{demoDate}} at {{demoTime}}.

I'll send a Teams invite shortly. The demo takes around 20 minutes and I'll walk through how the Signposting Toolkit works in practice, with real examples relevant to {{practiceName}}.

If you need to reschedule, just let me know.

Kind regards,
Dan`,
    placeholders: ['{{contactName}}', '{{practiceName}}', '{{demoDate}}', '{{demoTime}}'],
  },
  {
    stage: 'demo_completed',
    label: 'Demo Completed',
    subject: 'Signposting Toolkit — Proposal for {{practiceName}}',
    body: `Dear {{contactName}},

Thank you for taking the time to see the Signposting Toolkit in action. As discussed, I've attached a proposal tailored to {{practiceName}}.

Based on your list size of {{listSize}} patients, the annual fee would be £{{estimatedFee}}.

The proposal covers what's included, how onboarding works, and the timeline to get your team up and running. I'm happy to answer any questions or arrange a follow-up call.

Kind regards,
Dan`,
    placeholders: ['{{contactName}}', '{{practiceName}}', '{{listSize}}', '{{estimatedFee}}'],
  },
  {
    stage: 'proposal_sent',
    label: 'Proposal Sent',
    subject: 'Signposting Toolkit — Documents for {{practiceName}}',
    body: `Dear {{contactName}},

Following on from our proposal, I've attached the formal documents for your review:

1. SaaS Agreement
2. Data Processing Agreement (DPA)
3. Hosting & Information Governance Overview
4. IG & Security Response Pack

These cover the contractual terms, data handling, and security arrangements. Everything is designed to meet NHS IG and DTAC standards.

If you have any questions or need anything reviewed by your practice manager or Caldicott Guardian, I'm happy to help.

Kind regards,
Dan`,
    placeholders: ['{{contactName}}', '{{practiceName}}'],
  },
  {
    stage: 'documents_sent',
    label: 'Documents Sent',
    subject: 'Signposting Toolkit — Next steps for {{practiceName}}',
    body: `Dear {{contactName}},

Just checking in on the documents I sent across. Have you had a chance to review them? I'm happy to jump on a call if anything needs clarifying.

Once the agreements are signed, we can get {{practiceName}} set up and your team trained. The onboarding process typically takes around 1–2 weeks from contract start.

Looking forward to hearing from you.

Kind regards,
Dan`,
    placeholders: ['{{contactName}}', '{{practiceName}}'],
  },
  {
    stage: 'contracted',
    label: 'Contracted',
    subject: 'Welcome to the Signposting Toolkit — {{practiceName}}',
    body: `Dear {{contactName}},

Welcome aboard! I'm delighted that {{practiceName}} has chosen the Signposting Toolkit.

Your contract start date is {{contractStartDate}}. Here's what happens next:

1. I'll set up your surgery on the platform and send you admin login details
2. We'll schedule a short onboarding call to configure your practice's settings
3. I'll provide training materials for your reception team

I'll be in touch shortly with your login details. In the meantime, if you have any questions at all, don't hesitate to reach out.

Kind regards,
Dan`,
    placeholders: ['{{contactName}}', '{{practiceName}}', '{{contractStartDate}}'],
  },
]

/** Look up a default template by stage key */
export function getDefaultTemplate(stage: string): DefaultEmailTemplate | undefined {
  return DEFAULT_EMAIL_TEMPLATES.find((t) => t.stage === stage)
}

/** Map from CommsHub stage name to template stage key */
export const STAGE_TO_TEMPLATE_KEY: Record<string, string> = {
  Enquiry: 'enquiry',
  DemoBooked: 'demo_booked',
  DemoCompleted: 'demo_completed',
  ProposalSent: 'proposal_sent',
  DocumentsSent: 'documents_sent',
  Contracted: 'contracted',
}
