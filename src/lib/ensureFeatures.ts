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
    key: 'workflow_guidance',
    name: 'Workflow guidance',
    description: 'Enable document workflow guidance for reception and care navigation teams.',
  },
  {
    key: 'admin_toolkit',
    name: 'Practice Handbook',
    description: 'Enable the Practice Handbook module (practice guidance pages, lists, rota and pinned panel).',
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

