import { render, screen } from '@testing-library/react'
import SmartVisualRenderer from '@/components/admin-toolkit/smart-visual/SmartVisualRenderer'
import { SmartVisualLayoutZ } from '@/lib/adminToolkitSmartVisualShared'

const layout = SmartVisualLayoutZ.parse({
  version: 1,
  sections: [
    { type: 'summary', text: 'How the buddy system works.', keyPoints: ['Check your group daily'] },
    { type: 'callout', tone: 'urgent', title: 'Emergency', body: 'Call 999 for life-threatening situations.' },
    { type: 'steps', title: 'Handover process', steps: [{ title: 'Check the rota', detail: 'Every morning.' }] },
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
              facts: [{ label: 'Nurse', value: 'Sarah M/Emma' }],
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
    expect(screen.getByText('Call 999 for life-threatening situations.')).toBeInTheDocument()
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

  it('renders a visible fallback for an unknown section type instead of nothing', () => {
    const skewedLayout = {
      version: 1,
      sections: [{ type: 'hologram', text: 'From a future version' }],
    } as unknown as typeof layout

    render(<SmartVisualRenderer layout={skewedLayout} />)

    expect(screen.getByText(/Refresh the page and try again/)).toBeInTheDocument()
  })
})
