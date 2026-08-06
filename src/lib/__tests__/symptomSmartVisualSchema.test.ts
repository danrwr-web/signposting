import {
  SymptomSmartVisualLayoutZ,
  normalizeSymptomSmartVisualLayout,
  symptomSmartVisualSectionTypes,
  type SymptomSmartVisualLayout,
} from '@/lib/symptomSmartVisualShared'

const wrap = (sections: unknown[]) => ({ version: 1, sections })

const parse = (sections: unknown[]) => SymptomSmartVisualLayoutZ.safeParse(wrap(sections))

describe('SymptomSmartVisualLayoutZ — section catalogue', () => {
  it('accepts every section type in the catalogue', () => {
    const result = parse([
      { type: 'summary', text: 'Earache in adults.', keyPoints: ['Most cases self-limiting'] },
      { type: 'callout', tone: 'urgent', title: 'Important', body: 'Do not delay escalation.' },
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
        ],
      },
      { type: 'steps', title: 'Process', steps: [{ title: 'Ask how long', detail: 'Record the duration.' }] },
      { type: 'checklist', items: [{ text: 'Confirm the patient’s age' }] },
      { type: 'pairs', leftLabel: 'Local term', rightLabel: 'Meaning', pairs: [{ left: 'Pink Slot', right: 'GP phone triage' }] },
      { type: 'facts', facts: [{ label: 'Call back within', value: '2 hours', icon: 'clock', theme: 'amber' }] },
      { type: 'bullets', groups: [{ title: 'Advice', icon: 'info', theme: 'blue', items: ['Offer pain relief advice'] }] },
      { type: 'table', headers: ['Age', 'Route'], rows: [['Under 5', 'Same day']] },
    ])

    expect(result.success).toBe(true)
    if (result.success) {
      expect(symptomSmartVisualSectionTypes(result.data)).toEqual([
        'summary',
        'callout',
        'redFlags',
        'routing',
        'steps',
        'checklist',
        'pairs',
        'facts',
        'bullets',
        'table',
      ])
    }
  })

  it('rejects the handbook-only section types that were deliberately dropped', () => {
    expect(parse([{ type: 'people', groups: [{ title: 'Team', members: [{ name: 'A' }] }] }]).success).toBe(false)
    expect(parse([{ type: 'roles', roles: [{ role: 'GP', responsibilities: ['Triage'] }] }]).success).toBe(false)
    expect(parse([{ type: 'contacts', contacts: [{ name: 'Reception' }] }]).success).toBe(false)
  })

  it('rejects an unknown section type', () => {
    expect(parse([{ type: 'bogus', text: 'hello' }]).success).toBe(false)
  })

  it('rejects a wrong schema version', () => {
    expect(SymptomSmartVisualLayoutZ.safeParse({ version: 2, sections: [{ type: 'summary', text: 'x' }] }).success).toBe(false)
  })

  it('rejects an empty section list and more than 12 sections', () => {
    expect(parse([]).success).toBe(false)
    const many = Array.from({ length: 13 }, () => ({ type: 'summary', text: 'Filler.' }))
    expect(parse(many).success).toBe(false)
  })

  it('rejects strings over their cap', () => {
    expect(parse([{ type: 'summary', text: 'x'.repeat(501) }]).success).toBe(false)
    expect(parse([{ type: 'callout', tone: 'info', body: 'x'.repeat(401) }]).success).toBe(false)
    expect(parse([{ type: 'redFlags', action: 'x'.repeat(201), flags: ['Fever'] }]).success).toBe(false)
  })
})

describe('redFlags section', () => {
  it('requires an action and at least one flag', () => {
    expect(parse([{ type: 'redFlags', flags: ['Neck stiffness'] }]).success).toBe(false)
    expect(parse([{ type: 'redFlags', action: 'Call 999', flags: [] }]).success).toBe(false)
    expect(parse([{ type: 'redFlags', action: 'Call 999', flags: ['Neck stiffness'] }]).success).toBe(true)
  })
})

