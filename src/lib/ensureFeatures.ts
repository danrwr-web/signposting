import 'server-only'
import { prisma } from '@/lib/prisma'

export interface FeatureDefinition {
  key: string
  name: string
  description?: string
}

const DEFAULT_FEATURES: FeatureDefinition[] = [
  {
    key: 'ai_instructions',
    name: 'AI instruction editor',
    description: 'Allow staff to generate and improve signposting instructions with AI.',
  },
  {
    key: 'ai_training',
    name: 'AI question prompts',
    description: 'Show AI-generated, patient-friendly questions to help staff gather the information they need to follow the instructions for each symptom.',
  },
  {
    key: 'ai_surgery_customisation',
    name: 'AI surgery-specific customisation',
    description: 'Allow AI to rewrite symptom instructions based on the surgery onboarding profile.',
  },
  {
    key: 'ai_handbook_visuals',
    name: 'AI Handbook smart visuals',
    description:
      'Allow Practice Handbook editors to generate AI visual layouts of handbook pages, giving staff a scannable infographic-style view alongside the standard page.',
  },
  {
    key: 'ai_symptom_visuals',
    name: 'AI symptom smart visuals',
    description:
      'Allow practice admins to generate AI visual layouts of a symptom’s triage instructions. Saved visuals are only shown to staff once the symptom has passed clinical review.',
  },
  {
    key: 'workflow_guidance',
    name: 'Workflow guidance',
    description: 'Enable document workflow guidance for reception and care navigation teams.',
  },
  {
    key: 'admin_toolkit',
    name: 'Practice Handbook',
    description: 'Enable the Practice Handbook module (practice guidance pages, lists, rota and pinned panel).',
  },
  {
    key: 'hide_age_bands',
    name: 'Hide age bands',
    description:
      'Remove the Under-5 / 5–17 / Adult filter and age badges for this surgery. Symptoms describe age-specific advice within a single entry.',
  },
]

/**
 * Ensure that the default features exist in the database.
 * This should be called on server start or first admin page load.
 */
export async function ensureFeatures(): Promise<void> {
  for (const f of DEFAULT_FEATURES) {
    await prisma.feature.upsert({
      where: { key: f.key },
      update: {
        name: f.name,
        description: f.description,
      },
      create: {
        key: f.key,
        name: f.name,
        description: f.description || null,
      },
    })
  }
}

