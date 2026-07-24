import { NextRequest } from 'next/server'
import { POST } from '../route'
import { requireSuperuser } from '@/lib/rbac'
import { importListSizeRows } from '@/server/practiceListSize'

jest.mock('@/lib/rbac', () => ({
  requireSuperuser: jest.fn(),
}))

jest.mock('@/server/practiceListSize', () => {
  class PracticeDataRefreshError extends Error {
    constructor(public clientMessage: string, serverDetails: string) {
      super(serverDetails)
      this.name = 'PracticeDataRefreshError'
    }
  }
  return {
    importListSizeRows: jest.fn(),
    PracticeDataRefreshError,
    MIN_IMPORT_ROWS: 1000,
  }
})

const mockedRequireSuperuser = requireSuperuser as jest.MockedFunction<typeof requireSuperuser>
const mockedImport = importListSizeRows as jest.MockedFunction<typeof importListSizeRows>

const makeReq = (body: unknown) => ({ json: async () => body } as unknown as NextRequest)

function makeRows(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    odsCode: `P${i.toString().padStart(5, '0')}`,
    listSize: 1000 + i,
  }))
}

describe('POST /api/super/practice-data/upload', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockedRequireSuperuser.mockResolvedValue({ id: 'super-1' } as never)
    mockedImport.mockResolvedValue({ count: 1500 })
  })

  it('returns 401 when not a superuser', async () => {
    mockedRequireSuperuser.mockRejectedValue(new Error('Superuser access required'))
    const res = await POST(makeReq({ rows: makeRows(1500) }))
    expect(res.status).toBe(401)
  })

  it('rejects uploads below the row-count floor', async () => {
    const res = await POST(makeReq({ rows: makeRows(999) }))
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toContain('refusing to import')
    expect(mockedImport).not.toHaveBeenCalled()
  })

  it('imports valid uploads with the manual-upload source', async () => {
    const res = await POST(
      makeReq({ rows: makeRows(1500), extractDate: '2026-07-01T00:00:00.000Z' })
    )
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ count: 1500 })
    expect(mockedImport).toHaveBeenCalledWith(
      expect.any(Array),
      expect.objectContaining({ sourceUrl: 'manual-upload', extractDate: expect.any(Date) })
    )
  })
})
