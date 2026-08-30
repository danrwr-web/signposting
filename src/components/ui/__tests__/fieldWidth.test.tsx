import { render, screen } from '@testing-library/react'
import { Input, Select, Textarea } from '@/components/ui'
import { hasWidthClass, defaultFieldWidth } from '@/components/ui/fieldWidth'

describe('hasWidthClass', () => {
  it.each(['w-auto', 'w-full', 'w-32', 'w-1/2', 'w-fit', '!w-auto', 'text-sm w-auto'])(
    'recognises %s as a width',
    cls => expect(hasWidthClass(cls)).toBe(true)
  )

  it.each(['', 'text-sm', 'max-w-xs', 'min-w-0', 'shadow-md', 'overflow-x-auto'])(
    'does not mistake %s for a width',
    cls => expect(hasWidthClass(cls)).toBe(false)
  )

  it.each(['sm:w-1/2', 'hover:w-64', 'md:w-auto'])(
    'leaves the base width in place for the variant-prefixed %s',
    cls => {
      // A responsive width layers on top of w-full and beats it on its own,
      // so suppressing the default would strip the intended mobile width.
      expect(hasWidthClass(cls)).toBe(false)
    }
  )
})

describe('defaultFieldWidth', () => {
  it('applies w-full when the caller specifies no width', () => {
    expect(defaultFieldWidth('text-sm')).toBe('w-full')
  })

  it('keeps w-full alongside a responsive override', () => {
    expect(defaultFieldWidth('sm:w-1/2')).toBe('w-full')
  })

  it('yields to a caller-supplied width', () => {
    // Tailwind emits width utilities alphabetically, so w-full would otherwise
    // beat w-auto on source order however the classes are ordered here.
    expect(defaultFieldWidth('w-auto text-sm')).toBe('')
  })
})

describe('form primitives', () => {
  const cases = [
    ['Input', (className?: string) => <Input aria-label="field" className={className} />],
    ['Select', (className?: string) => <Select aria-label="field" className={className} />],
    ['Textarea', (className?: string) => <Textarea aria-label="field" className={className} />],
  ] as const

  it.each(cases)('%s fills its container by default', (_name, renderEl) => {
    render(renderEl())
    expect(screen.getByLabelText('field').className).toContain('w-full')
  })

  it.each(cases)('%s drops w-full when given its own width', (_name, renderEl) => {
    render(renderEl('w-auto'))
    const el = screen.getByLabelText('field')
    expect(el.className).toContain('w-auto')
    expect(el.className).not.toContain('w-full')
  })

  it.each(cases)('%s keeps the rest of its styling when width is overridden', (_name, renderEl) => {
    render(renderEl('w-32'))
    expect(screen.getByLabelText('field').className).toContain('rounded-md')
  })
})
