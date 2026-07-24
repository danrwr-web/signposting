import PizZip from 'pizzip'
import {
  monthPageUrlsToTry,
  extractAllFileLinks,
  extractDataFileUrl,
  importListSizeRows,
  refreshPracticeListSizes,
  getPracticeDataStatus,
  isListSizeStale,
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

describe('extractDataFileUrl', () => {
  it('finds the gp-reg-pat-prac-all.csv link', () => {
    const html =
      '<a href="https://files.digital.nhs.uk/AB/12CD34/gp-reg-pat-prac-all.csv">Download</a>'
    expect(extractDataFileUrl(html)).toBe('https://files.digital.nhs.uk/AB/12CD34/gp-reg-pat-prac-all.csv')
  })

  it('finds the -all zip among banded zips (July 2026 page format)', () => {
    // Exact file set observed on the July 2026 publication page
    const html = `
      <a href="https://files.digital.nhs.uk/0C/C6EF77/gp-reg-pat-prac-all.zip">all</a>
      <a href="https://files.digital.nhs.uk/BC/2E89DF/gp-reg-pat-prac-sing-age-regions.zip">regions</a>
      <a href="https://files.digital.nhs.uk/42/8DE648/gp-reg-pat-prac-sing-age-female.zip">female</a>
      <a href="https://files.digital.nhs.uk/DC/0A7796/gp-reg-pat-prac-sing-age-male.zip">male</a>
      <a href="https://files.digital.nhs.uk/BB/362F1A/gp-reg-pat-prac-quin-age.zip">quin</a>
    `
    expect(extractDataFileUrl(html)).toBe('https://files.digital.nhs.uk/0C/C6EF77/gp-reg-pat-prac-all.zip')
  })

  it('prefers csv over zip when both -all files exist', () => {
    const html = `
      <a href="https://files.digital.nhs.uk/A/1/gp-reg-pat-prac-all.zip">zip</a>
      <a href="https://files.digital.nhs.uk/A/2/gp-reg-pat-prac-all.csv">csv</a>
    `
    expect(extractDataFileUrl(html)).toBe('https://files.digital.nhs.uk/A/2/gp-reg-pat-prac-all.csv')
  })

  it('ignores banded variants when no all-practices file exists', () => {
    const html = '<a href="https://files.digital.nhs.uk/XY/98/gp-reg-pat-prac-sing-age-male.zip">x</a>'
    expect(extractDataFileUrl(html)).toBeNull()
  })

  it('falls back to a renamed non-banded gp-reg-pat-prac file', () => {
    const html = `
      <a href="https://files.digital.nhs.uk/XY/98/gp-reg-pat-prac-lsoa.csv">lsoa</a>
      <a href="https://files.digital.nhs.uk/AB/12/gp-reg-pat-prac-totals.csv">totals</a>
    `
    expect(extractDataFileUrl(html)).toBe('https://files.digital.nhs.uk/AB/12/gp-reg-pat-prac-totals.csv')
  })

  it('tolerates query strings and relative hrefs', () => {
    expect(
      extractDataFileUrl(
        '<a href="https://files.digital.nhs.uk/A/B/gp-reg-pat-prac-all.csv?v=2">x</a>'
      )
    ).toBe('https://files.digital.nhs.uk/A/B/gp-reg-pat-prac-all.csv?v=2')

    expect(
      extractDataFileUrl(
        '<a href="/binaries/content/gp-reg-pat-prac-all.zip">x</a>',
        'https://digital.nhs.uk/data-and-information/foo'
      )
    ).toBe('https://digital.nhs.uk/binaries/content/gp-reg-pat-prac-all.zip')
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

  it('downloads and extracts a zip bundle (May 2026+ format)', async () => {
    const zip = new PizZip()
    zip.file('gp-reg-pat-prac-all.csv', makeCsvRows())
    const zipBuffer = zip.generate({ type: 'arraybuffer' })

    const mockFetch = jest
      .fn()
      .mockResolvedValueOnce(
        textResponse('<a href="https://files.digital.nhs.uk/0C/C6EF77/gp-reg-pat-prac-all.zip">zip</a>')
      )
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        arrayBuffer: async () => zipBuffer,
      } as Response)
    global.fetch = mockFetch as typeof fetch

    const summary = await refreshPracticeListSizes()
    expect(summary.count).toBe(1500)
    expect(summary.sourceUrl).toBe('https://files.digital.nhs.uk/0C/C6EF77/gp-reg-pat-prac-all.zip')
    expect(summary.extractDate).toBe('2026-07-01T00:00:00.000Z')
  })

  it('fails with the upload hint when the zip contains no CSV', async () => {
    const zip = new PizZip()
    zip.file('readme.txt', 'nothing useful')
    const zipBuffer = zip.generate({ type: 'arraybuffer' })

    const mockFetch = jest
      .fn()
      .mockResolvedValueOnce(
        textResponse('<a href="https://files.digital.nhs.uk/A/B/gp-reg-pat-prac-all.zip">zip</a>')
      )
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        arrayBuffer: async () => zipBuffer,
      } as Response)
    global.fetch = mockFetch as typeof fetch

    await expect(refreshPracticeListSizes()).rejects.toMatchObject({
      clientMessage: expect.stringContaining('no CSV file'),
    })
    expect(mockedTransaction).not.toHaveBeenCalled()
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
    expect(clientMessage).toContain('upload on the Practice Data tab')
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

describe('staleness (based on extract date, not import time)', () => {
  const NOW = new Date('2026-07-24T12:00:00Z')

  it('isListSizeStale judges by data vintage and treats unknown as stale', () => {
    expect(isListSizeStale(new Date('2026-07-01T00:00:00Z'), NOW)).toBe(false)
    expect(isListSizeStale(new Date('2026-04-01T00:00:00Z'), NOW)).toBe(true)
    expect(isListSizeStale(null, NOW)).toBe(true)
  })

  it('reports stale when an old extract was imported today', async () => {
    ;(prisma.nationalPracticeData.count as jest.Mock).mockResolvedValue(6168)
    ;(prisma.nationalPracticeData.findFirst as jest.Mock).mockResolvedValue({
      extractDate: new Date('2026-04-01T00:00:00Z'), // 3-month-old data...
      updatedAt: new Date(), // ...imported just now
      sourceUrl: 'https://files.digital.nhs.uk/x/gp-reg-pat-prac-all.csv',
    })
    const status = await getPracticeDataStatus()
    expect(status.stale).toBe(true)
    expect(status.practiceCount).toBe(6168)
  })

  it('reports fresh for a recent extract date', async () => {
    ;(prisma.nationalPracticeData.count as jest.Mock).mockResolvedValue(6168)
    ;(prisma.nationalPracticeData.findFirst as jest.Mock).mockResolvedValue({
      extractDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
      updatedAt: new Date(),
      sourceUrl: 'manual-upload',
    })
    const status = await getPracticeDataStatus()
    expect(status.stale).toBe(false)
  })

  it('reports stale when the extract date is unknown or the table is empty', async () => {
    ;(prisma.nationalPracticeData.count as jest.Mock).mockResolvedValue(6168)
    ;(prisma.nationalPracticeData.findFirst as jest.Mock).mockResolvedValue({
      extractDate: null,
      updatedAt: new Date(),
      sourceUrl: 'manual-upload',
    })
    expect((await getPracticeDataStatus()).stale).toBe(true)

    ;(prisma.nationalPracticeData.count as jest.Mock).mockResolvedValue(0)
    ;(prisma.nationalPracticeData.findFirst as jest.Mock).mockResolvedValue(null)
    expect((await getPracticeDataStatus()).stale).toBe(true)
  })
})
