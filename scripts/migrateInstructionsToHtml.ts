/**
 * Migration script to convert Markdown/plain text instructions to HTML
 * One-time migration from legacy instructions field to instructionsHtml field
 */

import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import remarkBreaks from 'remark-breaks'
import remarkRehype from 'remark-rehype'
import rehypeSanitize from 'rehype-sanitize'
import rehypeStringify from 'rehype-stringify'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

/**
 * Check if content looks like HTML
 */
function isHtmlContent(content: string): boolean {
  if (!content || typeof content !== 'string') {
    return false
  }
  
  // Check for HTML tags
  const htmlTagRegex = /<[^>]+>/
  return htmlTagRegex.test(content)
}

/**
 * Convert Markdown/plain text to HTML using unified
 */
async function markdownToHtml(content: string): Promise<string> {
  if (!content || typeof content !== 'string') {
    return ''
  }
  
  try {
    const processor = unified()
      .use(remarkParse)        // Parse Markdown
      .use(remarkGfm)         // GitHub Flavored Markdown (tables, strikethrough, etc.)
      .use(remarkBreaks)       // Convert line breaks to <br>
      .use(remarkRehype)       // Convert to HTML AST
      .use(rehypeSanitize)     // Sanitize HTML
      .use(rehypeStringify)    // Stringify to HTML
    
    const result = await processor.process(content)
    return String(result)
  } catch (error) {
    console.error('Error converting Markdown to HTML:', error)
    // Fallback: wrap in paragraph tags
    return `<p>${content}</p>`
  }
}

/**
 * Migrate base symptoms
 */
async function migrateBaseSymptoms(): Promise<number> {
  console.log('Migrating base symptoms...')
  
  const symptoms = await prisma.baseSymptom.findMany({
    where: {
      OR: [
        { instructionsHtml: null },
        { instructionsHtml: '' }
      ]
    },
    select: { id: true, name: true, instructions: true, instructionsHtml: true }
  })
  
  let updated = 0
  
  for (const symptom of symptoms) {
    if (!symptom.instructions) {
      continue
    }
    
    let htmlContent: string
    
    if (isHtmlContent(symptom.instructions)) {
      // Content is already HTML, copy it through
      htmlContent = symptom.instructions
      console.log(`Base symptom "${symptom.name}": Copied HTML content`)
    } else {
      // Convert Markdown/plain text to HTML
      htmlContent = await markdownToHtml(symptom.instructions)
      console.log(`Base symptom "${symptom.name}": Converted Markdown to HTML`)
    }
    
    await prisma.baseSymptom.update({
      where: { id: symptom.id },
      data: { instructionsHtml: htmlContent }
    })
    
    updated++
  }
  
  console.log(`Updated ${updated} base symptoms`)
  return updated
}

/**
 * Migrate surgery symptom overrides
 */
async function migrateSurgeryOverrides(): Promise<number> {
  console.log('Migrating surgery symptom overrides...')
  
  const overrides = await prisma.surgerySymptomOverride.findMany({
    where: {
      OR: [
        { instructionsHtml: null },
        { instructionsHtml: '' }
      ]
    },
    select: { 
      surgeryId: true, 
      baseSymptomId: true, 
      instructions: true, 
      instructionsHtml: true 
    }
  })
  
  let updated = 0
  
  for (const override of overrides) {
    if (!override.instructions) {
      continue
    }
    
    let htmlContent: string
    
    if (isHtmlContent(override.instructions)) {
      // Content is already HTML, copy it through
      htmlContent = override.instructions
      console.log(`Surgery override ${override.surgeryId}/${override.baseSymptomId}: Copied HTML content`)
    } else {
      // Convert Markdown/plain text to HTML
      htmlContent = await markdownToHtml(override.instructions)
      console.log(`Surgery override ${override.surgeryId}/${override.baseSymptomId}: Converted Markdown to HTML`)
    }
    
    await prisma.surgerySymptomOverride.update({
      where: {
        surgeryId_baseSymptomId: {
          surgeryId: override.surgeryId,
          baseSymptomId: override.baseSymptomId
        }
      },
      data: { instructionsHtml: htmlContent }
    })
    
    updated++
  }
  
  console.log(`Updated ${updated} surgery overrides`)
  return updated
}

