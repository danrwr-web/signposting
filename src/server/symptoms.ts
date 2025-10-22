/**
 * Server-only utilities for effective symptom resolution
 * Merges base symptoms with surgery-specific overrides and custom symptoms
 */

import 'server-only'
import { prisma } from '@/lib/prisma'

export interface EffectiveSymptom {
  id: string
  slug: string
  name: string
  briefInstruction: string | null
  highlightedText: string | null
  instructions: string | null
  instructionsJson: string | null // ProseMirror JSON as string
  linkToPage: string | null
  source: 'base' | 'override' | 'custom'
  baseSymptomId?: string
  surgeryId?: string
}

export async function getEffectiveSymptoms(surgeryId?: string): Promise<EffectiveSymptom[]> {
  try {
    const symptoms: EffectiveSymptom[] = []

    // Get all base symptoms
    const baseSymptoms = await prisma.baseSymptom.findMany({
      orderBy: { name: 'asc' }
    })

    // Convert base symptoms to effective symptoms
    for (const base of baseSymptoms) {
      symptoms.push({
        id: base.id,
        slug: base.slug,
        name: base.name,
        briefInstruction: base.briefInstruction,
        highlightedText: base.highlightedText,
        instructions: base.instructions,
        linkToPage: base.linkToPage,
        source: 'base',
        baseSymptomId: base.id,
      })
    }

    // If surgeryId is provided, apply overrides and add custom symptoms
    if (surgeryId) {
      // Get surgery overrides
      const overrides = await prisma.surgerySymptomOverride.findMany({
        where: { surgeryId },
        include: { baseSymptom: true }
      })

      // Apply overrides
      for (const override of overrides) {
        const baseIndex = symptoms.findIndex(s => s.baseSymptomId === override.baseSymptomId)
        if (baseIndex !== -1) {
          // Update existing base symptom with override values
          symptoms[baseIndex] = {
            ...symptoms[baseIndex],
            name: override.name || symptoms[baseIndex].name,
            briefInstruction: override.briefInstruction || symptoms[baseIndex].briefInstruction,
            highlightedText: override.highlightedText || symptoms[baseIndex].highlightedText,
            instructions: override.instructions || symptoms[baseIndex].instructions,
            linkToPage: override.linkToPage || symptoms[baseIndex].linkToPage,
            source: 'override',
            surgeryId: override.surgeryId,
          }
        }
      }

      // Get custom symptoms for this surgery
      const customSymptoms = await prisma.surgeryCustomSymptom.findMany({
        where: { surgeryId },
        orderBy: { name: 'asc' }
      })

      // Add custom symptoms
      for (const custom of customSymptoms) {
        symptoms.push({
          id: custom.id,
          slug: custom.slug,
          name: custom.name,
          briefInstruction: custom.briefInstruction,
          highlightedText: custom.highlightedText,
          instructions: custom.instructions,
          linkToPage: custom.linkToPage,
          source: 'custom',
          surgeryId: custom.surgeryId,
        })
      }
    }

    // Sort by name
    return symptoms.sort((a, b) => a.name.localeCompare(b.name))
  } catch (error) {
    console.error('Error getting effective symptoms:', error)
    return []
  }
}

