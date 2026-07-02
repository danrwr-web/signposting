import { render, screen } from '@testing-library/react'
import SymptomGrid from '@/components/SymptomGrid'
import { EffectiveSymptom } from '@/server/effectiveSymptoms'

jest.mock('@/context/SurgeryContext', () => ({
  useSurgery: () => ({ currentSurgeryId: 'context-surgery' }),
}))

jest.mock('@/components/SymptomCard', () => ({
  __esModule: true,
  default: ({ symptom, surgeryId }: { symptom: { name: string }; surgeryId?: string }) => (
    <div data-testid="symptom-card" data-surgery-id={surgeryId}>
      {symptom.name}
    </div>
  ),
}))

const makeSymptom = (id: string, name: string): EffectiveSymptom =>
  ({ id, name, ageGroup: 'Adult', source: 'base' } as unknown as EffectiveSymptom)

describe('SymptomGrid', () => {
  it('renders every symptom even for large lists (no virtualization window)', () => {
    const symptoms = Array.from({ length: 200 }, (_, i) =>
      makeSymptom(`id-${i}`, `Symptom ${String(i).padStart(3, '0')}`)
    )
    render(<SymptomGrid symptoms={symptoms} />)
    expect(screen.getAllByTestId('symptom-card')).toHaveLength(200)
  })

  it('renders symptoms in alphabetical order regardless of input order', () => {
    const symptoms = [
      makeSymptom('1', 'Chest pain'),
      makeSymptom('2', 'Abdominal pain'),
      makeSymptom('3', 'Back pain'),
    ]
    render(<SymptomGrid symptoms={symptoms} />)
    const names = screen.getAllByTestId('symptom-card').map(card => card.textContent)
    expect(names).toEqual(['Abdominal pain', 'Back pain', 'Chest pain'])
  })

  it('prefers the surgeryId prop over the surgery context', () => {
    render(<SymptomGrid symptoms={[makeSymptom('1', 'Cough')]} surgeryId="prop-surgery" />)
    expect(screen.getByTestId('symptom-card')).toHaveAttribute('data-surgery-id', 'prop-surgery')
  })

  it('falls back to the surgery context when no surgeryId prop is given', () => {
    render(<SymptomGrid symptoms={[makeSymptom('1', 'Cough')]} />)
    expect(screen.getByTestId('symptom-card')).toHaveAttribute('data-surgery-id', 'context-surgery')
  })
})
