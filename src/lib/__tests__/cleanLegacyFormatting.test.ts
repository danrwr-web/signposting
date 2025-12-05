/**
 * Unit tests for legacy formatting cleanup function
 */

import { cleanLegacyFormatting } from '../cleanLegacyFormatting'

describe('cleanLegacyFormatting', () => {
  test('removes "?? " at the start of lines', () => {
    const input = '?? Book a Pink / Purple Slot if:'
    const expected = 'Book a Pink / Purple Slot if:'
    expect(cleanLegacyFormatting(input)).toBe(expected)
  })

  test('removes "??" (no space) before "Book a"', () => {
    const input = '??Book a Red Slot if the patient is acutely unwell'
    const expected = 'Book a Red Slot if the patient is acutely unwell'
    expect(cleanLegacyFormatting(input)).toBe(expected)
  })

  test('removes "?? " before "Book a"', () => {
    const input = 'Some text ?? Book a Pink / Purple Slot if:'
    const expected = 'Some text Book a Pink / Purple Slot if:'
    expect(cleanLegacyFormatting(input)).toBe(expected)
  })

  test('removes "?? " before "If none of the above apply:"', () => {
    const input = '?? If none of the above apply:'
    const expected = 'If none of the above apply:'
    expect(cleanLegacyFormatting(input)).toBe(expected)
  })

  test('fixes temperature comparison "? 38°C" to "≥ 38°C"', () => {
    const input = 'High temperature ? 38°C and unwell'
    const expected = 'High temperature ≥ 38°C and unwell'
    expect(cleanLegacyFormatting(input)).toBe(expected)
  })

  test('fixes other temperature patterns', () => {
    const input = 'Temperature ? 39°C or ? 40°C'
    const expected = 'Temperature ≥ 39°C or ≥ 40°C'
    expect(cleanLegacyFormatting(input)).toBe(expected)
  })

  test('handles multiple issues in same text', () => {
    const input = `?? Book a Pink / Purple Slot if:
High temperature ? 38°C and unwell
?? If none of the above apply:`
    const expected = `Book a Pink / Purple Slot if:
High temperature ≥ 38°C and unwell
If none of the above apply:`
    expect(cleanLegacyFormatting(input)).toBe(expected)
  })

  test('handles HTML content with formatting issues', () => {
    const input = '<p>?? Book a Red Slot if:</p><p>Temperature ? 38°C</p>'
    const expected = '<p>Book a Red Slot if:</p><p>Temperature ≥ 38°C</p>'
    expect(cleanLegacyFormatting(input)).toBe(expected)
  })

  test('handles null and empty strings', () => {
    expect(cleanLegacyFormatting(null as unknown as string)).toBe(null as unknown as string)
    expect(cleanLegacyFormatting('')).toBe('')
  })

  test('does not modify text without legacy formatting', () => {
    const input = 'Book a Pink / Purple Slot if the patient is unwell'
    expect(cleanLegacyFormatting(input)).toBe(input)
  })

  test('handles multiline text with line-start issues', () => {
    const input = `First line
?? Second line with issue
Third line
?? Fourth line`
    const expected = `First line
Second line with issue
Third line
Fourth line`
    expect(cleanLegacyFormatting(input)).toBe(expected)
  })
})

