import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import SymptomLibraryExplorer from '@/components/SymptomLibraryExplorer'

jest.mock('react-hot-toast', () => {
  const toast = (..._args: any[]) => {}
  ;(toast as any).error = jest.fn()
  ;(toast as any).success = jest.fn()
  return { toast }
})

// NewSymptomModal pulls in the rich text editor; not under test here
jest.mock('@/components/NewSymptomModal', () => ({
  __esModule: true,
  default: () => null,
}))

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status })

type FetchCall = { url: string; method: string; body?: any }

/** Installs a fetch mock and records calls for later payload assertions. */
function installFetchMock(handler: (url: string, method: string, body?: any) => Response | Promise<Response>) {
  const calls: FetchCall[] = []
  const fetchMock = jest.fn(async (input: any, init?: any) => {
    const url = typeof input === 'string' ? input : input?.url
    const method = (init?.method ?? 'GET').toUpperCase()
    const body = init?.body ? JSON.parse(init.body) : undefined
    calls.push({ url, method, body })
    return handler(url, method, body)
  })
  // @ts-expect-error - override global fetch for test
  global.fetch = fetchMock
  return { calls, fetchMock }
}

const adminProfile = { globalRole: 'USER', defaultSurgeryId: 's1', memberships: [{ surgeryId: 's1', role: 'ADMIN' }] }
const superuserProfile = { globalRole: 'SUPERUSER', defaultSurgeryId: null, memberships: [] }

const disabledCustomLibrary = {
  inUse: [
    {
      symptomId: 'c1',
      name: 'Local Thing',
      source: 'custom',
      status: 'DISABLED',
      isEnabled: false,
      canRevertToBase: false,
      statusRowId: 'row1',
      lastEditedAt: null,
      lastEditedBy: null,
    },
  ],
  available: [],
  customOnly: [],
}

