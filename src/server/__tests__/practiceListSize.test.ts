import {
  monthPageUrlsToTry,
  extractAllFileLinks,
  extractCsvUrl,
  importListSizeRows,
  refreshPracticeListSizes,
  PracticeDataRefreshError,
} from '../practiceListSize'
import { prisma } from '@/lib/prisma'

jest.mock('@/lib/prisma', () => ({
  prisma: {
    nationalPracticeData: {
      deleteMany: jest.fn(),
      createMany: jest.fn(),
      count: jest.fn(),
      findFirst: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}))

const mockedTransaction = prisma.$transaction as jest.Mock

const originalFetch = global.fetch

function textResponse(body: string, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => body,
  } as Response
}

beforeEach(() => {
  jest.clearAllMocks()
  // Run transaction callbacks against the same mocked prisma delegate set
  mockedTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<void>) => fn(prisma))
})

afterEach(() => {
  global.fetch = originalFetch
})

describe('monthPageUrlsToTry', () => {
  const base = 'https://digital.nhs.uk/data-and-information/publications/statistical/patients-registered-at-a-gp-practice'

  it('builds current-month-first URLs going back the requested count, across year boundaries', () => {
    const now = new Date('2026-02-15T12:00:00Z')
    expect(monthPageUrlsToTry(now, 4)).toEqual([
      `${base}/february-2026`,
      `${base}/january-2026`,
      `${base}/december-2025`,
      `${base}/november-2025`,
    ])
  })

  it('defaults to six months', () => {
    expect(monthPageUrlsToTry(new Date('2026-07-24T12:00:00Z'))).toHaveLength(6)
  })
})

describe('extractAllFileLinks', () => {
  it('lists unique files.digital.nhs.uk links of any type', () => {
    const html = `
      <a href="https://files.digital.nhs.uk/A/1/gp-reg-pat-prac-all.zip">zip</a>
      <a href="https://files.digital.nhs.uk/A/1/gp-reg-pat-prac-all.zip">zip again</a>
      <a href="https://files.digital.nhs.uk/B/2/something-else.xlsx">xlsx</a>
      <a href="https://example.com/other.csv">not nhs</a>
    `
    expect(extractAllFileLinks(html)).toEqual([
      'https://files.digital.nhs.uk/A/1/gp-reg-pat-prac-all.zip',
      'https://files.digital.nhs.uk/B/2/something-else.xlsx',
    ])
  })
})

describe('extractCsvUrl', () => {
  it('finds the gp-reg-pat-prac-all.csv link', () => {
    const html =
      '<a href="https://files.digital.nhs.uk/AB/12CD34/gp-reg-pat-prac-all.csv">Download</a>'
    expect(extractCsvUrl(html)).toBe('https://files.digital.nhs.uk/AB/12CD34/gp-reg-pat-prac-all.csv')
  })

  it('prefers the -all file when banded variants are also present', () => {
    const html = `
      <a href="https://files.digital.nhs.uk/XY/98/gp-reg-pat-prac-sing-age-male.csv">male</a>
      <a href="https://files.digital.nhs.uk/AB/12/gp-reg-pat-prac-all.csv">all</a>
      <a href="https://files.digital.nhs.uk/XY/99/gp-reg-pat-prac-sing-age-female.csv">female</a>
    `
    expect(extractCsvUrl(html)).toBe('https://files.digital.nhs.uk/AB/12/gp-reg-pat-prac-all.csv')
  })

  it('ignores banded variants when no all-practices file exists', () => {
    const html = '<a href="https://files.digital.nhs.uk/XY/98/gp-reg-pat-prac-sing-age-male.csv">x</a>'
    expect(extractCsvUrl(html)).toBeNull()
  })

  it('falls back to a renamed non-banded gp-reg-pat-prac CSV', () => {
    const html = `
      <a href="https://files.digital.nhs.uk/XY/98/gp-reg-pat-prac-lsoa.csv">lsoa</a>
      <a href="https://files.digital.nhs.uk/AB/12/gp-reg-pat-prac-totals.csv">totals</a>
    `
    expect(extractCsvUrl(html)).toBe('https://files.digital.nhs.uk/AB/12/gp-reg-pat-prac-totals.csv')
  })

  it('tolerates query strings and relative hrefs', () => {
    expect(
      extractCsvUrl(
        '<a href="https://files.digital.nhs.uk/A/B/gp-reg-pat-prac-all.csv?v=2">x</a>'
      )
    ).toBe('https://files.digital.nhs.uk/A/B/gp-reg-pat-prac-all.csv?v=2')

    expect(
      extractCsvUrl(
        '<a href="/binaries/content/gp-reg-pat-prac-all.csv">x</a>',
        'https://digital.nhs.uk/data-and-information/foo'
      )
    ).toBe('https://digital.nhs.uk/binaries/content/gp-reg-pat-prac-all.csv')
  })
})