/**
 * Migrate custom symptoms
 */
async function migrateCustomSymptoms(): Promise<number> {
  console.log('Migrating custom symptoms...')
  
  const symptoms = await prisma.surgeryCustomSymptom.findMany({
    where: {
      OR: [
        { instructionsHtml: null },
        { instructionsHtml: '' }
      ]
    },
    select: { id: true, name: true, instructions: true, instructionsHtml: true }
  })
  
  let updated = 0
  
  for (const symptom of symptoms) {
    if (!symptom.instructions) {
      continue
    }
    
    let htmlContent: string
    
    if (isHtmlContent(symptom.instructions)) {
      // Content is already HTML, copy it through
      htmlContent = symptom.instructions
      console.log(`Custom symptom "${symptom.name}": Copied HTML content`)
    } else {
      // Convert Markdown/plain text to HTML
      htmlContent = await markdownToHtml(symptom.instructions)
      console.log(`Custom symptom "${symptom.name}": Converted Markdown to HTML`)
    }
    
    await prisma.surgeryCustomSymptom.update({
      where: { id: symptom.id },
      data: { instructionsHtml: htmlContent }
    })
    
    updated++
  }
  
  console.log(`Updated ${updated} custom symptoms`)
  return updated
}

/**
 * Backup affected rows to JSON
 */
async function backupAffectedRows(): Promise<void> {
  console.log('Creating backup of affected rows...')
  
  const baseSymptoms = await prisma.baseSymptom.findMany({
    where: {
      OR: [
        { instructionsHtml: null },
        { instructionsHtml: '' }
      ]
    },
    select: { id: true, name: true, instructions: true, instructionsHtml: true }
  })
  
  const overrides = await prisma.surgerySymptomOverride.findMany({
    where: {
      OR: [
        { instructionsHtml: null },
        { instructionsHtml: '' }
      ]
    },
    select: { 
      surgeryId: true, 
      baseSymptomId: true, 
      instructions: true, 
      instructionsHtml: true 
    }
  })
  
  const customSymptoms = await prisma.surgeryCustomSymptom.findMany({
    where: {
      OR: [
        { instructionsHtml: null },
        { instructionsHtml: '' }
      ]
    },
    select: { id: true, name: true, instructions: true, instructionsHtml: true }
  })
  
  const backup = {
    timestamp: new Date().toISOString(),
    baseSymptoms,
    overrides,
    customSymptoms
  }
  
  const fs = await import('fs/promises')
  await fs.writeFile('instructions-backup.json', JSON.stringify(backup, null, 2))
  
  console.log(`Backup created: instructions-backup.json`)
  console.log(`- ${baseSymptoms.length} base symptoms`)
  console.log(`- ${overrides.length} surgery overrides`)
  console.log(`- ${customSymptoms.length} custom symptoms`)
}

/**
 * Main migration function
 */
async function runMigration(): Promise<void> {
  console.log('Starting instructions migration from Markdown to HTML...')
  console.log('================================================')
  
  try {
    // Create backup first
    await backupAffectedRows()
    
    // Run migrations
    const baseUpdated = await migrateBaseSymptoms()
    const overridesUpdated = await migrateSurgeryOverrides()
    const customUpdated = await migrateCustomSymptoms()
    
    const totalUpdated = baseUpdated + overridesUpdated + customUpdated
    
    console.log('================================================')
    console.log('Migration completed successfully!')
    console.log(`Total rows updated: ${totalUpdated}`)
    console.log(`- Base symptoms: ${baseUpdated}`)
    console.log(`- Surgery overrides: ${overridesUpdated}`)
    console.log(`- Custom symptoms: ${customUpdated}`)
    
  } catch (error) {
    console.error('Migration failed:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

// Run migration if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runMigration().catch((error) => {
    console.error('Migration failed:', error)
    process.exit(1)
  })
}

export { runMigration, backupAffectedRows }