describe('SymptomLibraryExplorer', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('routes View and Delete for a disabled custom symptom via customSymptomId', async () => {
    const { calls } = installFetchMock((url, method) => {
      if (url.startsWith('/api/user/profile')) return jsonResponse(adminProfile)
      if (url.startsWith('/api/surgerySymptoms') && method === 'GET') return jsonResponse(disabledCustomLibrary)
      if (url.startsWith('/api/symptomPreview')) {
        return jsonResponse({
          name: 'Local Thing',
          status: 'LOCAL_ONLY',
          isEnabled: false,
          canEnable: true,
          lastEditedBy: null,
          lastEditedAt: null,
          briefInstruction: null,
          instructionsHtml: null,
          baseInstructionsHtml: null,
          statusRowId: 'row1',
        })
      }
      if (url === '/api/admin/symptoms' && method === 'DELETE') return jsonResponse({ ok: true })
      return jsonResponse({ error: 'Unexpected request' }, 500)
    })

    render(<SymptomLibraryExplorer surgeryId="s1" />)

    // Disabled rows live in the Disabled folder
    fireEvent.click(await screen.findByRole('button', { name: /Disabled/ }))
    await screen.findByText('Local Thing')

    // View must hit the preview endpoint with the custom id, not baseSymptomId
    fireEvent.click(screen.getByRole('button', { name: 'View Local Thing' }))
    await waitFor(() => {
      const preview = calls.find(c => c.url.startsWith('/api/symptomPreview'))
      expect(preview).toBeDefined()
      expect(preview!.url).toContain('customSymptomId=c1')
      expect(preview!.url).not.toContain('baseSymptomId')
    })
    fireEvent.click(screen.getByRole('button', { name: 'Close preview' }))

    // Delete is available to a surgery admin even while the custom symptom is disabled
    fireEvent.click(screen.getByRole('button', { name: 'Delete Local Thing' }))
    expect(await screen.findByText('Delete local symptom')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))

    await waitFor(() => {
      const del = calls.find(c => c.url === '/api/admin/symptoms' && c.method === 'DELETE')
      expect(del).toBeDefined()
      expect(del!.body).toEqual({ scope: 'SURGERY', surgeryId: 's1', customSymptomId: 'c1' })
    })
  })

  it('requires typing the symptom name before a base delete is allowed (superuser)', async () => {
    const { calls } = installFetchMock((url, method) => {
      if (url.startsWith('/api/user/profile')) return jsonResponse(superuserProfile)
      if (url.startsWith('/api/admin/surgeries')) return jsonResponse([])
      if (url.startsWith('/api/surgerySymptoms') && method === 'GET') {
        return jsonResponse({
          inUse: [
            {
              symptomId: 'b1',
              name: 'Abscess',
              baseName: 'Abscess',
              source: 'base',
              status: 'BASE',
              isEnabled: true,
              canRevertToBase: false,
              statusRowId: 'row1',
              lastEditedAt: null,
              lastEditedBy: null,
            },
          ],
          available: [],
          customOnly: [],
        })
      }
      if (url === '/api/admin/symptoms' && method === 'DELETE') return jsonResponse({ ok: true })
      return jsonResponse({ error: 'Unexpected request' }, 500)
    })

    render(<SymptomLibraryExplorer surgeryId="s1" />)
    await screen.findByText('Abscess')

    fireEvent.click(screen.getByRole('button', { name: 'Delete Abscess' }))
    expect(await screen.findByText('Delete base symptom')).toBeInTheDocument()
    expect(screen.getByText(/every surgery/)).toBeInTheDocument()

    const confirmButton = screen.getByRole('button', { name: 'Delete' })
    expect(confirmButton).toBeDisabled()

    // Wrong text keeps the button disabled; the exact name enables it
    fireEvent.change(screen.getByLabelText(/Type "Abscess" to confirm/), { target: { value: 'nope' } })
    expect(confirmButton).toBeDisabled()
    fireEvent.change(screen.getByLabelText(/Type "Abscess" to confirm/), { target: { value: 'Abscess' } })
    expect(confirmButton).not.toBeDisabled()

    fireEvent.click(confirmButton)
    await waitFor(() => {
      const del = calls.find(c => c.url === '/api/admin/symptoms' && c.method === 'DELETE')
      expect(del).toBeDefined()
      expect(del!.body).toEqual({ scope: 'BASE', baseSymptomId: 'b1' })
    })
  })

  it('ignores a stale response when the surgery changes mid-fetch', async () => {
    let resolveSlow: (r: Response) => void = () => {}
    const slow = new Promise<Response>(resolve => { resolveSlow = resolve })

    installFetchMock((url, method) => {
      if (url.startsWith('/api/user/profile')) return jsonResponse(adminProfile)
      if (url.startsWith('/api/surgerySymptoms') && method === 'GET') {
        if (url.includes('surgeryId=s1')) return slow
        return jsonResponse({
          inUse: [
            {
              symptomId: 'b2',
              name: 'Surgery Two Symptom',
              baseName: 'Surgery Two Symptom',
              source: 'base',
              status: 'BASE',
              isEnabled: true,
              canRevertToBase: false,
              lastEditedAt: null,
              lastEditedBy: null,
            },
          ],
          available: [],
          customOnly: [],
        })
      }
      return jsonResponse({ error: 'Unexpected request' }, 500)
    })

    const { rerender } = render(<SymptomLibraryExplorer surgeryId="s1" />)
    rerender(<SymptomLibraryExplorer surgeryId="s2" />)

    await screen.findByText('Surgery Two Symptom')

    // The slow s1 response arrives last but must not clobber s2's data
    resolveSlow(jsonResponse({
      inUse: [
        {
          symptomId: 'b1',
          name: 'Surgery One Symptom',
          baseName: 'Surgery One Symptom',
          source: 'base',
          status: 'BASE',
          isEnabled: true,
          canRevertToBase: false,
          lastEditedAt: null,
          lastEditedBy: null,
        },
      ],
      available: [],
      customOnly: [],
    }))

    await waitFor(() => {
      expect(screen.queryByText('Surgery One Symptom')).not.toBeInTheDocument()
      expect(screen.getByText('Surgery Two Symptom')).toBeInTheDocument()
    })
  })
})
