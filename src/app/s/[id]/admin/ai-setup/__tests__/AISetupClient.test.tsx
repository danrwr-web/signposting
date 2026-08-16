import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AISetupClient from '../AISetupClient'
import type { SessionUser } from '@/lib/rbac'
import type { AppointmentModelConfig } from '@/lib/api-contracts'

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), refresh: jest.fn() }),
}))

jest.mock('react-hot-toast', () => ({
  __esModule: true,
  default: { success: jest.fn(), error: jest.fn() },
}))

const SYMPTOMS = [
  { id: 's1', name: 'Chest pain', ageGroup: 'Adult' },
  { id: 's2', name: 'Headache', ageGroup: 'Adult' },
  { id: 's3', name: 'Rash', ageGroup: 'U5' },
]

const archetype = { enabled: true, localName: 'Routine GP', clinicianRole: 'GP', description: '' }

const appointmentModel = {
  routineContinuityGp: archetype,
  routineGpPhone: { ...archetype, enabled: false },
  gpTriage48h: { ...archetype, enabled: false },
  urgentSameDayPhone: { ...archetype, enabled: false },
  urgentSameDayF2F: { ...archetype, enabled: false },
  otherClinicianDirect: { ...archetype, enabled: false },
  clinicianArchetypes: [],
} as unknown as AppointmentModelConfig

const user: SessionUser = {
  id: 'u1',
  email: 'admin@example.com',
  globalRole: 'USER',
  isTestUser: false,
  symptomsUsed: 0,
  memberships: [{ surgeryId: 'surgery-1', role: 'ADMIN' }],
}

function renderClient(overrides: Partial<React.ComponentProps<typeof AISetupClient>> = {}) {
  return render(
    <AISetupClient
      surgeryId="surgery-1"
      surgeryName="Ide Lane Surgery"
      onboardingCompleted
      featureEnabled
      appointmentModel={appointmentModel}
      user={user}
      {...overrides}
    />
  )
}

describe('AISetupClient — whole-library customisation', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    global.fetch = jest.fn(async (url: string) => {
      if (String(url).includes('/api/admin/symptoms')) {
        return { ok: true, json: async () => ({ symptoms: SYMPTOMS }) }
      }
      return { ok: true, json: async () => ({ processedCount: 1, skippedCount: 0 }) }
    }) as unknown as typeof fetch
  })

  const runButton = () =>
    screen.getByRole('button', { name: /Generate AI-customised instructions/i })

  it('does not start customising until the warning is confirmed', async () => {
    const person = userEvent.setup()
    renderClient()

    await waitFor(() => expect(runButton()).toBeEnabled())
    await person.click(runButton())

    // The point of the dialog: the click alone must not rewrite the library.
    const calls = (global.fetch as jest.Mock).mock.calls.map(c => String(c[0]))
    expect(calls.some(u => u.includes('customise-instructions'))).toBe(false)
    expect(screen.getByText('Customise every symptom?')).toBeInTheDocument()
  })

  it('names the two consequences an admin cannot see coming', async () => {
    const person = userEvent.setup()
    renderClient()

    await waitFor(() => expect(runButton()).toBeEnabled())
    await person.click(runButton())

    // Hand edits are overwritten — 'all' does not skip them the way Smart
    // re-run does — and approved symptoms drop back to pending review.
    expect(screen.getByText(/will be replaced/i)).toBeInTheDocument()
    expect(screen.getByText(/pending clinical\s+review/i)).toBeInTheDocument()
    // The count is the part that makes the scale concrete.
    expect(
      screen.getByRole('button', { name: /Customise all 3 symptoms/i })
    ).toBeInTheDocument()
  })

  it('cancelling leaves the library untouched', async () => {
    const person = userEvent.setup()
    renderClient()

    await waitFor(() => expect(runButton()).toBeEnabled())
    await person.click(runButton())
    await person.click(screen.getByRole('button', { name: 'Cancel' }))

    await waitFor(() =>
      expect(screen.queryByText('Customise every symptom?')).not.toBeInTheDocument()
    )
    const calls = (global.fetch as jest.Mock).mock.calls.map(c => String(c[0]))
    expect(calls.some(u => u.includes('customise-instructions'))).toBe(false)
  })

  it('confirming runs it', async () => {
    const person = userEvent.setup()
    renderClient()

    await waitFor(() => expect(runButton()).toBeEnabled())
    await person.click(runButton())
    await person.click(screen.getByRole('button', { name: /Customise all 3 symptoms/i }))

    await waitFor(() => {
      const calls = (global.fetch as jest.Mock).mock.calls.map(c => String(c[0]))
      expect(calls.some(u => u.includes('customise-instructions'))).toBe(true)
    })
  })

  it('points a practice admin at manual selection, not the superuser-only option', async () => {
    const person = userEvent.setup()
    renderClient()

    await waitFor(() => expect(runButton()).toBeEnabled())
    await person.click(runButton())

    // Smart re-run is behind isSuperuser, so telling a practice admin to pick
    // it would send them looking for a control that is not on their screen.
    // Scoped to the dialog: both labels also exist in the radio list behind it.
    const dialog = within(screen.getByRole('dialog'))
    expect(dialog.getByText('Select symptoms manually')).toBeInTheDocument()
    expect(dialog.queryByText('Smart re-run')).not.toBeInTheDocument()
  })

  it('offers a superuser the option that spares hand-edited wording', async () => {
    const person = userEvent.setup()
    renderClient({ user: { ...user, globalRole: 'SUPERUSER' } })

    await waitFor(() => expect(runButton()).toBeEnabled())
    await person.click(runButton())

    const dialog = within(screen.getByRole('dialog'))
    expect(dialog.getByText('Smart re-run')).toBeInTheDocument()
    expect(dialog.queryByText('Select symptoms manually')).not.toBeInTheDocument()
  })
})
