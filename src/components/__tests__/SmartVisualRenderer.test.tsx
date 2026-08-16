import { render, screen } from '@testing-library/react'
import SmartVisualRenderer from '@/components/admin-toolkit/smart-visual/SmartVisualRenderer'
import { namedColourChipClass } from '@/components/smart-visual/smartVisualTheme'
import { SmartVisualLayoutZ } from '@/lib/adminToolkitSmartVisualShared'

const layout = SmartVisualLayoutZ.parse({
  version: 1,
  sections: [
    { type: 'summary', text: 'How the buddy system works.', keyPoints: ['Check your group daily'] },
    { type: 'callout', tone: 'urgent', title: 'Emergency', body: 'Call 999 for life-threatening situations.' },
    {
      type: 'steps',
      title: 'Handover process',
      steps: [{ title: 'Check the rota', detail: 'Every morning. Queries: 03451 551009.' }],
    },
    { type: 'checklist', items: [{ text: 'Fire doors closed' }] },
    { type: 'contacts', contacts: [{ name: 'Site manager', phone: '0113 496 0000', email: 'site@example.nhs.uk' }] },
    { type: 'pairs', pairs: [{ left: 'Reception A', right: 'Reception B' }] },
    {
      type: 'people',
      title: 'Buddy groups',
      groups: [
        {
          title: 'DWR/SH',
          theme: 'blue',
          members: [
            {
              name: 'Daniel Webber-Rookes',
              tag: 'Black',
              days: ['Mon', 'Tue', 'Thu', 'Fri'],
              facts: [
                { label: 'Nurse', value: 'Sarah M/Emma' },
                { label: 'Slot', value: 'Pale Blue' },
                { label: 'Base', value: 'The Red House surgery, 14 Green Lane, Exeter' },
              ],
            },
          ],
        },
        { title: 'Non list-holding GPs', members: [{ name: 'May Bowles', days: ['Tue', 'Thu', 'Fri'] }] },
      ],
    },
    { type: 'roles', roles: [{ role: 'Fire warden', responsibilities: ['Sweep the ground floor'] }] },
    { type: 'facts', facts: [{ label: 'Assembly point', value: 'Rear car park' }] },
    { type: 'bullets', groups: [{ title: 'Do not', items: ['Use lifts'] }] },
    { type: 'table', headers: ['Zone', 'Warden'], rows: [['Ground', 'J Smith']] },
  ],
})

describe('SmartVisualRenderer', () => {
  it('renders visible content for all 11 section types', () => {
    render(<SmartVisualRenderer layout={layout} />)

    expect(screen.getByText('How the buddy system works.')).toBeInTheDocument()
    expect(screen.getByText(/for life-threatening situations/)).toBeInTheDocument()
    expect(screen.getByText('Check the rota')).toBeInTheDocument()
    expect(screen.getByText('Fire doors closed')).toBeInTheDocument()
    expect(screen.getByText('0113 496 0000')).toBeInTheDocument()
    expect(screen.getByText('Reception B')).toBeInTheDocument()
    expect(screen.getByText('Fire warden')).toBeInTheDocument()
    expect(screen.getByText('Rear car park')).toBeInTheDocument()
    expect(screen.getByText('Use lifts')).toBeInTheDocument()
    expect(screen.getByText('J Smith')).toBeInTheDocument()

    // People section: group cards, member, tag chip, fact pair and day strip
    expect(screen.getByText('DWR/SH')).toBeInTheDocument()
    expect(screen.getByText('Non list-holding GPs')).toBeInTheDocument()
    expect(screen.getByText('Daniel Webber-Rookes')).toBeInTheDocument()
    expect(screen.getByText('Black')).toBeInTheDocument()
    expect(screen.getByText('Nurse:')).toBeInTheDocument()
    expect(screen.getByText('Sarah M/Emma')).toBeInTheDocument()
    expect(screen.getAllByLabelText(/Working days:/).length).toBe(2)

    // Contact details are real links
    expect(screen.getByRole('link', { name: '0113 496 0000' })).toHaveAttribute('href', 'tel:01134960000')
    expect(screen.getByRole('link', { name: 'site@example.nhs.uk' })).toHaveAttribute(
      'href',
      'mailto:site@example.nhs.uk',
    )
  })

  it('emphasises phone numbers in prose as bold tel: links', () => {
    render(<SmartVisualRenderer layout={layout} />)

    // A UK number inside step detail becomes a bold, dialable link.
    const stepPhone = screen.getByRole('link', { name: '03451 551009' })
    expect(stepPhone).toHaveAttribute('href', 'tel:03451551009')
    expect(stepPhone.className).toContain('font-bold')

    // 999 inside the callout body is emphasised too.
    const emergency = screen.getByRole('link', { name: '999' })
    expect(emergency).toHaveAttribute('href', 'tel:999')
  })

  it('leaves ordinary numbers in prose alone', () => {
    render(
      <SmartVisualRenderer
        layout={SmartVisualLayoutZ.parse({
          version: 1,
          sections: [{ type: 'summary', text: 'Room 14 opened in 2019 and holds 250 people.' }],
        })}
      />,
    )
    expect(screen.queryAllByRole('link')).toHaveLength(0)
  })

  it('renders colour-named tags in their own colour', () => {
    render(<SmartVisualRenderer layout={layout} />)

    // "Black" is a recognised colour word, so the chip uses the named-colour
    // style rather than the group theme's chip style.
    expect(screen.getByText('Black').className).toContain('bg-gray-900')
  })

  it('renders short colour-named fact values as coloured chips, leaving long values plain', () => {
    render(<SmartVisualRenderer layout={layout} />)

    expect(screen.getByText('Pale Blue').className).toContain('bg-sky-300')

    // A long value containing incidental colour words stays plain text.
    const address = screen.getByText('The Red House surgery, 14 Green Lane, Exeter')
    expect(address.className).not.toContain('bg-red-600')
    expect(address.className).not.toContain('bg-green-600')
  })

  it('renders a visible fallback for an unknown section type instead of nothing', () => {
    const skewedLayout = {
      version: 1,
      sections: [{ type: 'hologram', text: 'From a future version' }],
    } as unknown as typeof layout

    render(<SmartVisualRenderer layout={skewedLayout} />)

    expect(screen.getByText(/Refresh the page and try again/)).toBeInTheDocument()
  })
})

describe('namedColourChipClass', () => {
  it('maps colour words to chip styles, longest phrase first', () => {
    expect(namedColourChipClass('Black')).toBe('bg-gray-900 text-white')
    expect(namedColourChipClass('Lime Green')).toBe('bg-lime-400 text-lime-950')
    expect(namedColourChipClass('Pale Blue')).toBe('bg-sky-300 text-sky-950')
    expect(namedColourChipClass('Dark Blue')).toBe('bg-blue-900 text-white')
    expect(namedColourChipClass('Yellow Star')).toBe('bg-yellow-400 text-yellow-950')
    // Plain blue must not be caught by the dark/pale variants
    expect(namedColourChipClass('Blue')).toBe('bg-blue-600 text-white')
  })

  it('returns null for tags with no recognised colour word', () => {
    expect(namedColourChipClass('Senior Partner')).toBeNull()
    expect(namedColourChipClass('Locum')).toBeNull()
  })

  it('only matches whole colour words, not substrings of other words', () => {
    expect(namedColourChipClass('Alfred')).toBeNull() // not "red"
    expect(namedColourChipClass('Blackwell')).toBeNull() // not "black"
    expect(namedColourChipClass('Ida Greenwood')).toBeNull() // not "green"
  })
})
