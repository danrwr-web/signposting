import 'server-only'
import { prisma } from '@/lib/prisma'
import { parseListSizeCsv, csvTextFromZip, ListSizeRow } from '@/lib/practiceCsv'

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
  'Automatic download failed — download gp-reg-pat-prac-all.zip (or .csv) from the NHS Digital ' +
  '"Patients Registered at a GP Practice" publication and use the upload on the Practice Data tab instead.'

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
  /** Notes about newer month pages that were skipped during discovery. */
  diagnostics: string[]
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

/**
 * Month page URLs built directly from the publication's stable slug pattern
 * (.../patients-registered-at-a-gp-practice/july-2026), current month first,
 * going back `count` months. Constructing them beats scraping the landing page,
 * which advertises months of future placeholder pages.
 */
export function monthPageUrlsToTry(now: Date = new Date(), count = 6): string[] {
  const base = process.env.NHS_LIST_SIZE_PUBLICATION_URL || DEFAULT_PUBLICATION_URL
  const urls: string[] = []
  for (let back = 0; back < count; back++) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - back, 1))
    urls.push(`${base.replace(/\/$/, '')}/${MONTH_NAMES[d.getUTCMonth()]}-${d.getUTCFullYear()}`)
  }
  return urls
}

/** Every files.digital.nhs.uk link on a page (any file type), for diagnostics. */
export function extractAllFileLinks(html: string): string[] {
  const matches = html.match(/https:\/\/files\.digital\.nhs\.uk\/[^"'\s<>]+/gi) ?? []
  return Array.from(new Set(matches))
}

// Age/sex/geography-banded variants of the publication files that must never be
// imported in place of the all-practices file.
const BANDED_VARIANT_PATTERN = /(sing|5yr|male|female|lsoa|map|pcn|quin|sicbl|icb|region)/i

/**
 * The all-practices list-size data file link on a month page. The publication
 * shipped bare .csv files up to April 2026 and .zip bundles from May 2026, so
 * both extensions are accepted (.csv preferred when both exist). Prefers the
 * canonical gp-reg-pat-prac-all name; falls back to any other non-banded
 * gp-reg-pat-prac file to survive minor renames. Handles absolute
 * files.digital.nhs.uk links and relative hrefs.
 */
export function extractDataFileUrl(html: string, pageUrl?: string): string | null {
  const candidates = new Set<string>()

  const absolutePattern = /https:\/\/files\.digital\.nhs\.uk\/[^"'\s<>]*gp-reg-pat-prac[^"'\s<>]*\.(?:csv|zip)(?:\?[^"'\s<>]*)?/gi
  let match: RegExpExecArray | null
  while ((match = absolutePattern.exec(html)) !== null) {
    candidates.add(match[0])
  }

  const origin = pageUrl ? new URL(pageUrl).origin : 'https://digital.nhs.uk'
  const relativePattern = /href="(\/[^"]*gp-reg-pat-prac[^"]*\.(?:csv|zip)(?:\?[^"]*)?)"/gi
  while ((match = relativePattern.exec(html)) !== null) {
    candidates.add(`${origin}${match[1]}`)
  }

  const urls = Array.from(candidates)
  const preferCsv = (matches: string[]): string | null =>
    matches.find((url) => /\.csv(?:\?|$)/i.test(url)) ?? matches[0] ?? null

  const exact = urls.filter((url) => /gp-reg-pat-prac-all[^/]*\.(?:csv|zip)/i.test(url))
  if (exact.length > 0) return preferCsv(exact)

  // Fallback tier: the suffix after "gp-reg-pat-prac" must not name a banded variant
  const nonBanded = urls.filter((url) => {
    const suffix = url.slice(url.toLowerCase().lastIndexOf('gp-reg-pat-prac') + 'gp-reg-pat-prac'.length)
    return !BANDED_VARIANT_PATTERN.test(suffix)
  })
  return preferCsv(nonBanded)
}

async function fetchRaw(url: string, stage: string): Promise<Response> {
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
  return res
}

async function fetchText(url: string, stage: string): Promise<string> {
  return (await fetchRaw(url, stage)).text()
}

async function fetchBinary(url: string, stage: string): Promise<ArrayBuffer> {
  return (await fetchRaw(url, stage)).arrayBuffer()
}

export interface DataFileDiscovery {
  dataFileUrl: string
  /** One entry per newer month page that was skipped, saying why. */
  diagnostics: string[]
}

export async function discoverLatestDataFile(): Promise<DataFileDiscovery> {
  const diagnostics: string[] = []

  for (const monthUrl of monthPageUrlsToTry()) {
    const monthLabel = monthUrl.slice(monthUrl.lastIndexOf('/') + 1)
    let monthHtml: string
    try {
      monthHtml = await fetchText(monthUrl, 'loading a monthly publication page')
    } catch (err) {
      const detail =
        err instanceof PracticeDataRefreshError ? err.message : String(err)
      diagnostics.push(`${monthLabel}: page could not be loaded (${detail})`)
      continue
    }

    const dataFileUrl = extractDataFileUrl(monthHtml, monthUrl)
    if (dataFileUrl) return { dataFileUrl, diagnostics }

    // Record what file links WERE on the page so a format change is
    // diagnosable straight from the UI error/notes.
    const seen = extractAllFileLinks(monthHtml)
    diagnostics.push(
      seen.length === 0
        ? `${monthLabel}: page loaded but contains no data file links (likely not published yet)`
        : `${monthLabel}: no recognisable list-size CSV among its file links: ${seen
            .slice(0, 5)
            .join(' , ')}`
    )
  }

  throw new PracticeDataRefreshError(
    `Could not find the practice list-size CSV. ${diagnostics.join(' | ')}. ${UPLOAD_FALLBACK_HINT}`,
    `No CSV link found. Diagnostics: ${diagnostics.join(' | ')}`
  )
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
  const { dataFileUrl, diagnostics } = await discoverLatestDataFile()
  const isZip = /\.zip(?:\?|$)/i.test(dataFileUrl)

  let parsed
  try {
    const csvText = isZip
      ? csvTextFromZip(await fetchBinary(dataFileUrl, 'downloading the list-size zip'))
      : await fetchText(dataFileUrl, 'downloading the list-size CSV')
    parsed = parseListSizeCsv(csvText)
  } catch (err) {
    if (err instanceof PracticeDataRefreshError) throw err
    throw new PracticeDataRefreshError(
      `The downloaded file did not look like the expected data file: ` +
        `${err instanceof Error ? err.message : 'unknown error'}. ${UPLOAD_FALLBACK_HINT}`,
      `Parse failure for ${dataFileUrl}: ${err instanceof Error ? err.message : String(err)}`
    )
  }

  const { count } = await importListSizeRows(parsed.rows, {
    extractDate: parsed.extractDate,
    sourceUrl: dataFileUrl,
  })

  return {
    count,
    skipped: parsed.skipped,
    extractDate: parsed.extractDate?.toISOString() ?? null,
    sourceUrl: dataFileUrl,
    diagnostics,
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
