import { NextRequest } from 'next/server'
import { POST } from '../route'
import { prisma } from '@/lib/prisma'
import { requireSuperuser } from '@/lib/rbac'

jest.mock('@/lib/prisma', () => ({
  prisma: {
    salesPipeline: { create: jest.fn(), findMany: jest.fn() },
  },
}))

jest.mock('@/lib/rbac', () => ({
  requireSuperuser: jest.fn(),
}))

const mockedRequireSuperuser = requireSuperuser as jest.MockedFunction<typeof requireSuperuser>
const mockedCreate = prisma.salesPipeline.create as jest.Mock

const makeReq = (body: unknown) =>
  ({ json: async () => body } as unknown as NextRequest)

describe('POST /api/super/pipeline', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockedRequireSuperuser.mockResolvedValue({ id: 'super-1' } as never)
    mockedCreate.mockImplementation(async ({ data }) => ({ id: 'pipe-1', ...data }))
  })

  it('creates an Enquiry-stage entry when the dialog sends contractVariantId: null', async () => {
    // Mirrors the Add Practice dialog payload with "-- None --" selected as the
    // contract variant (regression: this used to fail with 400 "Invalid input").
    const res = await POST(
      makeReq({
        practiceName: 'Mount Pleasant Health Centre',
        townCity: 'Tiverton',
        pcnName: 'Tiverton Pcn',
        listSize: 18652,
        status: 'Enquiry',
        freeTrial: false,
        contractVariantId: null,
      })
    )

    expect(res.status).toBe(201)
    expect(mockedCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          practiceName: 'Mount Pleasant Health Centre',
          contractVariantId: null,
          // fee auto-calculated from listSize at 7p per patient
          estimatedFeeGbp: 1305.64,
        }),
      })
    )
  })

  it('creates an entry with only a practice name', async () => {
    const res = await POST(makeReq({ practiceName: 'Minimal Practice' }))

    expect(res.status).toBe(201)
    expect(mockedCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          practiceName: 'Minimal Practice',
          status: 'Enquiry',
          freeTrial: false,
        }),
      })
    )
  })

  it('accepts explicit nulls for all optional fields', async () => {
    const res = await POST(
      makeReq({
        practiceName: 'Nullable Practice',
        odsCode: null,
        practiceAddress: null,
        townCity: null,
        pcnName: null,
        listSize: null,
        estimatedFeeGbp: null,
        contactName: null,
        contactRole: null,
        contactEmail: null,
        dateEnquiry: null,
        dateContractStart: null,
        trialEndDate: null,
        annualValueGbp: null,
        contractVariantLabel: null,
        contractVariantId: null,
        notes: null,
      })
    )

    expect(res.status).toBe(201)
  })

  it('rejects a missing practice name with 400', async () => {
    const res = await POST(makeReq({ contractVariantId: null }))

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('Invalid input')
    expect(mockedCreate).not.toHaveBeenCalled()
  })

  it('returns 401 when the caller is not a superuser', async () => {
    mockedRequireSuperuser.mockRejectedValue(new Error('Superuser access required'))

    const res = await POST(makeReq({ practiceName: 'Blocked Practice' }))

    expect(res.status).toBe(401)
    expect(mockedCreate).not.toHaveBeenCalled()
  })
})