describe('routing section', () => {
  it('accepts only the fixed urgency values', () => {
    for (const urgency of ['emergency', 'sameDay', 'urgent', 'routine']) {
      expect(parse([{ type: 'routing', options: [{ when: 'A', action: 'B', urgency }] }]).success).toBe(true)
    }
    // Free-text urgency would let the model paraphrase (and so soften) urgency.
    expect(parse([{ type: 'routing', options: [{ when: 'A', action: 'B', urgency: 'quite urgent' }] }]).success).toBe(false)
  })

  it('allows urgency to be omitted, so the model need not guess', () => {
    expect(parse([{ type: 'routing', options: [{ when: 'A', action: 'B' }] }]).success).toBe(true)
  })

  it('requires both sides of an option', () => {
    expect(parse([{ type: 'routing', options: [{ when: 'A' }] }]).success).toBe(false)
    expect(parse([{ type: 'routing', options: [{ action: 'B' }] }]).success).toBe(false)
  })
})

describe('table section', () => {
  it('requires every row to match the header count', () => {
    expect(parse([{ type: 'table', headers: ['A', 'B'], rows: [['1']] }]).success).toBe(false)
    expect(parse([{ type: 'table', headers: ['A', 'B'], rows: [['1', '2', '3']] }]).success).toBe(false)
    expect(parse([{ type: 'table', headers: ['A', 'B'], rows: [['1', '2']] }]).success).toBe(true)
  })
})

describe('normalizeSymptomSmartVisualLayout', () => {
  it('strips HTML tags and collapses whitespace', () => {
    const layout = SymptomSmartVisualLayoutZ.parse(
      wrap([{ type: 'summary', text: '<b>Bold</b>   advice<script>alert(1)</script>' }])
    )
    const normalised = normalizeSymptomSmartVisualLayout(layout)
    const section = normalised.sections[0] as { type: 'summary'; text: string }
    expect(section.text).not.toContain('<')
    expect(section.text).toBe('Bold advice alert(1)')
  })

  it('strips tags inside red flag and routing text too', () => {
    const layout = SymptomSmartVisualLayoutZ.parse(
      wrap([
        { type: 'redFlags', action: '<em>Call 999</em>', flags: ['<b>Neck stiffness</b>'] },
        { type: 'routing', options: [{ when: '<i>Under 5</i>', action: '<b>Same day</b>' }] },
      ])
    )
    const normalised = normalizeSymptomSmartVisualLayout(layout)
    const flags = normalised.sections[0] as { action: string; flags: string[] }
    const routing = normalised.sections[1] as { options: Array<{ when: string; action: string }> }
    expect(flags.action).toBe('Call 999')
    expect(flags.flags[0]).toBe('Neck stiffness')
    expect(routing.options[0].when).toBe('Under 5')
    expect(routing.options[0].action).toBe('Same day')
  })

  it('drops optional string fields that become empty after stripping', () => {
    const layout = SymptomSmartVisualLayoutZ.parse(
      wrap([{ type: 'checklist', title: 'Checks', items: [{ text: 'Ask the age', detail: '<span></span>' }] }])
    )
    const normalised = normalizeSymptomSmartVisualLayout(layout)
    const section = normalised.sections[0] as { items: Array<{ text: string; detail?: string }> }
    expect(section.items[0].detail).toBeUndefined()
  })

  it('throws when a required field is emptied by stripping, rather than saving an out-of-contract layout', () => {
    // Bypasses the schema's own min(1) because the tags satisfy it pre-strip.
    const layout = SymptomSmartVisualLayoutZ.parse(wrap([{ type: 'summary', text: '<span></span>' }]))
    expect(() => normalizeSymptomSmartVisualLayout(layout)).toThrow('invalid after normalisation')
  })

  it('is idempotent for already-clean layouts', () => {
    const layout: SymptomSmartVisualLayout = SymptomSmartVisualLayoutZ.parse(
      wrap([{ type: 'routing', options: [{ when: 'Under 5', action: 'Same-day call', urgency: 'sameDay' }] }])
    )
    expect(normalizeSymptomSmartVisualLayout(normalizeSymptomSmartVisualLayout(layout))).toEqual(layout)
  })
})
