/**
 * Unit tests for highlighting functionality
 * Tests regex escaping and rule precedence
 */

import { applyHighlightRules, highlightPlainText } from '../highlighting'

describe('applyHighlightRules', () => {
  const mockRules = [
    {
      phrase: 'pharmacy first',
      textColor: '#ffffff',
      bgColor: '#6A0DAD',
      isEnabled: true
    },
    {
      phrase: 'emergency',
      textColor: '#ffffff',
      bgColor: '#dc2626',
      isEnabled: true
    },
    {
      phrase: 'disabled rule',
      textColor: '#ffffff',
      bgColor: '#059669',
      isEnabled: false
    }
  ]

  test('applies built-in slot highlighting', () => {
    const text = 'Book a green slot appointment'
    const result = applyHighlightRules(text, [])
    
    expect(result).toContain('bg-green-600')
    expect(result).toContain('green slot')
  })

  test('applies custom rules with proper escaping', () => {
    const text = 'Please try pharmacy first before calling'
    const result = applyHighlightRules(text, mockRules)
    
    expect(result).toContain('pharmacy first')
    expect(result).toContain('style="color: #ffffff; background-color: #6A0DAD')
  })

  test('handles regex special characters', () => {
    const rulesWithSpecialChars = [
      {
        phrase: 'test (urgent)',
        textColor: '#ffffff',
        bgColor: '#dc2626',
        isEnabled: true
      }
    ]
    
    const text = 'This is a test (urgent) situation'
    const result = applyHighlightRules(text, rulesWithSpecialChars)
    
    expect(result).toContain('test (urgent)')
    expect(result).toContain('style="color: #ffffff; background-color: #dc2626')
  })

  test('ignores disabled rules', () => {
    const text = 'This is a disabled rule test'
    const result = applyHighlightRules(text, mockRules)
    
    expect(result).toContain('disabled rule')
    expect(result).not.toContain('#059669')
    expect(result).not.toContain('style="color: #ffffff; background-color: #059669')
  })

  test('applies pink/purple keyword highlighting', () => {
    const text = 'This is a pink test and purple example'
    const result = applyHighlightRules(text, [])
    
    expect(result).toContain('bg-purple-600')
    expect(result).toContain('pink')
    expect(result).toContain('purple')
  })

  test('custom rules take precedence over built-in keywords', () => {
    const customPinkRule = [
      {
        phrase: 'pink',
        textColor: '#000000',
        bgColor: '#ffc0cb',
        isEnabled: true
      }
    ]
    
    const text = 'This is a pink test'
    const result = applyHighlightRules(text, customPinkRule)
    
    // Should use custom rule styling, not built-in purple
    expect(result).toContain('style="color: #000000; background-color: #ffc0cb')
    expect(result).not.toContain('bg-purple-600')
  })

  test('handles case-insensitive matching', () => {
    const text = 'This is a PHARMACY FIRST test'
    const result = applyHighlightRules(text, mockRules)
    
    expect(result).toContain('PHARMACY FIRST')
    expect(result).toContain('style="color: #ffffff; background-color: #6A0DAD')
  })

  test('handles word boundaries correctly', () => {
    const text = 'pharmacyfirst should not match'
    const result = applyHighlightRules(text, mockRules)

    expect(result).toContain('pharmacyfirst')
    expect(result).not.toContain('#6A0DAD')
  })

  test('does not match phrases inside tag attributes', () => {
    const text = '<img src="/api/symptom-images/abc123" alt="call emergency services"> Stay calm'
    const result = applyHighlightRules(text, mockRules)

    // The alt attribute must survive untouched; a span inside it would break the tag.
    expect(result).toContain('alt="call emergency services"')
    expect(result).toContain('<img src="/api/symptom-images/abc123"')
  })

  test('highlights text next to a tag without corrupting it', () => {
    const text = '<p>In an emergency call 999 <img src="/api/symptom-images/abc123" alt="triage chart"></p>'
    const result = applyHighlightRules(text, mockRules)

    expect(result).toContain('background-color: #dc2626')
    expect(result).toContain('<img src="/api/symptom-images/abc123" alt="triage chart">')
  })

  test('built-in highlighting skips tag attributes', () => {
    const text = '<img alt="green slot chart" src="/api/symptom-images/abc123"> Book a green slot'
    const result = applyHighlightRules(text, [])

    expect(result).toContain('alt="green slot chart"')
    // The text occurrence outside the tag still gets wrapped.
    expect(result).toContain('<span class="bg-green-600 text-white px-1 py-0.5 rounded text-sm font-medium">green slot</span>')
  })

  test('does not match phrases inside style attributes of earlier highlights', () => {
    const rules = [
      {
        phrase: 'text',
        textColor: '#ffffff',
        bgColor: '#dc2626',
        isEnabled: true
      }
    ]
    const result = applyHighlightRules('some text here', rules)

    // The injected span's class="text-sm" must not be re-matched by the rule.
    const spanCount = (result.match(/<span/g) || []).length
    expect(spanCount).toBe(1)
    expect(result).toContain('>text</span>')
  })
})

