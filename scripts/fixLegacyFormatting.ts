/**
 * Maintenance script to clean up legacy formatting glitches in symptom instructions
 * 
 * Fixes:
 * - "?? " at the start of lines
 * - "?? " or "??" before "Book a..."
 * - "?? " before "If none of the above apply:"
 * - "? 38°C" -> "≥ 38°C" (temperature comparisons)
 * 
 * Only updates records where the text actually changes.
 * Only touches instruction fields (instructionsHtml, instructions).
 */

import { PrismaClient } from '@prisma/client'
import { cleanLegacyFormatting } from '../src/lib/cleanLegacyFormatting'

const prisma = new PrismaClient()

/**
 * Clean and update base symptoms
 */
async function cleanBaseSymptoms(): Promise<number> {
  console.log('Checking base symptoms...')
  
  const symptoms = await prisma.baseSymptom.findMany({
    where: {
      OR: [
        { instructionsHtml: { not: null } },
        { instructions: { not: null } }
      ]
    },
    select: {
      id: true,
      name: true,
      instructionsHtml: true,
      instructions: true
    }
  })
  
  let updated = 0
  const changes: Array<{ name: string; before: string; after: string }> = []
  
  for (const symptom of symptoms) {
    let needsUpdate = false
    const updates: { instructionsHtml?: string; instructions?: string } = {}
    
    // Clean instructionsHtml if present
    if (symptom.instructionsHtml) {
      const cleaned = cleanLegacyFormatting(symptom.instructionsHtml)
      if (cleaned !== symptom.instructionsHtml) {
        updates.instructionsHtml = cleaned
        needsUpdate = true
      }
    }
    
    // Clean instructions if present
    if (symptom.instructions) {
      const cleaned = cleanLegacyFormatting(symptom.instructions)
      if (cleaned !== symptom.instructions) {
        updates.instructions = cleaned
        needsUpdate = true
      }
    }
    
    if (needsUpdate) {
      await prisma.baseSymptom.update({
        where: { id: symptom.id },
        data: updates
      })
      
      updated++
      
      // Log first few changes for sanity checking
      if (changes.length < 5) {
        const before = (symptom.instructionsHtml || symptom.instructions || '').substring(0, 100)
        const after = (updates.instructionsHtml || updates.instructions || before).substring(0, 100)
        changes.push({
          name: symptom.name,
          before,
          after
        })
      }
    }
  }
  
  if (changes.length > 0) {
    console.log(`\nSample changes for base symptoms:`)
    changes.forEach((change, idx) => {
      console.log(`\n${idx + 1}. "${change.name}"`)
      console.log(`   Before: ${change.before}...`)
      console.log(`   After:  ${change.after}...`)
    })
  }
  
  console.log(`\nUpdated ${updated} base symptoms`)
  return updated
}

/**
 * Clean and update surgery symptom overrides
 */
async function cleanSurgeryOverrides(): Promise<number> {
  console.log('\nChecking surgery symptom overrides...')
  
  const overrides = await prisma.surgerySymptomOverride.findMany({
    where: {
      OR: [
        { instructionsHtml: { not: null } },
        { instructions: { not: null } }
      ]
    },
    select: {
      surgeryId: true,
      baseSymptomId: true,
      instructionsHtml: true,
      instructions: true,
      baseSymptom: {
        select: { name: true }
      }
    }
  })
  
  let updated = 0
  const changes: Array<{ name: string; before: string; after: string }> = []
  
  for (const override of overrides) {
    let needsUpdate = false
    const updates: { instructionsHtml?: string; instructions?: string } = {}
    
    // Clean instructionsHtml if present
    if (override.instructionsHtml) {
      const cleaned = cleanLegacyFormatting(override.instructionsHtml)
      if (cleaned !== override.instructionsHtml) {
        updates.instructionsHtml = cleaned
        needsUpdate = true
      }
    }
    
    // Clean instructions if present
    if (override.instructions) {
      const cleaned = cleanLegacyFormatting(override.instructions)
      if (cleaned !== override.instructions) {
        updates.instructions = cleaned
        needsUpdate = true
      }
    }
    
    if (needsUpdate) {
      await prisma.surgerySymptomOverride.update({
        where: {
          surgeryId_baseSymptomId: {
            surgeryId: override.surgeryId,
            baseSymptomId: override.baseSymptomId
          }
        },
        data: updates
      })
      
      updated++
      
      // Log first few changes for sanity checking
      if (changes.length < 5) {
        const before = (override.instructionsHtml || override.instructions || '').substring(0, 100)
        const after = (updates.instructionsHtml || updates.instructions || before).substring(0, 100)
        changes.push({
          name: `${override.baseSymptom.name} (override)`,
          before,
          after
        })
      }
    }
  }
  
  if (changes.length > 0) {
    console.log(`\nSample changes for surgery overrides:`)
    changes.forEach((change, idx) => {
      console.log(`\n${idx + 1}. "${change.name}"`)
      console.log(`   Before: ${change.before}...`)
      console.log(`   After:  ${change.after}...`)
    })
  }
  
  console.log(`\nUpdated ${updated} surgery overrides`)
  return updated
}

/**
 * Clean and update custom symptoms
 */
