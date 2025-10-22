/**
 * Tests for NHS Badge Extension
 */

import { Badge } from '@/lib/tiptap/extensions/Badge'

describe('Badge Extension', () => {
  it('creates badge extension with correct name', () => {
    const extension = Badge.create()
    expect(extension.name).toBe('badge')
  })

  it('has correct attributes', () => {
    const extension = Badge.create()
    const attributes = extension.addAttributes()
    
    expect(attributes).toHaveProperty('variant')
    expect(attributes.variant.default).toBe('red')
  })

  it('parses HTML correctly', () => {
    const extension = Badge.create()
    const parseHTML = extension.parseHTML()
    
    expect(parseHTML).toHaveLength(1)
    expect(parseHTML[0].tag).toBe('span[class*="rt-badge"]')
  })

  it('renders HTML correctly', () => {
    const extension = Badge.create()
    const renderHTML = extension.renderHTML({
      HTMLAttributes: {},
      mark: { attrs: { variant: 'green' } }
    })
    
    expect(renderHTML).toEqual([
      'span',
      {
        class: 'rt-badge rt-badge--green',
        'data-variant': 'green'
      },
      0
    ])
  })

  it('has correct commands', () => {
    const extension = Badge.create()
    const commands = extension.addCommands()
    
    expect(commands).toHaveProperty('setBadge')
    expect(commands).toHaveProperty('toggleBadge')
    expect(commands).toHaveProperty('unsetBadge')
  })
})
