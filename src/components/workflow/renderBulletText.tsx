import React from 'react'

/**
 * Renders body text with lightweight bullet list support.
 * 
 * - Paragraphs: normal lines become <p> elements
 * - Bullet lists: consecutive lines starting with - or * become <ul><li> elements
 * - Blank lines: preserved as paragraph breaks
 * 
 * Does not allow arbitrary HTML or markdown beyond simple bullets.
 */
export function renderBulletText(body: string): React.ReactNode {
  if (!body || body.trim().length === 0) {
    return null
  }

  const lines = body.split('\n')
  const elements: React.ReactNode[] = []
  let currentList: string[] = []
  let currentParagraph: string[] = []

  const flushParagraph = () => {
    if (currentParagraph.length > 0) {
      const text = currentParagraph.join(' ').trim()
      if (text) {
        elements.push(
          <p key={`p-${elements.length}`} className="mb-2">
            {text}
          </p>
        )
      } else {
        // Empty paragraph (blank line) - add spacing
        elements.push(
          <p key={`p-${elements.length}`} className="mb-2">
            {'\u00A0'}
          </p>
        )
      }
      currentParagraph = []
    }
  }

  const flushList = () => {
    if (currentList.length > 0) {
      elements.push(
        <ul key={`ul-${elements.length}`} className="list-disc list-inside mb-2 ml-4 space-y-1">
          {currentList.map((item, idx) => (
            <li key={idx} className="text-gray-800">
              {item.trim()}
            </li>
          ))}
        </ul>
      )
      currentList = []
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trimRight()
    
    // Check if line is a bullet item (starts with - or * after optional whitespace)
    // Allow both "- item" and "-item" formats
    const bulletMatch = trimmed.match(/^[\s]*[-*]\s*(.*)$/)
    
    if (bulletMatch && trimmed.trim().length > 0) {
      // This is a bullet item (must have at least the marker)
      flushParagraph() // Flush any pending paragraph
      const content = bulletMatch[1]?.trim() || ''
      if (content) {
        currentList.push(content)
      } else {
        // Bullet marker with no content - treat as empty bullet
        currentList.push('')
      }
    } else if (trimmed.length === 0) {
      // Blank line
      flushList() // Flush any pending list
      flushParagraph() // Flush any pending paragraph, then add blank line
      elements.push(
        <p key={`p-${elements.length}`} className="mb-2">
          {'\u00A0'}
        </p>
      )
    } else {
      // Regular text line
      flushList() // Flush any pending list
      currentParagraph.push(trimmed)
    }
  }

  // Flush any remaining content
  flushList()
  flushParagraph()

  return <>{elements}</>
}

