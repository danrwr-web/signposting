import { render, screen } from '@testing-library/react'
import SymptomCard from '@/components/SymptomCard'
import { EffectiveSymptom } from '@/server/effectiveSymptoms'

let mockIsSimplified = false

jest.mock('@/context/SurgeryContext', () => ({
  useSurgery: () => ({ currentSurgeryId: 'surgery-1' }),
}))

jest.mock('@/context/CardStyleContext', () => ({
  useCardStyle: () => ({ cardStyle: 'default', isSimplified: mockIsSimplified }),
}))

const symptom = {
  id: 's1',
  slug: 'cough',
  name: 'Cough',
  ageGroup: 'U5',
  briefInstruction: 'Book with duty doctor',
  highlightedText: null,
  instructions: null,
  instructionsJson: null,
  instructionsHtml: null,
  linkToPage: null,
  source: 'base',
} as unknown as EffectiveSymptom

describe('SymptomCard age badge visibility', () => {
  beforeEach(() => {
    mockIsSimplified = false
  })

  it('shows the age badge by default on the normal card', () => {
    render(<SymptomCard symptom={symptom} surgeryId="surgery-1" />)
    expect(screen.getByText('Under 5')).toBeInTheDocument()
  })

  it('hides the age badge on the normal card when hideAgeBands is set, keeping the source badge', () => {
    render(<SymptomCard symptom={symptom} surgeryId="surgery-1" hideAgeBands />)
    expect(screen.queryByText('Under 5')).not.toBeInTheDocument()
    expect(screen.getByText('base')).toBeInTheDocument()
  })

  it('hides the age badge on the simplified card when hideAgeBands is set', () => {
    mockIsSimplified = true
    render(<SymptomCard symptom={symptom} surgeryId="surgery-1" hideAgeBands />)
    expect(screen.queryByText('Under 5')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Cough' })).toBeInTheDocument()
  })
})
