import 'server-only'
import { prisma } from '@/lib/prisma'
import { parseListSizeCsv, ListSizeRow } from '@/lib/practiceCsv'

// Maintains the NationalPracticeData list-size cache from the NHS Digital
// "Patients Registered at a GP Practice" monthly publication. The CSV download
// URL changes every month, so the automatic refresh discovers it from the
// publication landing page; a manual CSV upload covers scrape failures.

const DEFAULT_PUBLICATION_URL =
  'https://digital.nhs.uk/data-and-information/publications/statistical/patients-registered-at-a-gp-practice'

export const LIST_SIZE_STALE_DAYS = 45

/** Refuse to replace the cache with suspiciously small imports (England has ~6,000+ practices). */
export const MIN_IMPORT_ROWS = 1000

const UPLOAD_FALLBACK_HINT =
  'Automatic download failed — download gp-reg-pat-prac-all.csv from the NHS Digital ' +
  '"Patients Registered at a GP Practice" publication and use the CSV upload on the Practice Data tab instead.'

export class PracticeDataRefreshError extends Error {
  public readonly clientMessage: string

  constructor(clientMessage: string, serverDetails: string) {
    super(serverDetails)
    this.name = 'PracticeDataRefreshError'
    this.clientMessage = clientMessage
  }
}

export interface RefreshSummary {
  count: number
  skipped: number
  extractDate: string | null
  sourceUrl: string
}

export interface PracticeDataStatus {
  practiceCount: number
  extractDate: string | null
  lastRefreshedAt: string | null
  sourceUrl: string | null
  stale: boolean
}

const MONTH_NAMES = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
]

/** Hrefs to month pages of the publication (e.g. .../patients-registered-at-a-gp-practice/july-2026), absolutised. */
export function extractMonthPageUrls(html: string, baseUrl: string): string[] {
  const origin = new URL(baseUrl).origin
  const pattern = /href="([^"]*patients-registered-at-a-gp-practice\/([a-z]+)-(\d{4})[^"]*)"/gi
  const urls = new Set<string>()
  let match: RegExpExecArray | null
  while ((match = pattern.exec(html)) !== null) {
    const href = match[1]
    urls.add(href.startsWith('http') ? href : `${origin}${href.startsWith('/') ? '' : '/'}${href}`)
  }
  return Array.from(urls)
}

/** Latest by (year, month) parsed from the trailing "<month>-<year>" path segment. */
export function pickLatestMonthUrl(urls: string[]): string | null {
  let best: { url: string; year: number; month: number } | null = null
  for (const url of urls) {
    const match = url.match(/\/([a-z]+)-(\d{4})(?:\/|$)/i)
    if (!match) continue
    const month = MONTH_NAMES.indexOf(match[1].toLowerCase())
    if (month === -1) continue
    const year = parseInt(match[2], 10)
    if (!best || year > best.year || (year === best.year && month > best.month)) {
      best = { url, year, month }
    }
  }
  return best?.url ?? null
}

/** The gp-reg-pat-prac-all.csv download link on a month page. */
export function extractCsvUrl(html: string): string | null {
  const match = html.match(
    /https:\/\/files\.digital\.nhs\.uk\/[^"'\s<>]*gp-reg-pat-prac-all[^"'\s<>]*\.csv/i
  )
  return match ? match[0] : null
}

async function fetchText(url: string, stage: string): Promise<string> {
  let res: Response
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(60_000) })
  } catch (err) {
    throw new PracticeDataRefreshError(
      `Could not reach ${new URL(url).hostname} while ${stage}. ${UPLOAD_FALLBACK_HINT}`,
      `Network error (${stage}) fetching ${url}: ${err instanceof Error ? err.message : String(err)}`
    )
  }
  if (!res.ok) {
    throw new PracticeDataRefreshError(
      `Received HTTP ${res.status} while ${stage}. ${UPLOAD_FALLBACK_HINT}`,
      `HTTP ${res.status} (${stage}) fetching ${url}`
    )
  }
  return res.text()
}

