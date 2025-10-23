/**
 * One-time migration script to fix existing symptom content
 * Converts single paragraph content to multiple paragraphs
 * Run this once to fix all existing symptoms
 */

import 'server-only'
import { prisma } from '@/lib/prisma'

/**
 * Converts single paragraph content to multiple paragraphs
 * More comprehensive than the display-time conversion
 */
function migrateContentToParagraphs(content: string): string {
  if (!content || typeof content !== 'string') {
    return content
  }
  
  // Only process if it's a single paragraph
  if (!content.match(/^<p>.*<\/p>$/s)) {
    return content
  }
  
  // Extract content from paragraph tags
  const textContent = content.replace(/^<p>(.*)<\/p>$/s, '$1')
  
  // Split on common medical instruction patterns
  const patterns = [
    // Common medical instruction separators
    /(Signpost Community Pharmacy)/gi,
    /(Contact GP)/gi,
    /(Call 111)/gi,
    /(Go to A&E)/gi,
    /(Visit A&E)/gi,
    /(Emergency Department)/gi,
    /(Urgent Care Centre)/gi,
    /(Walk-in Centre)/gi,
    
    // Colon patterns for instruction separation
    /:\s+([A-Z][^:]*?)(?=\s+[A-Z]|$)/g,
    
    // Period followed by capital letter (new sentence/instruction)
    /\.\s+([A-Z][^.]*?)(?=\s+[A-Z]|$)/g,
  ]
  
  let processedContent = textContent
  
  // Apply pattern-based splitting
  patterns.forEach(pattern => {
    if (pattern.source.includes('Signpost') || pattern.source.includes('Contact') || 
        pattern.source.includes('Call') || pattern.source.includes('Go to') || 
        pattern.source.includes('Visit') || pattern.source.includes('Emergency') ||
        pattern.source.includes('Urgent') || pattern.source.includes('Walk-in')) {
      // Instruction pattern - split before the instruction
      processedContent = processedContent.replace(pattern, '</p><p>$1')
    } else {
      // Colon or period pattern - split after the colon/period
      processedContent = processedContent.replace(pattern, '$1</p><p>')
    }
  })
  
  // Clean up paragraph tags
  processedContent = processedContent
    .replace(/<\/p><p><\/p><p>/g, '</p><p>')  // Remove double breaks
    .replace(/^<\/p><p>/, '')                 // Remove leading break
    .replace(/<\/p><p>$/, '')                 // Remove trailing break
    .replace(/<p>\s*<\/p>/g, '')             // Remove empty paragraphs
  
  // If we made changes, wrap in paragraph tags
  if (processedContent !== textContent && processedContent.trim()) {
    return `<p>${processedContent}</p>`
  }
  
  // If no changes were made, return original
  return content
}

/**
 * Migrate all base symptoms
 */
async function migrateBaseSymptoms() {
  console.log('Starting migration of base symptoms...')
  
  const baseSymptoms = await prisma.baseSymptom.findMany({
    select: { id: true, instructions: true, instructionsHtml: true }
  })
  
  let updated = 0
  
  for (const symptom of baseSymptoms) {
    let needsUpdate = false
    const updates: any = {}
    
    // Check instructions field
    if (symptom.instructions) {
      const migratedInstructions = migrateContentToParagraphs(symptom.instructions)
      if (migratedInstructions !== symptom.instructions) {
        updates.instructions = migratedInstructions
        needsUpdate = true
      }
    }
    
    // Check instructionsHtml field
    if (symptom.instructionsHtml) {
      const migratedInstructionsHtml = migrateContentToParagraphs(symptom.instructionsHtml)
      if (migratedInstructionsHtml !== symptom.instructionsHtml) {
        updates.instructionsHtml = migratedInstructionsHtml
        needsUpdate = true
      }
    }
    
    if (needsUpdate) {
      await prisma.baseSymptom.update({
        where: { id: symptom.id },
        data: updates
      })
      updated++
      console.log(`Updated base symptom: ${symptom.id}`)
    }
  }
  
  console.log(`Migration complete. Updated ${updated} base symptoms.`)
}

/**
 * Migrate all surgery symptom overrides
 */
async function migrateSurgeryOverrides() {
  console.log('Starting migration of surgery symptom overrides...')
  
  const overrides = await prisma.surgerySymptomOverride.findMany({
    select: { surgeryId: true, baseSymptomId: true, instructions: true, instructionsHtml: true }
  })
  
  let updated = 0
  
  for (const override of overrides) {
    let needsUpdate = false
    const updates: any = {}
    
    // Check instructions field
    if (override.instructions) {
      const migratedInstructions = migrateContentToParagraphs(override.instructions)
      if (migratedInstructions !== override.instructions) {
        updates.instructions = migratedInstructions
        needsUpdate = true
      }
    }
    
    // Check instructionsHtml field
    if (override.instructionsHtml) {
      const migratedInstructionsHtml = migrateContentToParagraphs(override.instructionsHtml)
      if (migratedInstructionsHtml !== override.instructionsHtml) {
        updates.instructionsHtml = migratedInstructionsHtml
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
      console.log(`Updated surgery override: ${override.surgeryId}/${override.baseSymptomId}`)
    }
  }
  
  console.log(`Migration complete. Updated ${updated} surgery overrides.`)
}

/**
 * Migrate all custom symptoms
 */
async function migrateCustomSymptoms() {
  console.log('Starting migration of custom symptoms...')
  
  const customSymptoms = await prisma.surgeryCustomSymptom.findMany({
    select: { id: true, instructions: true, instructionsHtml: true }
  })
  
  let updated = 0
  
  for (const symptom of customSymptoms) {
    let needsUpdate = false
    const updates: any = {}
    
    // Check instructions field
    if (symptom.instructions) {
      const migratedInstructions = migrateContentToParagraphs(symptom.instructions)
      if (migratedInstructions !== symptom.instructions) {
        updates.instructions = migratedInstructions
        needsUpdate = true
      }
    }
    
    // Check instructionsHtml field
    if (symptom.instructionsHtml) {
      const migratedInstructionsHtml = migrateContentToParagraphs(symptom.instructionsHtml)
      if (migratedInstructionsHtml !== symptom.instructionsHtml) {
        updates.instructionsHtml = migratedInstructionsHtml
        needsUpdate = true
      }
    }
    
    if (needsUpdate) {
      await prisma.surgeryCustomSymptom.update({
        where: { id: symptom.id },
        data: updates
      })
      updated++
      console.log(`Updated custom symptom: ${symptom.id}`)
    }
  }
  
  console.log(`Migration complete. Updated ${updated} custom symptoms.`)
}

/**
 * Run the complete migration
 */
export async function runContentMigration() {
  console.log('Starting content migration to fix paragraph formatting...')
  
  try {
    await migrateBaseSymptoms()
    await migrateSurgeryOverrides()
    await migrateCustomSymptoms()
    
    console.log('Content migration completed successfully!')
  } catch (error) {
    console.error('Migration failed:', error)
    throw error
  }
}
