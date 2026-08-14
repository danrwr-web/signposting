import { render, screen, within } from '@testing-library/react'
import SymptomSmartVisualRenderer from '@/components/symptom-smart-visual/SymptomSmartVisualRenderer'
import {
  SymptomSmartVisualLayoutZ,
  type SymptomSmartVisualLayout,
} from '@/lib/symptomSmartVisualShared'

const layout = SymptomSmartVisualLayoutZ.parse({
  version: 1,
  sections: [
    { type: 'callout', tone: 'urgent', title: 'Important notice', body: 'Escalate if the patient is drowsy.' },
    {
      type: 'redFlags',
      title: 'Red flags',
      action: 'Call 999 immediately',
      flags: ['Neck stiffness', 'Non-fading rash'],
    },
    {
      type: 'routing',
      title: 'Where to send the patient',
      options: [
        { when: 'Under 5 with fever', action: 'Same-day GP telephone call', urgency: 'sameDay' },
        { when: 'All other patients', action: 'Green Slot with the ANP', urgency: 'routine', note: 'Within 3 working days' },
        { when: 'Unclear', action: 'Ask the duty GP' },
      ],
    },
    { type: 'summary', text: 'Earache in adults.', keyPoints: ['Most cases are self-limiting'] },
    { type: 'steps', title: 'Questions to ask', steps: [{ title: 'How long?', detail: 'Record the duration.' }] },
    { type: 'checklist', items: [{ text: 'Confirm the age' }] },
    { type: 'pairs', pairs: [{ left: 'Pink Slot', right: 'GP phone triage' }] },
    { type: 'facts', facts: [{ label: 'Call back within', value: '2 hours', icon: 'clock' }] },
    { type: 'bullets', groups: [{ title: 'Self-care advice', items: ['Offer pain relief advice'] }] },
    { type: 'table', headers: ['Age', 'Route'], rows: [['Under 5', 'Duty GP list']] },
  ],
})