export async function discoverLatestCsvUrl(): Promise<string> {
  const landingUrl = process.env.NHS_LIST_SIZE_PUBLICATION_URL || DEFAULT_PUBLICATION_URL

  const landingHtml = await fetchText(landingUrl, 'loading the NHS Digital publication page')
  const monthUrls = extractMonthPageUrls(landingHtml, landingUrl)
  const latestMonthUrl = pickLatestMonthUrl(monthUrls)
  if (!latestMonthUrl) {
    throw new PracticeDataRefreshError(
      `Could not find a monthly publication link on the NHS Digital page. ${UPLOAD_FALLBACK_HINT}`,
      `No month page links found at ${landingUrl}`
    )
  }

  const monthHtml = await fetchText(latestMonthUrl, 'loading the latest monthly publication page')
  const csvUrl = extractCsvUrl(monthHtml)
  if (!csvUrl) {
    throw new PracticeDataRefreshError(
      `Could not find the gp-reg-pat-prac-all.csv download link on the latest publication page. ${UPLOAD_FALLBACK_HINT}`,
      `No CSV link found at ${latestMonthUrl}`
    )
  }
  return csvUrl
}

function chunks<T>(items: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

export async function importListSizeRows(
  rows: ListSizeRow[],
  meta: { extractDate: Date | null; sourceUrl: string }
): Promise<{ count: number }> {
  if (rows.length < MIN_IMPORT_ROWS) {
    throw new PracticeDataRefreshError(
      `The file contained only ${rows.length} practice rows (expected several thousand) — ` +
        'the cached data was NOT changed. Check that this is the full gp-reg-pat-prac-all.csv file.',
      `Import refused: ${rows.length} rows below the ${MIN_IMPORT_ROWS}-row safety floor`
    )
  }

  await prisma.$transaction(
    async (tx) => {
      await tx.nationalPracticeData.deleteMany({})
      for (const chunk of chunks(rows, 1000)) {
        await tx.nationalPracticeData.createMany({
          data: chunk.map((row) => ({
            odsCode: row.odsCode,
            listSize: row.listSize,
            extractDate: meta.extractDate,
            sourceUrl: meta.sourceUrl,
          })),
        })
      }
    },
    { timeout: 120_000 }
  )

  return { count: rows.length }
}

export async function refreshPracticeListSizes(): Promise<RefreshSummary> {
  const csvUrl = await discoverLatestCsvUrl()
  const csvText = await fetchText(csvUrl, 'downloading the list-size CSV')

  let parsed
  try {
    parsed = parseListSizeCsv(csvText)
  } catch (err) {
    throw new PracticeDataRefreshError(
      `The downloaded file did not look like the expected CSV. ${UPLOAD_FALLBACK_HINT}`,
      `Parse failure for ${csvUrl}: ${err instanceof Error ? err.message : String(err)}`
    )
  }

  const { count } = await importListSizeRows(parsed.rows, {
    extractDate: parsed.extractDate,
    sourceUrl: csvUrl,
  })

  return {
    count,
    skipped: parsed.skipped,
    extractDate: parsed.extractDate?.toISOString() ?? null,
    sourceUrl: csvUrl,
  }
}

export async function getPracticeDataStatus(): Promise<PracticeDataStatus> {
  const [practiceCount, latest] = await Promise.all([
    prisma.nationalPracticeData.count(),
    prisma.nationalPracticeData.findFirst({
      orderBy: { updatedAt: 'desc' },
      select: { extractDate: true, updatedAt: true, sourceUrl: true },
    }),
  ])

  const lastRefreshedAt = latest?.updatedAt ?? null
  const stale =
    !lastRefreshedAt ||
    Date.now() - lastRefreshedAt.getTime() > LIST_SIZE_STALE_DAYS * 24 * 60 * 60 * 1000

  return {
    practiceCount,
    extractDate: latest?.extractDate?.toISOString() ?? null,
    lastRefreshedAt: lastRefreshedAt?.toISOString() ?? null,
    sourceUrl: latest?.sourceUrl ?? null,
    stale,
  }
}
