/**
 * Tests for Rich Text Editor colour functionality
 */

import { sanitizeHtml } from '@/lib/sanitizeHtml'

describe('Rich Text Editor Colour Functionality', () => {
  describe('sanitizeHtml', () => {
    it('preserves coloured spans with RGB values', () => {
      const htmlWithColour = '<p>This is <span style="color: rgb(255, 0, 0);">red text</span> and <span style="color: rgb(0, 128, 0);">green text</span>.</p>'
      
      const sanitized = sanitizeHtml(htmlWithColour)
      
      expect(sanitized).toContain('style="color: rgb(255, 0, 0);"')
      expect(sanitized).toContain('style="color: rgb(0, 128, 0);"')
      expect(sanitized).toContain('red text')
      expect(sanitized).toContain('green text')
    })

    it('preserves coloured spans with hex values', () => {
      const htmlWithHexColour = '<p>This is <span style="color: #ff0000;">red text</span> and <span style="color: #00ff00;">green text</span>.</p>'
      
      const sanitized = sanitizeHtml(htmlWithHexColour)
      
      expect(sanitized).toContain('style="color: #ff0000;"')
      expect(sanitized).toContain('style="color: #00ff00;"')
      expect(sanitized).toContain('red text')
      expect(sanitized).toContain('green text')
    })

    it('preserves NHS colour values', () => {
      const htmlWithNHSColours = '<p>This is <span style="color: #005EB8;">NHS blue</span> and <span style="color: #DA020E;">NHS red</span>.</p>'
      
      const sanitized = sanitizeHtml(htmlWithNHSColours)
      
      expect(sanitized).toContain('style="color: #005EB8;"')
      expect(sanitized).toContain('style="color: #DA020E;"')
      expect(sanitized).toContain('NHS blue')
      expect(sanitized).toContain('NHS red')
    })

    it('preserves complex formatting with colours', () => {
      const complexHtml = '<h2>Important Notice</h2><p>This is <strong><span style="color: rgb(255, 0, 0);">urgent</span></strong> information.</p><ul><li><span style="color: rgb(0, 0, 255);">Blue item</span></li><li><span style="color: rgb(128, 0, 128);">Purple item</span></li></ul>'
      
      const sanitized = sanitizeHtml(complexHtml)
      
      expect(sanitized).toContain('<h2>Important Notice</h2>')
      expect(sanitized).toContain('<strong>')
      expect(sanitized).toContain('style="color: rgb(255, 0, 0);"')
      expect(sanitized).toContain('<ul>')
      expect(sanitized).toContain('<li>')
      expect(sanitized).toContain('style="color: rgb(0, 0, 255);"')
      expect(sanitized).toContain('style="color: rgb(128, 0, 128);"')
    })

    it('removes dangerous scripts while preserving colours', () => {
      const dangerousHtml = '<p>This is <span style="color: rgb(255, 0, 0);">red text</span> <script>alert("xss")</script> and <span style="color: rgb(0, 255, 0);">green text</span>.</p>'
      
      const sanitized = sanitizeHtml(dangerousHtml)
      
      expect(sanitized).toContain('style="color: rgb(255, 0, 0);"')
      expect(sanitized).toContain('style="color: rgb(0, 255, 0);"')
      expect(sanitized).toContain('red text')
      expect(sanitized).toContain('green text')
      expect(sanitized).not.toContain('<script>')
      expect(sanitized).not.toContain('alert("xss")')
    })

    it('handles empty or null input gracefully', () => {
      expect(sanitizeHtml('')).toBe('')
      expect(sanitizeHtml(null as any)).toBe('')
      expect(sanitizeHtml(undefined as any)).toBe('')
    })

    it('preserves background colours', () => {
      const htmlWithBackground = '<p>This is <span style="background-color: rgb(255, 255, 0); color: rgb(0, 0, 0);">highlighted text</span>.</p>'
      
      const sanitized = sanitizeHtml(htmlWithBackground)
      
      expect(sanitized).toContain('style="background-color: rgb(255, 255, 0); color: rgb(0, 0, 0);"')
      expect(sanitized).toContain('highlighted text')
    })

    it('preserves multiple style properties', () => {
      const htmlWithMultipleStyles = '<p>This is <span style="color: rgb(255, 0, 0); font-weight: bold; text-decoration: underline;">styled text</span>.</p>'
      
      const sanitized = sanitizeHtml(htmlWithMultipleStyles)
      
      expect(sanitized).toContain('style="color: rgb(255, 0, 0); font-weight: bold; text-decoration: underline;"')
      expect(sanitized).toContain('styled text')
    })
  })

  describe('colour round-trip functionality', () => {
    it('ensures coloured text survives save->read->render cycle', () => {
      // Simulate the full cycle: editor output -> sanitization -> storage -> retrieval -> rendering
      const editorOutput = '<p>This is <span style="color: rgb(255, 0, 0);">red text</span> with <span style="color: rgb(0, 128, 0);">green text</span>.</p>'
      
      // Step 1: Sanitize (as done in onChange handler)
      const sanitized = sanitizeHtml(editorOutput)
      
      // Step 2: Simulate storage and retrieval (no additional processing)
      const retrieved = sanitized
      
      // Step 3: Sanitize again for rendering (as done in InstructionView)
      const rendered = sanitizeHtml(retrieved)
      
      // Verify the coloured spans are preserved throughout the cycle
      expect(rendered).toContain('style="color: rgb(255, 0, 0);"')
      expect(rendered).toContain('style="color: rgb(0, 128, 0);"')
      expect(rendered).toContain('red text')
      expect(rendered).toContain('green text')
      
      // Verify the structure is maintained
      expect(rendered).toContain('<p>')
      expect(rendered).toContain('</p>')
      expect(rendered).toContain('<span')
      expect(rendered).toContain('</span>')
    })

    it('handles NHS colour palette round-trip', () => {
      const nhsColours = [
        { name: 'NHS Blue', value: '#005EB8' },
        { name: 'NHS Red', value: '#DA020E' },
        { name: 'NHS Orange', value: '#F59E0B' },
        { name: 'NHS Green', value: '#00A499' },
        { name: 'Purple', value: '#6A0DAD' },
        { name: 'Pink', value: '#E5007E' }
      ]
      
      let htmlWithAllColours = '<p>NHS Colour Palette:</p><ul>'
      nhsColours.forEach(colour => {
        htmlWithAllColours += `<li><span style="color: ${colour.value};">${colour.name}</span></li>`
      })
      htmlWithAllColours += '</ul>'
      
      // Full round-trip
      const sanitized = sanitizeHtml(htmlWithAllColours)
      const rendered = sanitizeHtml(sanitized)
      
      // Verify all NHS colours are preserved
      nhsColours.forEach(colour => {
        expect(rendered).toContain(`style="color: ${colour.value};"`)
        expect(rendered).toContain(colour.name)
      })
    })
  })
})