describe('SymptomSmartVisualRenderer', () => {
  it('renders every section type in the catalogue', () => {
    render(<SymptomSmartVisualRenderer layout={layout} />)

    expect(screen.getByText('Escalate if the patient is drowsy.')).toBeInTheDocument()
    expect(screen.getByText('Red flags')).toBeInTheDocument()
    expect(screen.getByText('Where to send the patient')).toBeInTheDocument()
    expect(screen.getByText('Earache in adults.')).toBeInTheDocument()
    expect(screen.getByText('How long?')).toBeInTheDocument()
    expect(screen.getByText('Confirm the age')).toBeInTheDocument()
    // "Pink" is claimed by the built-in slot highlight, so the pair label is
    // split across elements — same as in the standard instruction view.
    expect(screen.getByText('Pink').className).toContain('bg-purple-600')
    expect(screen.getByText('Call back within')).toBeInTheDocument()
    expect(screen.getByText('Self-care advice')).toBeInTheDocument()
    expect(screen.getByText('Route')).toBeInTheDocument()
  })

  it('renders red flags with their criteria and the single required action', () => {
    render(<SymptomSmartVisualRenderer layout={layout} />)

    expect(screen.getByText('Neck stiffness')).toBeInTheDocument()
    expect(screen.getByText('Non-fading rash')).toBeInTheDocument()
    expect(screen.getByText('If any apply')).toBeInTheDocument()
  })

  it('gives red flags an alert role so the escalation block is announced', () => {
    const redFlagsOnly: SymptomSmartVisualLayout = SymptomSmartVisualLayoutZ.parse({
      version: 1,
      sections: [{ type: 'redFlags', action: 'Call 999', flags: ['Chest pain'] }],
    })
    render(<SymptomSmartVisualRenderer layout={redFlagsOnly} />)

    expect(screen.getByRole('alert')).toBeInTheDocument()
    // Falls back to a sensible heading when the model omits the title.
    expect(screen.getByText('Red flags')).toBeInTheDocument()
  })

  it('renders routing options as condition → action with an urgency chip', () => {
    render(<SymptomSmartVisualRenderer layout={layout} />)

    expect(screen.getByText('Under 5 with fever')).toBeInTheDocument()
    expect(screen.getByText('Same-day GP telephone call')).toBeInTheDocument()
    expect(screen.getByText('Same day')).toBeInTheDocument()
    expect(screen.getByText('Routine')).toBeInTheDocument()
    expect(screen.getByText('Within 3 working days')).toBeInTheDocument()
  })

  it('omits the urgency chip when the model did not set one', () => {
    render(<SymptomSmartVisualRenderer layout={layout} />)

    // The third option has no urgency, so only two chips exist.
    expect(screen.getByText('Ask the duty GP')).toBeInTheDocument()
    expect(screen.queryByText('Emergency')).not.toBeInTheDocument()
  })

  it('makes 999 and local numbers dialable, deterministically', () => {
    const phones: SymptomSmartVisualLayout = SymptomSmartVisualLayoutZ.parse({
      version: 1,
      sections: [
        {
          type: 'routing',
          options: [{ when: 'Life-threatening', action: 'Call 999 or the surgery on 0113 496 0000' }],
        },
      ],
    })
    render(<SymptomSmartVisualRenderer layout={phones} />)

    expect(screen.getByRole('link', { name: '999' })).toHaveAttribute('href', 'tel:999')
    expect(screen.getByRole('link', { name: '0113 496 0000' })).toHaveAttribute(
      'href',
      'tel:01134960000'
    )
  })

  it('leaves ordinary numbers in prose alone', () => {
    const notPhones: SymptomSmartVisualLayout = SymptomSmartVisualLayoutZ.parse({
      version: 1,
      sections: [{ type: 'summary', text: 'Review again after 7 days or 14 days.' }],
    })
    render(<SymptomSmartVisualRenderer layout={notPhones} />)

    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })

  it('renders AI text as plain text, never as markup', () => {
    const injected: SymptomSmartVisualLayout = {
      version: 1,
      sections: [{ type: 'summary', text: '<img src=x onerror=alert(1)>Advice' }],
    } as SymptomSmartVisualLayout
    const { container } = render(<SymptomSmartVisualRenderer layout={injected} />)

    expect(container.querySelector('img')).toBeNull()
    expect(screen.getByText('<img src=x onerror=alert(1)>Advice')).toBeInTheDocument()
  })

  it('renders a table with matching headers and cells', () => {
    render(<SymptomSmartVisualRenderer layout={layout} />)

    const table = screen.getByRole('table')
    expect(within(table).getByText('Under 5')).toBeInTheDocument()
    expect(within(table).getByText('Duty GP list')).toBeInTheDocument()
  })

  it('applies the practice highlight rules to the visual', () => {
    const rules = [
      {
        id: 'r1',
        phrase: 'duty GP',
        textColor: '#ffffff',
        bgColor: '#da020e',
        isEnabled: true,
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
      },
    ]
    const withPhrase: SymptomSmartVisualLayout = SymptomSmartVisualLayoutZ.parse({
      version: 1,
      sections: [{ type: 'routing', options: [{ when: 'Unclear', action: 'Ask the duty GP' }] }],
    })
    render(<SymptomSmartVisualRenderer layout={withPhrase} highlightRules={rules} />)

    const highlighted = screen.getByText('duty GP')
    expect(highlighted.tagName).toBe('SPAN')
    expect(highlighted).toHaveStyle({ backgroundColor: '#da020e' })
  })

  it('applies built-in slot highlighting, and honours the practice switching it off', () => {
    const slots: SymptomSmartVisualLayout = SymptomSmartVisualLayoutZ.parse({
      version: 1,
      sections: [{ type: 'summary', text: 'Offer a Green Slot with the ANP.' }],
    })

    const { unmount } = render(<SymptomSmartVisualRenderer layout={slots} />)
    expect(screen.getByText('Green Slot').className).toContain('bg-green-600')
    unmount()

    render(<SymptomSmartVisualRenderer layout={slots} enableBuiltInHighlights={false} />)
    expect(screen.queryByText('Green Slot')).not.toBeInTheDocument()
    expect(screen.getByText('Offer a Green Slot with the ANP.')).toBeInTheDocument()
  })

  it('keeps a highlighted phone number both coloured and dialable', () => {
    const rules = [
      {
        id: 'r1',
        phrase: 'Call 999',
        textColor: '#ffffff',
        bgColor: '#da020e',
        isEnabled: true,
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
      },
    ]
    const emergency: SymptomSmartVisualLayout = SymptomSmartVisualLayoutZ.parse({
      version: 1,
      sections: [{ type: 'redFlags', action: 'Call 999 immediately', flags: ['Chest pain'] }],
    })
    render(<SymptomSmartVisualRenderer layout={emergency} highlightRules={rules} />)

    expect(screen.getByRole('link', { name: '999' })).toHaveAttribute('href', 'tel:999')
  })

  it('still emits highlighted text as text nodes, never markup', () => {
    const rules = [
      {
        id: 'r1',
        phrase: 'advice',
        textColor: '#000000',
        bgColor: '#ffff00',
        isEnabled: true,
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
      },
    ]
    const injected: SymptomSmartVisualLayout = {
      version: 1,
      sections: [{ type: 'summary', text: '<img src=x onerror=alert(1)> advice' }],
    } as SymptomSmartVisualLayout
    const { container } = render(
      <SymptomSmartVisualRenderer layout={injected} highlightRules={rules} />
    )

    expect(container.querySelector('img')).toBeNull()
    expect(screen.getByText('advice')).toHaveStyle({ backgroundColor: '#ffff00' })
  })

  it('falls back visibly for a section type this bundle does not know', () => {
    // Simulates client/server version skew rather than a schema-valid layout.
    const unknown = { version: 1, sections: [{ type: 'futureSection' }] } as unknown as SymptomSmartVisualLayout
    render(<SymptomSmartVisualRenderer layout={unknown} />)

    expect(screen.getByText(/can't be displayed by this version/i)).toBeInTheDocument()
  })
})
