import { NextRequest } from 'next/server'
import { GET } from '../route'
import { requireSuperuser } from '@/lib/rbac'
import { searchPractices, OdsLookupError } from '@/server/odsLookup'

jest.mock('@/lib/rbac', () => ({
  requireSuperuser: jest.fn(),
}))

jest.mock('@/server/odsLookup', () => {
  class OdsLookupError extends Error {
    constructor(
      public status: number,
      public clientMessage: string,
      serverDetails: string
    ) {
      super(serverDetails)
      this.name = 'OdsLookupError'
    }
  }
  return { searchPractices: jest.fn(), OdsLookupError }
})

const mockedRequireSuperuser = requireSuperuser as jest.MockedFunction<typeof requireSuperuser>
const mockedSearch = searchPractices as jest.MockedFunction<typeof searchPractices>

function makeRequest(q: string | null) {
  const url = new URL('http://localhost/api/super/practice-lookup')
  if (q !== null) url.searchParams.set('q', q)
  return { nextUrl: url } as unknown as NextRequest
}

describe('GET /api/super/practice-lookup', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockedRequireSuperuser.mockResolvedValue({ id: 'super-1' } as never)
  })

  it('returns 401 when not a superuser', async () => {
    mockedRequireSuperuser.mockRejectedValue(new Error('Superuser access required'))
    const res = await GET(makeRequest('ide'))
    expect(res.status).toBe(401)
  })

  it('returns 400 for queries under 2 characters', async () => {
    const res = await GET(makeRequest('a'))
    expect(res.status).toBe(400)
    expect(mockedSearch).not.toHaveBeenCalled()
  })

  it('returns mapped results', async () => {
    mockedSearch.mockResolvedValue([
      { odsCode: 'L83100', name: 'Ide Lane Surgery', postcode: 'EX2 8UP' },
    ])
    const res = await GET(makeRequest('ide lane'))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      results: [{ odsCode: 'L83100', name: 'Ide Lane Surgery', postcode: 'EX2 8UP' }],
    })
    expect(mockedSearch).toHaveBeenCalledWith('ide lane')
  })

  it('returns 502 with the client message on OdsLookupError', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {})
    mockedSearch.mockRejectedValue(new OdsLookupError(500, 'Directory unavailable', 'detail'))
    const res = await GET(makeRequest('ide'))
    expect(res.status).toBe(502)
    expect(await res.json()).toEqual({ error: 'Directory unavailable' })
  })
})