describe('highlightPlainText', () => {
  const mockRules = [
    {
      phrase: 'pharmacy first',
      textColor: '#ffffff',
      bgColor: '#6A0DAD',
      isEnabled: true,
    },
  ]

  test('neutralises markup in the text, rendering it as literal characters', () => {
    const result = highlightPlainText(
      '<img src=x onerror="alert(1)"> Book with the duty doctor',
      mockRules
    )

    // No live tag survives — the whole thing is escaped into a text node.
    expect(result).not.toContain('<img')
    expect(result).toContain('&lt;img src=x onerror="alert(1)"&gt;')
  })

  test('neutralises a script tag and its payload', () => {
    const result = highlightPlainText('<script>alert(document.cookie)</script>', [])

    expect(result).not.toContain('<script')
    expect(result).not.toContain('</script>')
    expect(result).toBe('&lt;script&gt;alert(document.cookie)&lt;/script&gt;')
  })

  test('neutralises an event handler smuggled onto a closing/opening tag pair', () => {
    const result = highlightPlainText(
      'Ring 999</p><svg onload="fetch(\'//evil\')">',
      []
    )

    expect(result).not.toContain('<svg')
    expect(result).not.toContain('</p>')
    expect(result).toContain('&lt;svg onload=')
  })

  test('still applies a normal custom highlight rule', () => {
    const result = highlightPlainText('Please try pharmacy first before calling', mockRules)

    expect(result).toContain(
      '<span style="color: #ffffff; background-color: #6A0DAD; padding: 2px 4px; border-radius: 4px; font-weight: 500;" class="text-sm">pharmacy first</span>'
    )
  })

  test('still applies built-in slot highlighting', () => {
    const result = highlightPlainText('Book a green slot appointment', [])

    expect(result).toContain(
      '<span class="bg-green-600 text-white px-1 py-0.5 rounded text-sm font-medium">green slot</span>'
    )
  })

  test('honours the enableBuiltInHighlights flag', () => {
    const result = highlightPlainText('Book a green slot appointment', [], false)

    expect(result).not.toContain('bg-green-600')
    expect(result).toBe('Book a green slot appointment')
  })

  test('matches a rule whose phrase contains an escapable character', () => {
    const rules = [
      { phrase: 'A&E', textColor: '#ffffff', bgColor: '#dc2626', isEnabled: true },
    ]
    const result = highlightPlainText('Send the patient to A&E now', rules)

    // The phrase is escaped alongside the text, so it still matches — and the
    // wrapped text is the escaped form, which renders back as "A&E".
    expect(result).toContain('background-color: #dc2626')
    expect(result).toContain('>A&amp;E</span>')
  })

  test('does not let a rule phrase reintroduce markup', () => {
    const rules = [
      { phrase: '<b>', textColor: '#ffffff', bgColor: '#dc2626', isEnabled: true },
    ]
    const result = highlightPlainText('Literal <b> in the text', rules)

    expect(result).not.toContain('<b>')
    expect(result).toContain('&lt;b&gt;')
  })

  test('custom rules still take precedence over built-in keywords', () => {
    const rules = [
      { phrase: 'pink', textColor: '#000000', bgColor: '#ffc0cb', isEnabled: true },
    ]
    const result = highlightPlainText('This is a pink test', rules)

    expect(result).toContain('style="color: #000000; background-color: #ffc0cb')
    expect(result).not.toContain('bg-purple-600')
  })

  test('still ignores disabled rules', () => {
    const rules = [
      { phrase: 'urgent', textColor: '#ffffff', bgColor: '#059669', isEnabled: false },
    ]
    const result = highlightPlainText('This is urgent', rules)

    expect(result).toBe('This is urgent')
  })

  test('returns an empty string for empty or missing text', () => {
    expect(highlightPlainText('', mockRules)).toBe('')
    expect(highlightPlainText(null, mockRules)).toBe('')
    expect(highlightPlainText(undefined, mockRules)).toBe('')
  })

  test('tolerates a non-array rules value', () => {
    const result = highlightPlainText('Book a green slot', undefined as never)

    expect(result).toContain('bg-green-600')
  })
})