describe('importListSizeRows', () => {
  it('refuses tiny imports without touching the database', async () => {
    await expect(
      importListSizeRows([{ odsCode: 'A1', listSize: 100 }], { extractDate: null, sourceUrl: 'x' })
    ).rejects.toThrow(PracticeDataRefreshError)
    expect(mockedTransaction).not.toHaveBeenCalled()
    expect(prisma.nationalPracticeData.deleteMany).not.toHaveBeenCalled()
  })

  it('replaces the cache in 1000-row chunks inside a transaction', async () => {
    const rows = Array.from({ length: 6500 }, (_, i) => ({
      odsCode: `P${i.toString().padStart(5, '0')}`,
      listSize: 1000 + i,
    }))
    const result = await importListSizeRows(rows, {
      extractDate: new Date('2026-07-01T00:00:00Z'),
      sourceUrl: 'https://files.digital.nhs.uk/x/gp-reg-pat-prac-all.csv',
    })
    expect(result.count).toBe(6500)
    expect(prisma.nationalPracticeData.deleteMany).toHaveBeenCalledTimes(1)
    expect(prisma.nationalPracticeData.createMany).toHaveBeenCalledTimes(7)
    const firstChunk = (prisma.nationalPracticeData.createMany as jest.Mock).mock.calls[0][0].data
    expect(firstChunk).toHaveLength(1000)
    expect(firstChunk[0]).toMatchObject({ odsCode: 'P00000', listSize: 1000 })
  })
})

describe('refreshPracticeListSizes', () => {
  const TEST_MONTHS = [
    'january', 'february', 'march', 'april', 'may', 'june',
    'july', 'august', 'september', 'october', 'november', 'december',
  ]

  function monthSlugFor(n: number): string {
    const now = new Date()
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + n, 1))
    return `${TEST_MONTHS[d.getUTCMonth()]}-${d.getUTCFullYear()}`
  }

  function makeCsvRows(count = 1500): string {
    const rows = ['CODE,SEX,AGE,NUMBER_OF_PATIENTS,EXTRACT_DATE']
    for (let i = 0; i < count; i++) {
      rows.push(`P${i.toString().padStart(5, '0')},ALL,ALL,${2000 + i},01JUL2026`)
    }
    return rows.join('\n')
  }

  const CSV_LINK_HTML =
    '<a href="https://files.digital.nhs.uk/A/B/gp-reg-pat-prac-all.csv">csv</a>'

  it('fetches the current month page directly, downloads, parses, and imports', async () => {
    const mockFetch = jest
      .fn()
      .mockResolvedValueOnce(textResponse(CSV_LINK_HTML))
      .mockResolvedValueOnce(textResponse(makeCsvRows()))
    global.fetch = mockFetch as typeof fetch

    const summary = await refreshPracticeListSizes()
    expect(summary.count).toBe(1500)
    expect(summary.sourceUrl).toBe('https://files.digital.nhs.uk/A/B/gp-reg-pat-prac-all.csv')
    expect(summary.extractDate).toBe('2026-07-01T00:00:00.000Z')
    expect(summary.diagnostics).toEqual([])
    // No landing-page scrape: the first fetch is the current month's page itself
    expect(mockFetch.mock.calls[0][0]).toContain(monthSlugFor(0))
    expect(prisma.nationalPracticeData.createMany).toHaveBeenCalledTimes(2)
  })

  it('falls back past a not-yet-published current month and reports why', async () => {
    const mockFetch = jest
      .fn()
      // Current month: page exists but is a placeholder with no files
      .mockResolvedValueOnce(textResponse('<html>This publication is due soon</html>'))
      // Previous month has the CSV
      .mockResolvedValueOnce(textResponse(CSV_LINK_HTML))
      .mockResolvedValueOnce(textResponse(makeCsvRows()))
    global.fetch = mockFetch as typeof fetch

    const summary = await refreshPracticeListSizes()
    expect(summary.count).toBe(1500)
    expect(mockFetch.mock.calls[0][0]).toContain(monthSlugFor(0))
    expect(mockFetch.mock.calls[1][0]).toContain(monthSlugFor(-1))
    expect(summary.diagnostics).toHaveLength(1)
    expect(summary.diagnostics[0]).toContain(monthSlugFor(0))
    expect(summary.diagnostics[0]).toContain('no data file links')
  })

  it('skips a 404 month page and reports it', async () => {
    const mockFetch = jest
      .fn()
      .mockResolvedValueOnce(textResponse('not found', 404))
      .mockResolvedValueOnce(textResponse(CSV_LINK_HTML))
      .mockResolvedValueOnce(textResponse(makeCsvRows()))
    global.fetch = mockFetch as typeof fetch

    const summary = await refreshPracticeListSizes()
    expect(summary.count).toBe(1500)
    expect(summary.diagnostics[0]).toContain('could not be loaded')
  })

  it('reports the file links it did see when none match, on failure and in diagnostics', async () => {
    const unfamiliarLinks =
      '<a href="https://files.digital.nhs.uk/Z/9/patients-list-totals.zip">zip</a>'
    global.fetch = jest.fn().mockResolvedValue(textResponse(unfamiliarLinks)) as typeof fetch

    const clientMessage = await refreshPracticeListSizes().then(
      () => {
        throw new Error('expected refresh to fail')
      },
      (e: PracticeDataRefreshError) => e.clientMessage
    )
    expect(clientMessage).toContain(monthSlugFor(0))
    expect(clientMessage).toContain('https://files.digital.nhs.uk/Z/9/patients-list-totals.zip')
    expect(clientMessage).toContain('CSV upload on the Practice Data tab')
    expect(mockedTransaction).not.toHaveBeenCalled()
  })

  it('fails with the upload hint on a download error', async () => {
    const mockFetch = jest
      .fn()
      .mockResolvedValueOnce(textResponse(CSV_LINK_HTML))
      .mockResolvedValueOnce(textResponse('', 500))
    global.fetch = mockFetch as typeof fetch
    await expect(refreshPracticeListSizes()).rejects.toMatchObject({
      clientMessage: expect.stringContaining('HTTP 500'),
    })
  })
})
