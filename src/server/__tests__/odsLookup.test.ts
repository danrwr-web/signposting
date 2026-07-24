import {
  searchPractices,
  getPracticeDetail,
  mapOdsSearchResponse,
  mapOdsOrganisation,
  findActivePcnCode,
  toTitleCase,
  OdsLookupError,
} from '../odsLookup'

const originalFetch = global.fetch

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response
}

afterEach(() => {
  global.fetch = originalFetch
  jest.restoreAllMocks()
})

describe('toTitleCase', () => {
  it('title-cases ALL-CAPS ODS names including separators', () => {
    expect(toTitleCase('PINHOE & BROADCLYST MEDICAL PRACTICE')).toBe(
      'Pinhoe & Broadclyst Medical Practice'
    )
    expect(toTitleCase("ST THOMAS'S SURGERY (EXETER)")).toBe("St Thomas's Surgery (Exeter)")
    expect(toTitleCase('IDE LANE SURGERY')).toBe('Ide Lane Surgery')
  })
})

describe('mapOdsSearchResponse', () => {
  it('maps organisations to search results', () => {
    const json = {
      Organisations: [
        { Name: 'IDE LANE SURGERY', OrgId: 'L83100', PostCode: 'EX2 8UP', Status: 'Active' },
        { Name: 'NO CODE PRACTICE' },
      ],
    }
    expect(mapOdsSearchResponse(json)).toEqual([
      { odsCode: 'L83100', name: 'Ide Lane Surgery', postcode: 'EX2 8UP' },
    ])
  })

  it('returns empty array for malformed payloads', () => {
    expect(mapOdsSearchResponse({})).toEqual([])
    expect(mapOdsSearchResponse(null)).toEqual([])
  })
})

describe('mapOdsOrganisation', () => {
  it('maps the detail payload including address', () => {
    const json = {
      Organisation: {
        Name: 'IDE LANE SURGERY',
        OrgId: { extension: 'L83100' },
        GeoLoc: {
          Location: {
            AddrLn1: 'IDE LANE',
            AddrLn2: 'ALPHINGTON',
            Town: 'EXETER',
            PostCode: 'EX2 8UP',
          },
        },
      },
    }
    expect(mapOdsOrganisation(json)).toEqual({
      odsCode: 'L83100',
      name: 'Ide Lane Surgery',
      addressLines: ['Ide Lane', 'Alphington'],
      town: 'Exeter',
      postcode: 'EX2 8UP',
    })
  })

  it('throws OdsLookupError on malformed payloads', () => {
    expect(() => mapOdsOrganisation({})).toThrow(OdsLookupError)
  })
})

describe('findActivePcnCode', () => {
  const rels = [
    {
      Status: 'Inactive',
      Target: { OrgId: { extension: 'U00001' }, PrimaryRoleId: { id: 'RO272' } },
    },
    {
      Status: 'Active',
      Target: { OrgId: { extension: 'Q12345' }, PrimaryRoleId: { id: 'RO98' } },
    },
    {
      Status: 'Active',
      Target: { OrgId: { extension: 'U67890' }, PrimaryRoleId: { id: 'RO272' } },
    },
  ]

  it('picks the active RO272 relationship only', () => {
    expect(findActivePcnCode(rels)).toBe('U67890')
  })

  it('returns null when there is no active PCN rel', () => {
    expect(findActivePcnCode([rels[0], rels[1]])).toBeNull()
    expect(findActivePcnCode(undefined)).toBeNull()
  })
})

describe('searchPractices', () => {
  it('builds the expected URL and maps results', async () => {
    const mockFetch = jest.fn().mockResolvedValue(
      jsonResponse({ Organisations: [{ Name: 'IDE LANE SURGERY', OrgId: 'L83100' }] })
    )
    global.fetch = mockFetch as typeof fetch

    const results = await searchPractices('ide lane')
    expect(results).toEqual([{ odsCode: 'L83100', name: 'Ide Lane Surgery', postcode: null }])

    const url = mockFetch.mock.calls[0][0] as string
    expect(url).toContain('Name=ide%20lane')
    expect(url).toContain('Status=Active')
    expect(url).toContain('PrimaryRoleId=RO177')
    expect(url).toContain('NonPrimaryRoleId=RO76')
    expect(url).toContain('_format=json')
  })

  it('treats upstream 404 as no matches', async () => {
    global.fetch = jest.fn().mockResolvedValue(jsonResponse({}, 404)) as typeof fetch
    await expect(searchPractices('zzzz')).resolves.toEqual([])
  })

  it('throws a typed error with a client-safe message on 500', async () => {
    global.fetch = jest.fn().mockResolvedValue(jsonResponse({}, 500)) as typeof fetch
    await expect(searchPractices('ide')).rejects.toMatchObject({
      name: 'OdsLookupError',
      clientMessage: expect.stringContaining('temporarily unavailable'),
    })
  })

  it('throws status 0 on network failure', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('ECONNREFUSED')) as typeof fetch
    await expect(searchPractices('ide')).rejects.toMatchObject({ status: 0 })
  })
})

describe('getPracticeDetail', () => {
  const detailPayload = {
    Organisation: {
      Name: 'IDE LANE SURGERY',
      OrgId: { extension: 'L83100' },
      GeoLoc: { Location: { AddrLn1: 'IDE LANE', Town: 'EXETER', PostCode: 'EX2 8UP' } },
      Rels: {
        Rel: [
          {
            Status: 'Active',
            Target: { OrgId: { extension: 'U11111' }, PrimaryRoleId: { id: 'RO272' } },
          },
        ],
      },
    },
  }

  it('resolves the PCN name with a second fetch', async () => {
    const mockFetch = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse(detailPayload))
      .mockResolvedValueOnce(jsonResponse({ Organisation: { Name: 'OUTER EXETER PCN' } }))
    global.fetch = mockFetch as typeof fetch

    const detail = await getPracticeDetail('L83100')
    expect(detail).toEqual({
      odsCode: 'L83100',
      name: 'Ide Lane Surgery',
      addressLines: ['Ide Lane'],
      town: 'Exeter',
      postcode: 'EX2 8UP',
      pcnCode: 'U11111',
      pcnName: 'Outer Exeter Pcn',
    })
    expect(mockFetch).toHaveBeenCalledTimes(2)
    expect(mockFetch.mock.calls[1][0]).toContain('/organisations/U11111')
  })

  it('degrades to pcnName null when the PCN fetch fails', async () => {
    jest.spyOn(console, 'warn').mockImplementation(() => {})
    const mockFetch = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse(detailPayload))
      .mockRejectedValueOnce(new Error('timeout'))
    global.fetch = mockFetch as typeof fetch

    const detail = await getPracticeDetail('L83100')
    expect(detail.pcnCode).toBe('U11111')
    expect(detail.pcnName).toBeNull()
  })

  it('throws a 404 typed error when the practice is unknown', async () => {
    global.fetch = jest.fn().mockResolvedValue(jsonResponse({}, 404)) as typeof fetch
    await expect(getPracticeDetail('XXXXX')).rejects.toMatchObject({
      status: 404,
      clientMessage: expect.stringContaining('not found'),
    })
  })
})
