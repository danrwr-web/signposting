import { render, screen } from '@testing-library/react'
import { createRef } from 'react'
import SurgeryFiltersHeader from '@/components/SurgeryFiltersHeader'
import { EffectiveSymptom } from '@/server/effectiveSymptoms'

let mockHeaderLayout: 'classic' | 'split' = 'split'

jest.mock('@/context/CardStyleContext', () => ({
  useCardStyle: () => ({ headerLayout: mockHeaderLayout, highRiskStyle: 'pill' }),
}))

jest.mock('@/components/HighRiskButtons', () => ({
  __esModule: true,
  default: () => <div data-testid="high-risk-buttons" />,
}))

const makeSymptom = (id: string, name: string): EffectiveSymptom =>
  ({ id, name, ageGroup: 'Adult', source: 'base' } as unknown as EffectiveSymptom)

const baseProps = {
  searchTerm: '',
  onSearchChange: jest.fn(),
  selectedLetter: 'All' as const,
  onLetterChange: jest.fn(),
  selectedAge: 'All' as const,
  onAgeChange: jest.fn(),
  resultsCount: 2,
  totalCount: 2,
  searchInputRef: createRef<HTMLInputElement>(),
}

const symptoms = [makeSymptom('1', 'Abdominal pain'), makeSymptom('2', 'Cough')]

beforeEach(() => {
  mockHeaderLayout = 'split'
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ count: 0 }),
  }) as jest.Mock
})

describe('SurgeryFiltersHeader letter pills', () => {
  it('disables and greys out letters that have no symptoms', () => {
    render(<SurgeryFiltersHeader {...baseProps} symptoms={symptoms} />)
    const bPill = screen.getByRole('button', { name: 'B' })
    expect(bPill).toBeDisabled()
    expect(bPill.className).toContain('text-slate-300')
  })

  it('keeps letters with symptoms enabled', () => {
    render(<SurgeryFiltersHeader {...baseProps} symptoms={symptoms} />)
    expect(screen.getByRole('button', { name: 'A' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'C' })).toBeEnabled()
  })

  it('never disables the "All" pill', () => {
    render(<SurgeryFiltersHeader {...baseProps} symptoms={symptoms} />)
    expect(screen.getByRole('button', { name: 'All' })).toBeEnabled()
  })

  it('disables nothing while symptoms are not yet loaded', () => {
    render(<SurgeryFiltersHeader {...baseProps} symptoms={undefined} />)
    expect(screen.getByRole('button', { name: 'B' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Z' })).toBeEnabled()
  })

  it('keeps the selected letter enabled even when it has no symptoms', () => {
    render(<SurgeryFiltersHeader {...baseProps} selectedLetter="B" symptoms={symptoms} />)
    expect(screen.getByRole('button', { name: 'B' })).toBeEnabled()
  })

  it('disables empty letters in the classic layout too', () => {
    mockHeaderLayout = 'classic'
    render(<SurgeryFiltersHeader {...baseProps} symptoms={symptoms} />)
    expect(screen.getByRole('button', { name: 'B' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'A' })).toBeEnabled()
  })
})
