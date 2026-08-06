/**
 * `briefInstruction` and `highlightedText` are plain-text fields (authored in
 * an <input>/<textarea>) that the card renders via dangerouslySetInnerHTML so
 * highlight rules can wrap matched phrases. These tests pin the two properties
 * that has to satisfy: authored markup must never become live DOM, and normal
 * highlighting must keep working.
 */

import { render, screen } from '@testing-library/react'
import SymptomCard, { CardData } from '@/components/SymptomCard'
import { EffectiveSymptom } from '@/server/effectiveSymptoms'

jest.mock('@/context/SurgeryContext', () => ({
  useSurgery: () => ({ currentSurgeryId: 'surgery-1' }),
}))

jest.mock('@/context/CardStyleContext', () => ({
  useCardStyle: () => ({ cardStyle: 'default', isSimplified: false }),
}))

const cardData: CardData = {
  highlightRules: [
    {
      id: 'rule-1',
      phrase: 'pharmacy first',
      textColor: '#ffffff',
      bgColor: '#6A0DAD',
      isEnabled: true,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  ],
  enableBuiltInHighlights: true,
  enableImageIcons: false,
  imageIcons: [],
}

function makeSymptom(overrides: Partial<EffectiveSymptom>) {
  return {
    id: 's1',
    slug: 'cough',
    name: 'Cough',
    ageGroup: 'Adult',
    briefInstruction: 'Book with duty doctor',
    highlightedText: null,
    instructions: null,
    instructionsJson: null,
    instructionsHtml: null,
    linkToPage: null,
    source: 'base',
    ...overrides,
  } as unknown as EffectiveSymptom
}

describe('SymptomCard renders plain-text fields inertly', () => {
  it('does not create live elements from markup in briefInstruction', () => {
    const symptom = makeSymptom({
      briefInstruction: '<img src="x" onerror="window.__xss = true"> Book with duty doctor',
    })

    const { container } = render(<SymptomCard symptom={symptom} surgeryId="surgery-1" cardData={cardData} />)

    expect(container.querySelector('img')).toBeNull()
    // The payload is still visible to staff, just as text rather than markup.
    expect(
      screen.getByText(/<img src="x" onerror="window.__xss = true"> Book with duty doctor/)
    ).toBeInTheDocument()
  })

  it('does not create live elements from markup in highlightedText', () => {
    const symptom = makeSymptom({
      highlightedText: '<a href="https://evil.example" onclick="steal()">Ring this number</a>',
    })

    const { container } = render(<SymptomCard symptom={symptom} surgeryId="surgery-1" cardData={cardData} />)

    expect(container.querySelector('a[href="https://evil.example"]')).toBeNull()
    expect(screen.getByText(/Ring this number<\/a>/)).toBeInTheDocument()
  })

  it('still applies a custom highlight rule to briefInstruction', () => {
    const symptom = makeSymptom({ briefInstruction: 'Try pharmacy first before booking' })

    const { container } = render(<SymptomCard symptom={symptom} surgeryId="surgery-1" cardData={cardData} />)

    const highlighted = container.querySelector('span.text-sm')
    expect(highlighted).not.toBeNull()
    expect(highlighted).toHaveTextContent('pharmacy first')
    expect(highlighted?.getAttribute('style')).toContain('background-color: #6A0DAD')
  })

  it('still applies built-in slot highlighting to highlightedText', () => {
    const symptom = makeSymptom({ highlightedText: 'Use a green slot only' })

    const { container } = render(<SymptomCard symptom={symptom} surgeryId="surgery-1" cardData={cardData} />)

    const builtIn = container.querySelector('span.bg-green-600')
    expect(builtIn).not.toBeNull()
    expect(builtIn).toHaveTextContent('green slot')
  })
})
