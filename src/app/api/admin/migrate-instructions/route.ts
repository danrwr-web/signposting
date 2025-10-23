/**
 * Simple migration script using Next.js database connection
 * Run this from the Next.js app context to avoid Prisma client issues
 */

import { NextRequest, NextResponse } from 'next/server'
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import remarkBreaks from 'remark-breaks'
import remarkRehype from 'remark-rehype'
import rehypeSanitize from 'rehype-sanitize'
import rehypeStringify from 'rehype-stringify'
import { prisma } from '@/lib/prisma'

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

export async function POST(request: NextRequest) {
  try {
    console.log('Starting instructions migration from Markdown to HTML...')
    console.log('================================================')
    
    let totalUpdated = 0
    
    // Migrate base symptoms
    console.log('Migrating base symptoms...')
    const baseSymptoms = await prisma.baseSymptom.findMany({
      where: {
        OR: [
          { instructionsHtml: null },
          { instructionsHtml: '' }
        ]
      },
      select: { id: true, name: true, instructions: true, instructionsHtml: true }
    })
    
    let baseUpdated = 0
    for (const symptom of baseSymptoms) {
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
      
      baseUpdated++
    }
    
    console.log(`Updated ${baseUpdated} base symptoms`)
    totalUpdated += baseUpdated
    
    // Migrate surgery overrides
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
    
    let overridesUpdated = 0
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
      
      overridesUpdated++
    }
    
    console.log(`Updated ${overridesUpdated} surgery overrides`)
    totalUpdated += overridesUpdated
    
    // Migrate custom symptoms
    console.log('Migrating custom symptoms...')
    const customSymptoms = await prisma.surgeryCustomSymptom.findMany({
      where: {
        OR: [
          { instructionsHtml: null },
          { instructionsHtml: '' }
        ]
      },
      select: { id: true, name: true, instructions: true, instructionsHtml: true }
    })
    
    let customUpdated = 0
    for (const symptom of customSymptoms) {
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
      
      customUpdated++
    }
    
    console.log(`Updated ${customUpdated} custom symptoms`)
    totalUpdated += customUpdated
    
    console.log('================================================')
    console.log('Migration completed successfully!')
    console.log(`Total rows updated: ${totalUpdated}`)
    console.log(`- Base symptoms: ${baseUpdated}`)
    console.log(`- Surgery overrides: ${overridesUpdated}`)
    console.log(`- Custom symptoms: ${customUpdated}`)
    
    return NextResponse.json({ 
      success: true, 
      message: 'Migration completed successfully',
      results: {
        totalUpdated,
        baseSymptoms: baseUpdated,
        surgeryOverrides: overridesUpdated,
        customSymptoms: customUpdated
      }
    })
    
  } catch (error) {
    console.error('Migration failed:', error)
    return NextResponse.json({ 
      error: 'Migration failed', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 })
  }
}
