/**
 * NHS Badge Extension for TipTap
 * Provides coloured badges for highlighting important information
 */

import { Mark, mergeAttributes } from '@tiptap/core'

export interface BadgeOptions {
  HTMLAttributes: Record<string, any>
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    badge: {
      /**
       * Set a badge mark
       */
      setBadge: (attributes: { variant: 'red' | 'orange' | 'green' | 'purple' | 'pink' }) => ReturnType
      /**
       * Toggle a badge mark
       */
      toggleBadge: (attributes: { variant: 'red' | 'orange' | 'green' | 'purple' | 'pink' }) => ReturnType
      /**
       * Unset a badge mark
       */
      unsetBadge: () => ReturnType
    }
  }
}

const Badge = Mark.create<BadgeOptions>({
  name: 'badge',

  addOptions() {
    return {
      HTMLAttributes: {},
    }
  },

  addAttributes() {
    return {
      variant: {
        default: 'red',
        parseHTML: element => element.getAttribute('data-variant'),
        renderHTML: attributes => {
          if (!attributes.variant) {
            return {}
          }
          return {
            'data-variant': attributes.variant,
          }
        },
      },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'span[class*="rt-badge"]',
        getAttrs: (element) => {
          const el = element as HTMLElement
          const variant = el.className.match(/rt-badge--(\w+)/)?.[1]
          return variant ? { variant } : false
        },
      },
    ]
  },

  renderHTML({ HTMLAttributes, mark }) {
    const variant = mark.attrs.variant || 'red'
    return [
      'span',
      mergeAttributes(
        {
          class: `rt-badge rt-badge--${variant}`,
          'data-variant': variant,
        },
        this.options.HTMLAttributes,
        HTMLAttributes
      ),
      0,
    ]
  },

  addCommands() {
    return {
      setBadge:
        (attributes) =>
        ({ commands }) => {
          return commands.setMark(this.name, attributes)
        },
      toggleBadge:
        (attributes) =>
        ({ commands }) => {
          return commands.toggleMark(this.name, attributes)
        },
      unsetBadge:
        () =>
        ({ commands }) => {
          return commands.unsetMark(this.name)
        },
    }
  },
})

export default Badge
