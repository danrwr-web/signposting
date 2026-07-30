import {
  SmartVisualLayoutZ,
  normalizeSmartVisualLayout,
  smartVisualSectionTypes,
  type SmartVisualLayout,
} from '@/lib/adminToolkitSmartVisualShared'

const validLayout: SmartVisualLayout = {
  version: 1,
  sections: [
    { type: 'summary', text: 'How the practice handles fire safety.', keyPoints: ['Stay calm', 'Call 999'] },
    { type: 'callout', tone: 'urgent', title: 'Emergency', body: 'If there is a fire, evacuate immediately.' },
    {
      type: 'steps',
      title: 'Evacuation process',
      steps: [
        { title: 'Raise the alarm', detail: 'Use the nearest call point.' },
        { title: 'Leave the building' },
      ],
    },
    { type: 'checklist', title: 'Daily checks', items: [{ text: 'Fire doors closed' }, { text: 'Exits clear', detail: 'Both corridors' }] },
    {
      type: 'contacts',
      title: 'Key contacts',
      contacts: [{ name: 'Site manager', role: 'Facilities', phone: '0113 496 0000', extension: '221', email: 'site@example.nhs.uk' }],
    },
    { type: 'pairs', title: 'Buddy system', leftLabel: 'Staff', rightLabel: 'Buddy', pairs: [{ left: 'Reception A', right: 'Reception B' }] },
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
    { type: 'roles', roles: [{ role: 'Fire warden', person: 'J Smith', theme: 'red', responsibilities: ['Sweep the ground floor'] }] },
    { type: 'facts', facts: [{ label: 'Assembly point', value: 'Rear car park', icon: 'info', theme: 'green' }] },
    { type: 'bullets', groups: [{ title: 'Do not', icon: 'alert', theme: 'amber', items: ['Use lifts', 'Collect belongings'] }] },
    { type: 'table', title: 'Zones', headers: ['Zone', 'Warden'], rows: [['Ground', 'J Smith'], ['First', 'A Patel']] },
  ],
}

describe('SmartVisualLayoutZ', () => {
  it('accepts a layout containing all 11 section types', () => {
    const result = SmartVisualLayoutZ.safeParse(validLayout)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(smartVisualSectionTypes(result.data)).toHaveLength(11)
    }
  })

  it('rejects people days that are not three-letter day abbreviations', () => {
    const result = SmartVisualLayoutZ.safeParse({
      version: 1,
      sections: [
        {
          type: 'people',
          groups: [{ title: 'Team', members: [{ name: 'A Person', days: ['Monday'] }] }],
        },
      ],
    })
    expect(result.success).toBe(false)
  })

  it('rejects an unknown section type', () => {
    const result = SmartVisualLayoutZ.safeParse({
      version: 1,
      sections: [{ type: 'hero', text: 'Hello' }],
    })
    expect(result.success).toBe(false)
  })

  it('rejects more than 12 sections', () => {
    const result = SmartVisualLayoutZ.safeParse({
      version: 1,
      sections: Array.from({ length: 13 }, () => ({ type: 'summary', text: 'x' })),
    })
    expect(result.success).toBe(false)
  })

  it('rejects an empty sections array', () => {
    expect(SmartVisualLayoutZ.safeParse({ version: 1, sections: [] }).success).toBe(false)
  })

  it('rejects the wrong version', () => {
    expect(
      SmartVisualLayoutZ.safeParse({ version: 2, sections: [{ type: 'summary', text: 'x' }] }).success,
    ).toBe(false)
  })

  it('rejects over-cap strings', () => {
    const result = SmartVisualLayoutZ.safeParse({
      version: 1,
      sections: [{ type: 'summary', text: 'x'.repeat(501) }],
    })
    expect(result.success).toBe(false)
  })

  it('rejects table rows whose width does not match the headers', () => {
    const result = SmartVisualLayoutZ.safeParse({
      version: 1,
      sections: [{ type: 'table', headers: ['A', 'B'], rows: [['only one cell']] }],
    })
    expect(result.success).toBe(false)
  })

  it('rejects a required field that is empty', () => {
    expect(
      SmartVisualLayoutZ.safeParse({ version: 1, sections: [{ type: 'summary', text: '   ' }] }).success,
    ).toBe(false)
  })
})

describe('normalizeSmartVisualLayout', () => {
  it('strips HTML tags and collapses whitespace', () => {
    const layout = SmartVisualLayoutZ.parse({
      version: 1,
      sections: [{ type: 'summary', text: '<b>Call</b>   the   <i>duty</i> GP' }],
    })
    const normalized = normalizeSmartVisualLayout(layout)
    expect(normalized.sections[0]).toEqual({ type: 'summary', text: 'Call the duty GP' })
  })

  it('drops optional fields that become empty after stripping', () => {
    const layout = SmartVisualLayoutZ.parse({
      version: 1,
      sections: [{ type: 'callout', tone: 'info', title: '<br/>', body: 'Body text' }],
    })
    const normalized = normalizeSmartVisualLayout(layout)
    expect(normalized.sections[0]).toEqual({ type: 'callout', tone: 'info', body: 'Body text' })
  })

  it('throws when a required field is emptied by stripping', () => {
    const layout = SmartVisualLayoutZ.parse({
      version: 1,
      sections: [{ type: 'summary', text: '<p></p>' }],
    })
    expect(() => normalizeSmartVisualLayout(layout)).toThrow()
  })
})
