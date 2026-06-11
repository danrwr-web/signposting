import {
  getSymptomSearchText,
  stripHtmlForSearch,
  symptomMatchesSearch,
} from '@/lib/symptomSearch'

const symptom = (fields: Partial<Parameters<typeof getSymptomSearchText>[0]> = {}) => ({
  name: 'Chest Pain',
  briefInstruction: null,
  instructions: null,
  instructionsHtml: null,
  ...fields,
})

describe('stripHtmlForSearch', () => {
  it('strips tags and decodes common entities', () => {
    expect(stripHtmlForSearch('<p>Book the <strong>Duty&nbsp;GP</strong> line</p>')).toBe(
      'Book the Duty GP line'
    )
    expect(stripHtmlForSearch('Crohn&#39;s &amp; colitis')).toBe("Crohn's & colitis")
  })

  it('keeps words split by tags searchable as a phrase', () => {
    expect(stripHtmlForSearch('<strong>chest</strong> pain')).toBe('chest pain')
    expect(stripHtmlForSearch('<li>chest</li><li>pain</li>')).toBe('chest pain')
  })
})

describe('symptomMatchesSearch', () => {
  it('matches the name and brief instruction', () => {
    expect(symptomMatchesSearch(symptom(), 'chest')).toBe(true)
    expect(
      symptomMatchesSearch(symptom({ briefInstruction: 'Route to Duty GP' }), 'duty gp')
    ).toBe(true)
  })

  it('matches terms in the displayed instructions HTML', () => {
    const s = symptom({
      instructionsHtml: '<p>Refer to the <strong>community pharmacist</strong> first</p>',
    })
    expect(symptomMatchesSearch(s, 'pharmacist')).toBe(true)
  })

  it('does NOT match stale legacy markdown when override HTML is displayed instead', () => {
    // Overrides write instructionsHtml but never the legacy `instructions`
    // field, so `instructions` can hold base content the surgery replaced.
    const s = symptom({
      instructions: 'Possible cardiac event, do not delay',
      instructionsHtml: '<p>Route to A&amp;E via ambulance</p>',
    })
    expect(symptomMatchesSearch(s, 'cardiac')).toBe(false)
    expect(symptomMatchesSearch(s, 'ambulance')).toBe(true)
  })

  it('falls back to legacy markdown when there is no HTML', () => {
    expect(
      symptomMatchesSearch(symptom({ instructions: 'Possible cardiac event' }), 'cardiac')
    ).toBe(true)
    expect(
      symptomMatchesSearch(
        symptom({ instructions: 'Possible cardiac event', instructionsHtml: '   ' }),
        'cardiac'
      )
    ).toBe(true)
  })

  it('does not match HTML markup such as tag names or class attributes', () => {
    const s = symptom({
      instructionsHtml: '<p><span class="bg-nhs-blue highlight">See GP</span></p>',
    })
    expect(symptomMatchesSearch(s, 'span')).toBe(false)
    expect(symptomMatchesSearch(s, 'highlight')).toBe(false)
    expect(symptomMatchesSearch(s, 'nhs-blue')).toBe(false)
    expect(symptomMatchesSearch(s, 'see gp')).toBe(true)
  })

  it('matches everything when the query is empty or whitespace', () => {
    expect(symptomMatchesSearch(symptom(), '')).toBe(true)
    expect(symptomMatchesSearch(symptom(), '   ')).toBe(true)
  })

  it('is case-insensitive and trims the query', () => {
    expect(symptomMatchesSearch(symptom(), '  CHEST  ')).toBe(true)
  })

  it('prefers a precomputed searchText over deriving from other fields', () => {
    // Slim payloads omit instructionsHtml; the server precomputes searchText
    // from the displayed content so stale legacy markdown is never matched.
    const s = symptom({
      searchText: 'chest pain route to a&e via ambulance',
      instructions: 'Possible cardiac event',
      instructionsHtml: null,
    })
    expect(symptomMatchesSearch(s, 'ambulance')).toBe(true)
    expect(symptomMatchesSearch(s, 'cardiac')).toBe(false)
  })
})
