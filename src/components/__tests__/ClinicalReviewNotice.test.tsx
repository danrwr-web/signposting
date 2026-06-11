import { render, screen } from '@testing-library/react'
import ClinicalReviewNotice from '@/components/ClinicalReviewNotice'
import { CLINICAL_REVIEW_PROMINENT_THRESHOLD } from '@/lib/clinicalReviewCounts'

describe('ClinicalReviewNotice', () => {
  it('renders nothing when there are no pending reviews', () => {
    const { container } = render(
      <ClinicalReviewNotice pendingCount={0} surgeryName="Test Surgery" />
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('renders the subtle note with singular copy for one pending symptom', () => {
    render(<ClinicalReviewNotice pendingCount={1} surgeryName="Test Surgery" />)
    expect(screen.getByRole('status')).toHaveTextContent(
      '1 symptom is awaiting clinical review'
    )
  })

  it('renders the subtle note with plural copy for a few pending symptoms', () => {
    render(<ClinicalReviewNotice pendingCount={3} surgeryName="Test Surgery" />)
    expect(screen.getByRole('status')).toHaveTextContent(
      '3 symptoms are awaiting clinical review'
    )
    expect(screen.queryByText(/awaiting local clinical review/)).not.toBeInTheDocument()
  })

  it('renders the prominent warning with the surgery name at the threshold', () => {
    render(
      <ClinicalReviewNotice
        pendingCount={CLINICAL_REVIEW_PROMINENT_THRESHOLD}
        surgeryName="Test Surgery"
      />
    )
    expect(screen.getByRole('status')).toHaveTextContent(
      'Content for Test Surgery is awaiting local clinical review.'
    )
  })
})
