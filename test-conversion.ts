/**
 * Test migration script - simplified version
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

// Test the conversion
async function testConversion() {
  console.log('Testing Markdown to HTML conversion...')
  
  const testMarkdown = `## Treatment Options

1. **Mild symptoms**: Signpost Community Pharmacy
2. **Severe symptoms**: Contact GP immediately
3. **Emergency**: Call 111 or go to A&E

### Important Notes
- Take medication as prescribed
- Monitor symptoms closely`

  console.log('Input Markdown:')
  console.log(testMarkdown)
  console.log('\n' + '='.repeat(50) + '\n')
  
  const htmlResult = await markdownToHtml(testMarkdown)
  
  console.log('Output HTML:')
  console.log(htmlResult)
  console.log('\n' + '='.repeat(50) + '\n')
  
  console.log('HTML Detection Test:')
  console.log('Is HTML:', isHtmlContent(htmlResult))
  console.log('Is Markdown:', !isHtmlContent(testMarkdown))
}

testConversion().catch(console.error)
