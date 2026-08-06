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

  it('asks who the message is for with nothing pre-selected', () => {
    render(<SuggestFeatureDialog open onClose={onClose} surgeryId="sur-1" />)
    expect(screen.getByText('Who is your message for?')).toBeInTheDocument()
    // No destination is pre-selected: the user must actively choose one, and
    // the practice options are listed before the toolkit team.
    const radios = screen.getAllByRole('radio')
    radios.forEach((radio) => expect(radio).not.toBeChecked())
    expect(radios[0]).toBe(screen.getByRole('radio', { name: /toolkit administrators/ }))
    expect(
      screen.getByRole('radio', { name: /management or clinical team/ })
    ).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /Signposting Toolkit team/ })).toBeInTheDocument()
    // The rest of the form stays hidden until a destination is chosen
    expect(screen.queryByLabelText(/Details/)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Submit suggestion/ })).not.toBeInTheDocument()
  })

  it('shows the toolkit feedback form once the toolkit team is chosen', async () => {
    const user = userEvent.setup()
    render(<SuggestFeatureDialog open onClose={onClose} surgeryId="sur-1" />)

    await user.click(screen.getByRole('radio', { name: /Signposting Toolkit team/ }))

    // Toolkit feedback types are offered; symptom content is its own audience now
    expect(screen.getByRole('option', { name: 'Feature request' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Improvement' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Bug report' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'Symptom content' })).not.toBeInTheDocument()
    // The destination is stated explicitly
    expect(screen.getByText(/not to.*anyone at your practice/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Submit suggestion/ })).toBeInTheDocument()
  })

  it('hides the practice administrators option outside a surgery', () => {
    render(<SuggestFeatureDialog open onClose={onClose} />)
    expect(
      screen.queryByRole('radio', { name: /toolkit administrators/ })
    ).not.toBeInTheDocument()
  })

  it('pre-selects local guidance and shows the symptom name when context is given', () => {
    render(
      <SuggestFeatureDialog
        open
        onClose={onClose}
        surgeryId="sur-1"
        defaultType="SYMPTOM_CONTENT"
        symptomContext={{ baseId: 'base-1', symptomName: 'Headache' }}
      />
    )
    expect(screen.getByRole('radio', { name: /toolkit administrators/ })).toBeChecked()
    expect(screen.getByText('Headache')).toBeInTheDocument()
    // No title field for symptom-content suggestions
    expect(screen.queryByLabelText(/Title/)).not.toBeInTheDocument()
  })

  it('requires a title for feature requests', async () => {
    const user = userEvent.setup()
    render(<SuggestFeatureDialog open onClose={onClose} surgeryId="sur-1" />)

    await user.click(screen.getByRole('radio', { name: /Signposting Toolkit team/ }))
    fireEvent.change(screen.getByLabelText(/Details/), { target: { value: 'Some details' } })
    await user.click(screen.getByRole('button', { name: /Submit suggestion/ }))

    expect(await screen.findByText('Please enter a short title')).toBeInTheDocument()
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('submits the expected payload including page context', async () => {
    const user = userEvent.setup()
    render(<SuggestFeatureDialog open onClose={onClose} surgeryId="sur-1" />)

    await user.click(screen.getByRole('radio', { name: /Signposting Toolkit team/ }))
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

  it('submits a symptom-content suggestion with a typed topic when there is no symptom context', async () => {
    const user = userEvent.setup()
    render(<SuggestFeatureDialog open onClose={onClose} surgeryId="sur-1" />)

    await user.click(screen.getByRole('radio', { name: /toolkit administrators/ }))
    fireEvent.change(screen.getByLabelText(/Which symptom or guidance area/), {
      target: { value: 'Chest pain' },
    })
    fireEvent.change(screen.getByLabelText(/Details/), {
      target: { value: 'Local cardiology pathway has changed' },
    })
    await user.click(screen.getByRole('button', { name: /Submit suggestion/ }))

    await waitFor(() => expect(global.fetch).toHaveBeenCalled())
    const [, options] = (global.fetch as jest.Mock).mock.calls[0]
    expect(JSON.parse(options.body)).toEqual({
      type: 'SYMPTOM_CONTENT',
      text: 'Local cardiology pathway has changed',
      surgeryId: 'sur-1',
      symptom: 'Chest pain',
      pageContext: '/s/sur-1/signposting',
    })
  })

  it('blocks submission and explains routing for practice policy questions', async () => {
    const user = userEvent.setup()
    render(<SuggestFeatureDialog open onClose={onClose} surgeryId="sur-1" />)

    await user.click(screen.getByRole('radio', { name: /management or clinical team/ }))

    expect(
      screen.getByText(/can.t reach your practice.s management, safeguarding/)
    ).toBeInTheDocument()
    expect(screen.getByText(/contact your practice manager or clinical lead directly/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Submit suggestion/ })).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/Details/)).not.toBeInTheDocument()
    expect(global.fetch).not.toHaveBeenCalled()
  })
})
