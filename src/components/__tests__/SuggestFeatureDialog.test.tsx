import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SuggestFeatureDialog from '../SuggestFeatureDialog'

jest.mock('next/navigation', () => ({
  usePathname: () => '/s/sur-1/signposting',
}))

jest.mock('react-hot-toast', () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}))

describe('SuggestFeatureDialog', () => {
  const onClose = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({}) }) as jest.Mock
  })

  it('renders without the symptom-content option by default', () => {
    render(<SuggestFeatureDialog open onClose={onClose} surgeryId="sur-1" />)
    expect(screen.getByRole('option', { name: 'Feature request' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Improvement' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Bug report' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'Symptom content' })).not.toBeInTheDocument()
  })

  it('pre-selects symptom content and shows the symptom name when context is given', () => {
    render(
      <SuggestFeatureDialog
        open
        onClose={onClose}
        surgeryId="sur-1"
        defaultType="SYMPTOM_CONTENT"
        symptomContext={{ baseId: 'base-1', symptomName: 'Headache' }}
      />
    )
    expect(screen.getByRole('option', { name: 'Symptom content' })).toBeInTheDocument()
    expect(screen.getByText('Headache')).toBeInTheDocument()
    // No title field for symptom-content suggestions
    expect(screen.queryByLabelText(/Title/)).not.toBeInTheDocument()
  })

  it('requires a title for feature requests', async () => {
    const user = userEvent.setup()
    render(<SuggestFeatureDialog open onClose={onClose} surgeryId="sur-1" />)

    fireEvent.change(screen.getByLabelText(/Details/), { target: { value: 'Some details' } })
    await user.click(screen.getByRole('button', { name: /Submit suggestion/ }))

    expect(await screen.findByText('Please enter a short title')).toBeInTheDocument()
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('submits the expected payload including page context', async () => {
    const user = userEvent.setup()
    render(<SuggestFeatureDialog open onClose={onClose} surgeryId="sur-1" />)

    fireEvent.change(screen.getByLabelText(/Title/), { target: { value: 'Dark mode' } })
    fireEvent.change(screen.getByLabelText(/Details/), { target: { value: 'Please add dark mode' } })
    await user.click(screen.getByRole('button', { name: /Submit suggestion/ }))

    await waitFor(() => expect(global.fetch).toHaveBeenCalled())
    const [url, options] = (global.fetch as jest.Mock).mock.calls[0]
    expect(url).toBe('/api/suggestions')
    expect(JSON.parse(options.body)).toEqual({
      type: 'FEATURE',
      title: 'Dark mode',
      text: 'Please add dark mode',
      surgeryId: 'sur-1',
      pageContext: '/s/sur-1/signposting',
    })
    await waitFor(() => expect(onClose).toHaveBeenCalled())
  })
})