async function cleanCustomSymptoms(): Promise<number> {
  console.log('\nChecking custom symptoms...')
  
  const symptoms = await prisma.surgeryCustomSymptom.findMany({
    where: {
      OR: [
        { instructionsHtml: { not: null } },
        { instructions: { not: null } }
      ]
    },
    select: {
      id: true,
      name: true,
      instructionsHtml: true,
      instructions: true
    }
  })
  
  let updated = 0
  const changes: Array<{ name: string; before: string; after: string }> = []
  
  for (const symptom of symptoms) {
    let needsUpdate = false
    const updates: { instructionsHtml?: string; instructions?: string } = {}
    
    // Clean instructionsHtml if present
    if (symptom.instructionsHtml) {
      const cleaned = cleanLegacyFormatting(symptom.instructionsHtml)
      if (cleaned !== symptom.instructionsHtml) {
        updates.instructionsHtml = cleaned
        needsUpdate = true
      }
    }
    
    // Clean instructions if present
    if (symptom.instructions) {
      const cleaned = cleanLegacyFormatting(symptom.instructions)
      if (cleaned !== symptom.instructions) {
        updates.instructions = cleaned
        needsUpdate = true
      }
    }
    
    if (needsUpdate) {
      await prisma.surgeryCustomSymptom.update({
        where: { id: symptom.id },
        data: updates
      })
      
      updated++
      
      // Log first few changes for sanity checking
      if (changes.length < 5) {
        const before = (symptom.instructionsHtml || symptom.instructions || '').substring(0, 100)
        const after = (updates.instructionsHtml || updates.instructions || before).substring(0, 100)
        changes.push({
          name: symptom.name,
          before,
          after
        })
      }
    }
  }
  
  if (changes.length > 0) {
    console.log(`\nSample changes for custom symptoms:`)
    changes.forEach((change, idx) => {
      console.log(`\n${idx + 1}. "${change.name}"`)
      console.log(`   Before: ${change.before}...`)
      console.log(`   After:  ${change.after}...`)
    })
  }
  
  console.log(`\nUpdated ${updated} custom symptoms`)
  return updated
}

/**
 * Count records with legacy formatting (for dry-run logging)
 */
async function countRecordsWithLegacyFormatting(): Promise<number> {
  const baseSymptoms = await prisma.baseSymptom.findMany({
    where: {
      OR: [
        { instructionsHtml: { not: null } },
        { instructions: { not: null } }
      ]
    },
    select: { instructionsHtml: true, instructions: true }
  })
  
  const overrides = await prisma.surgerySymptomOverride.findMany({
    where: {
      OR: [
        { instructionsHtml: { not: null } },
        { instructions: { not: null } }
      ]
    },
    select: { instructionsHtml: true, instructions: true }
  })
  
  const customSymptoms = await prisma.surgeryCustomSymptom.findMany({
    where: {
      OR: [
        { instructionsHtml: { not: null } },
        { instructions: { not: null } }
      ]
    },
    select: { instructionsHtml: true, instructions: true }
  })
  
  let count = 0
  
  const checkText = (text: string | null): boolean => {
    if (!text) return false
    return /^\?\?\s+/m.test(text) ||
           /\?\?\s+(Book a)/.test(text) ||
           /\?\?(Book a)/.test(text) ||
           /\?\?\s+(If none of the above apply:)/.test(text) ||
           /\?\s*\d+°C/.test(text)
  }
  
  for (const symptom of baseSymptoms) {
    if (checkText(symptom.instructionsHtml) || checkText(symptom.instructions)) {
      count++
    }
  }
  
  for (const override of overrides) {
    if (checkText(override.instructionsHtml) || checkText(override.instructions)) {
      count++
    }
  }
  
  for (const symptom of customSymptoms) {
    if (checkText(symptom.instructionsHtml) || checkText(symptom.instructions)) {
      count++
    }
  }
  
  return count
}

/**
 * Main function to run the cleanup
 */
async function runCleanup(): Promise<void> {
  console.log('Starting legacy formatting cleanup...')
  console.log('================================================')
  
  try {
    // Count records with legacy formatting
    const recordsWithLegacyFormatting = await countRecordsWithLegacyFormatting()
    console.log(`\nFound ${recordsWithLegacyFormatting} records with legacy formatting patterns`)
    console.log('Processing all records...\n')
    
    // Run cleanups
    const baseUpdated = await cleanBaseSymptoms()
    const overridesUpdated = await cleanSurgeryOverrides()
    const customUpdated = await cleanCustomSymptoms()
    
    const totalUpdated = baseUpdated + overridesUpdated + customUpdated
    
    console.log('\n================================================')
    console.log('Cleanup completed successfully!')
    console.log(`Total records updated: ${totalUpdated}`)
    console.log(`- Base symptoms: ${baseUpdated}`)
    console.log(`- Surgery overrides: ${overridesUpdated}`)
    console.log(`- Custom symptoms: ${customUpdated}`)
    
  } catch (error) {
    console.error('Cleanup failed:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

// Run cleanup if this script is executed directly
runCleanup().catch((error) => {
  console.error('Cleanup failed:', error)
  process.exit(1)
})

export { runCleanup, countRecordsWithLegacyFormatting }

