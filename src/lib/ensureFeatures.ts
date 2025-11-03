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
    description: 'AI-powered suggestions to improve instruction wording'
  },
  {
    key: 'ai_training',
    name: 'AI explanation / training guide',
    description: 'AI-generated explanations for clinical guidance'
  }
]

/**
 * Ensure that the default features exist in the database.
 * This should be called on server start or first admin page load.
 */
export async function ensureFeatures(): Promise<void> {
  try {
    for (const featureDef of DEFAULT_FEATURES) {
      await prisma.feature.upsert({
        where: { key: featureDef.key },
        update: {
          // Only update if fields changed
          name: featureDef.name,
          description: featureDef.description
        },
        create: {
          key: featureDef.key,
          name: featureDef.name,
          description: featureDef.description || null
        }
      })
    }
  } catch (error) {
    console.error('Error ensuring features:', error)
    // Don't throw - this shouldn't break the app
  }
}

