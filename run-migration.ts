/**
 * Direct migration script using database connection
 * This bypasses the Prisma client issues by using a direct approach
 */

import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import remarkBreaks from 'remark-breaks'
import remarkRehype from 'remark-rehype'
import rehypeSanitize from 'rehype-sanitize'
import rehypeStringify from 'rehype-stringify'

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
 * Run migration using fetch to the API endpoint
 */
async function runMigrationViaAPI() {
  console.log('Running migration via API endpoint...')
  
  try {
    const response = await fetch('http://localhost:3000/api/admin/migrate-instructions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error('API Error:', response.status, errorText)
      return
    }
    
    const result = await response.json()
    console.log('Migration Result:', result)
    
  } catch (error) {
    console.error('Fetch Error:', error)
  }
}

// Run the migration
runMigrationViaAPI().catch(console.error)