export async function getEffectiveSymptomById(id: string, surgeryId?: string): Promise<EffectiveSymptom | null> {
  try {
    // First check if it's a custom symptom
    if (surgeryId) {
      const customSymptom = await prisma.surgeryCustomSymptom.findFirst({
        where: { id, surgeryId }
      })

      if (customSymptom) {
        return {
          id: customSymptom.id,
          slug: customSymptom.slug,
          name: customSymptom.name,
          briefInstruction: customSymptom.briefInstruction,
          highlightedText: customSymptom.highlightedText,
          instructions: customSymptom.instructions,
          linkToPage: customSymptom.linkToPage,
          source: 'custom',
          surgeryId: customSymptom.surgeryId,
        }
      }
    }

    // Check base symptoms
    const baseSymptom = await prisma.baseSymptom.findUnique({
      where: { id }
    })

    if (!baseSymptom) {
      return null
    }

    let effectiveSymptom: EffectiveSymptom = {
      id: baseSymptom.id,
      slug: baseSymptom.slug,
      name: baseSymptom.name,
      briefInstruction: baseSymptom.briefInstruction,
      highlightedText: baseSymptom.highlightedText,
      instructions: baseSymptom.instructions,
      linkToPage: baseSymptom.linkToPage,
      source: 'base',
      baseSymptomId: baseSymptom.id,
    }

    // Apply override if surgeryId is provided
    if (surgeryId) {
      const override = await prisma.surgerySymptomOverride.findUnique({
        where: {
          surgeryId_baseSymptomId: {
            surgeryId,
            baseSymptomId: baseSymptom.id,
          }
        }
      })

      if (override) {
        effectiveSymptom = {
          ...effectiveSymptom,
          name: override.name || effectiveSymptom.name,
          briefInstruction: override.briefInstruction || effectiveSymptom.briefInstruction,
          highlightedText: override.highlightedText || effectiveSymptom.highlightedText,
          instructions: override.instructions || effectiveSymptom.instructions,
          linkToPage: override.linkToPage || effectiveSymptom.linkToPage,
          source: 'override',
          surgeryId: override.surgeryId,
        }
      }
    }

    return effectiveSymptom
  } catch (error) {
    console.error('Error getting effective symptom by ID:', error)
    return null
  }
}

export async function getEffectiveSymptomBySlug(slug: string, surgeryId?: string): Promise<EffectiveSymptom | null> {
  try {
    // First check if it's a custom symptom
    if (surgeryId) {
      const customSymptom = await prisma.surgeryCustomSymptom.findFirst({
        where: { slug, surgeryId }
      })

      if (customSymptom) {
        return {
          id: customSymptom.id,
          slug: customSymptom.slug,
          name: customSymptom.name,
          briefInstruction: customSymptom.briefInstruction,
          highlightedText: customSymptom.highlightedText,
          instructions: customSymptom.instructions,
          linkToPage: customSymptom.linkToPage,
          source: 'custom',
          surgeryId: customSymptom.surgeryId,
        }
      }
    }

    // Check base symptoms
    const baseSymptom = await prisma.baseSymptom.findUnique({
      where: { slug }
    })

    if (!baseSymptom) {
      return null
    }

    let effectiveSymptom: EffectiveSymptom = {
      id: baseSymptom.id,
      slug: baseSymptom.slug,
      name: baseSymptom.name,
      briefInstruction: baseSymptom.briefInstruction,
      highlightedText: baseSymptom.highlightedText,
      instructions: baseSymptom.instructions,
      linkToPage: baseSymptom.linkToPage,
      source: 'base',
      baseSymptomId: baseSymptom.id,
    }

    // Apply override if surgeryId is provided
    if (surgeryId) {
      const override = await prisma.surgerySymptomOverride.findUnique({
        where: {
          surgeryId_baseSymptomId: {
            surgeryId,
            baseSymptomId: baseSymptom.id,
          }
        }
      })

      if (override) {
        effectiveSymptom = {
          ...effectiveSymptom,
          name: override.name || effectiveSymptom.name,
          briefInstruction: override.briefInstruction || effectiveSymptom.briefInstruction,
          highlightedText: override.highlightedText || effectiveSymptom.highlightedText,
          instructions: override.instructions || effectiveSymptom.instructions,
          linkToPage: override.linkToPage || effectiveSymptom.linkToPage,
          source: 'override',
          surgeryId: override.surgeryId,
        }
      }
    }

    return effectiveSymptom
  } catch (error) {
    console.error('Error getting effective symptom by slug:', error)
    return null
  }
}
