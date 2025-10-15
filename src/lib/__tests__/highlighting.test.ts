/**
 * Unit tests for highlighting functionality
 * Tests regex escaping and rule precedence
 */

import { applyHighlightRules } from '../highlighting'

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
    
    expect(result).not.toContain('disabled rule')
    expect(result).not.toContain('#059669')
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
    
    expect(result).not.toContain('pharmacyfirst')
    expect(result).not.toContain('#6A0DAD')
  })
})
