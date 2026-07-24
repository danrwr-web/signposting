import {
  extractMonthPageUrls,
  pickLatestMonthUrl,
  sortMonthUrlsNewestFirst,
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

describe('extractMonthPageUrls / pickLatestMonthUrl', () => {
  const base = 'https://digital.nhs.uk/data-and-information/publications/statistical/patients-registered-at-a-gp-practice'

  it('extracts and absolutises month page links', () => {
    const html = `
      <a href="/data-and-information/publications/statistical/patients-registered-at-a-gp-practice/june-2026">June</a>
      <a href="https://digital.nhs.uk/data-and-information/publications/statistical/patients-registered-at-a-gp-practice/july-2026">July</a>
      <a href="/unrelated/page">x</a>
    `
    const urls = extractMonthPageUrls(html, base)
    expect(urls).toHaveLength(2)
    expect(urls.every((u) => u.startsWith('https://digital.nhs.uk/'))).toBe(true)
  })

  it('picks the latest month across year boundaries', () => {
    const urls = [
      `${base}/december-2025`,
      `${base}/january-2026`,
      `${base}/november-2025`,
    ]
    expect(pickLatestMonthUrl(urls)).toBe(`${base}/january-2026`)
  })

  it('returns null when nothing parses', () => {
    expect(pickLatestMonthUrl(['https://example.com/foo'])).toBeNull()
  })

  it('sorts month URLs newest first', () => {
    const urls = [`${base}/november-2025`, `${base}/august-2026`, `${base}/july-2026`]
    expect(sortMonthUrlsNewestFirst(urls)).toEqual([
      `${base}/august-2026`,
      `${base}/july-2026`,
      `${base}/november-2025`,
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
  const landingUrl =
    'https://digital.nhs.uk/data-and-information/publications/statistical/patients-registered-at-a-gp-practice'

  it('discovers, downloads, parses, and imports', async () => {
    const csvRows = ['CODE,SEX,AGE,NUMBER_OF_PATIENTS,EXTRACT_DATE']
    for (let i = 0; i < 1500; i++) {
      csvRows.push(`P${i.toString().padStart(5, '0')},ALL,ALL,${2000 + i},01JUL2026`)
    }
    const mockFetch = jest
      .fn()
      .mockResolvedValueOnce(
        textResponse(`<a href="${landingUrl}/july-2026">July 2026</a>`)
      )
      .mockResolvedValueOnce(
        textResponse('<a href="https://files.digital.nhs.uk/A/B/gp-reg-pat-prac-all.csv">csv</a>')
      )
      .mockResolvedValueOnce(textResponse(csvRows.join('\n')))
    global.fetch = mockFetch as typeof fetch

    const summary = await refreshPracticeListSizes()
    expect(summary.count).toBe(1500)
    expect(summary.sourceUrl).toBe('https://files.digital.nhs.uk/A/B/gp-reg-pat-prac-all.csv')
    expect(summary.extractDate).toBe('2026-07-01T00:00:00.000Z')
    expect(prisma.nationalPracticeData.createMany).toHaveBeenCalledTimes(2)
  })

  it('skips an upcoming month page with no data files and uses the previous month', async () => {
    const csvRows = ['CODE,NUMBER_OF_PATIENTS']
    for (let i = 0; i < 1500; i++) {
      csvRows.push(`P${i.toString().padStart(5, '0')},${2000 + i}`)
    }
    const mockFetch = jest
      .fn()
      // Landing page lists a placeholder for next month plus the real latest month
      .mockResolvedValueOnce(
        textResponse(
          `<a href="${landingUrl}/august-2026">Upcoming</a><a href="${landingUrl}/july-2026">July</a>`
        )
      )
      // August page: announcement only, no data files
      .mockResolvedValueOnce(textResponse('<html>This publication is due on 07/08/2026</html>'))
      // July page has the CSV
      .mockResolvedValueOnce(
        textResponse('<a href="https://files.digital.nhs.uk/A/B/gp-reg-pat-prac-all.csv">csv</a>')
      )
      .mockResolvedValueOnce(textResponse(csvRows.join('\n')))
    global.fetch = mockFetch as typeof fetch

    const summary = await refreshPracticeListSizes()
    expect(summary.count).toBe(1500)
    expect(summary.sourceUrl).toBe('https://files.digital.nhs.uk/A/B/gp-reg-pat-prac-all.csv')
    expect(mockFetch.mock.calls[1][0]).toContain('august-2026')
    expect(mockFetch.mock.calls[2][0]).toContain('july-2026')
  })

  it('names the inspected pages when no CSV is found anywhere', async () => {
    const mockFetch = jest
      .fn()
      .mockResolvedValueOnce(
        textResponse(
          `<a href="${landingUrl}/august-2026">Upcoming</a><a href="${landingUrl}/july-2026">July</a>`
        )
      )
      .mockResolvedValue(textResponse('<html>no files here</html>'))
    global.fetch = mockFetch as typeof fetch

    const clientMessage = await refreshPracticeListSizes().then(
      () => {
        throw new Error('expected refresh to fail')
      },
      (e: PracticeDataRefreshError) => e.clientMessage
    )
    expect(clientMessage).toContain('august-2026')
    expect(clientMessage).toContain('july-2026')
    expect(clientMessage).toContain('CSV upload on the Practice Data tab')
  })

  it('fails with the upload hint when no month page is found', async () => {
    global.fetch = jest.fn().mockResolvedValue(textResponse('<html>nothing here</html>')) as typeof fetch
    await expect(refreshPracticeListSizes()).rejects.toMatchObject({
      clientMessage: expect.stringContaining('CSV upload on the Practice Data tab'),
    })
    expect(mockedTransaction).not.toHaveBeenCalled()
  })

  it('fails with the upload hint on a download error', async () => {
    const mockFetch = jest
      .fn()
      .mockResolvedValueOnce(textResponse(`<a href="${landingUrl}/july-2026">July</a>`))
      .mockResolvedValueOnce(
        textResponse('<a href="https://files.digital.nhs.uk/A/B/gp-reg-pat-prac-all.csv">csv</a>')
      )
      .mockResolvedValueOnce(textResponse('', 500))
    global.fetch = mockFetch as typeof fetch
    await expect(refreshPracticeListSizes()).rejects.toMatchObject({
      clientMessage: expect.stringContaining('HTTP 500'),
    })
  })
})
