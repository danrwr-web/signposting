import 'server-only'

// Client for the free public NHS ODS ORD API (the national register of health
// and care organisations). GP practices are primary role RO177 (prescribing
// cost centre) with non-primary role RO76; PCNs are role RO272.
//
// NOTE: this API is not reachable from the development sandbox — behaviour is
// covered by mocked-fetch unit tests and verified on a deployed preview.

const ODS_BASE = 'https://directory.spineservices.nhs.uk/ORD/2-0-0'
const REQUEST_TIMEOUT_MS = 10_000

export class OdsLookupError extends Error {
  public readonly status: number
  public readonly clientMessage: string

  constructor(status: number, clientMessage: string, serverDetails: string) {
    super(serverDetails)
    this.name = 'OdsLookupError'
    this.status = status
    this.clientMessage = clientMessage
  }
}

export interface OdsSearchResult {
  odsCode: string
  name: string
  postcode: string | null
}

export interface OdsPracticeDetail {
  odsCode: string
  name: string
  addressLines: string[]
  town: string | null
  postcode: string | null
  pcnCode: string | null
  pcnName: string | null
}

// Loose structural types for the relevant parts of ORD API payloads
interface OrdSearchOrganisation {
  Name?: unknown
  OrgId?: unknown
  PostCode?: unknown
}

interface OrdLocation {
  AddrLn1?: unknown
  AddrLn2?: unknown
  AddrLn3?: unknown
  Town?: unknown
  PostCode?: unknown
}

interface OrdRel {
  Status?: unknown
  Target?: {
    OrgId?: { extension?: unknown }
    PrimaryRoleId?: { id?: unknown }
  }
}

interface OrdOrganisationPayload {
  Organisation?: {
    Name?: unknown
    OrgId?: { extension?: unknown }
    GeoLoc?: { Location?: OrdLocation }
    Rels?: { Rel?: unknown }
  }
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value : null
}

/**
 * "PINHOE & BROADCLYST MEDICAL PRACTICE" → "Pinhoe & Broadclyst Medical Practice".
 * Letters after apostrophes stay lowercase so possessives ("St Thomas's") survive.
 */
export function toTitleCase(value: string): string {
  return value
    .toLowerCase()
    .replace(/(^|[\s\-–/(&.])([a-z])/g, (_m, sep: string, ch: string) => sep + ch.toUpperCase())
    .trim()
}

export function mapOdsSearchResponse(json: unknown): OdsSearchResult[] {
  const orgs = (json as { Organisations?: unknown })?.Organisations
  if (!Array.isArray(orgs)) return []
  const results: OdsSearchResult[] = []
  for (const org of orgs as OrdSearchOrganisation[]) {
    const odsCode = asString(org?.OrgId)
    const name = asString(org?.Name)
    if (!odsCode || !name) continue
    results.push({
      odsCode,
      name: toTitleCase(name),
      postcode: asString(org?.PostCode),
    })
  }
  return results
}

export function mapOdsOrganisation(json: unknown): Omit<OdsPracticeDetail, 'pcnCode' | 'pcnName'> {
  const org = (json as OrdOrganisationPayload)?.Organisation
  const name = asString(org?.Name)
  if (!name) {
    throw new OdsLookupError(
      502,
      'The NHS ODS directory returned an unexpected response.',
      `Malformed organisation payload: ${JSON.stringify(json).slice(0, 500)}`
    )
  }
  const location = org?.GeoLoc?.Location ?? {}
  const addressLines = [location.AddrLn1, location.AddrLn2, location.AddrLn3]
    .map(asString)
    .filter((l): l is string => l !== null)
    .map(toTitleCase)
  const town = asString(location.Town)
  return {
    odsCode: asString(org?.OrgId?.extension) ?? '',
    name: toTitleCase(name),
    addressLines,
    town: town ? toTitleCase(town) : null,
    postcode: asString(location.PostCode),
  }
}

/** Finds the ODS code of the active related Primary Care Network, if any. */
export function findActivePcnCode(rels: unknown): string | null {
  const list = Array.isArray(rels) ? (rels as OrdRel[]) : []
  for (const rel of list) {
    if (rel?.Status !== 'Active') continue
    if (rel?.Target?.PrimaryRoleId?.id !== 'RO272') continue
    const code = asString(rel?.Target?.OrgId?.extension)
    if (code) return code
  }
  return null
}

function classifyOdsError(status: number, details: string): OdsLookupError {
  if (status === 429) {
    return new OdsLookupError(
      status,
      'The NHS ODS directory is rate-limiting requests. Wait a moment and try again.',
      details
    )
  }
  if (status >= 500) {
    return new OdsLookupError(
      status,
      'The NHS ODS directory is temporarily unavailable. Try again shortly, or fill the fields in manually.',
      details
    )
  }
  return new OdsLookupError(status, 'The NHS ODS directory rejected the request.', details)
}

async function odsFetch(url: string): Promise<Response> {
  try {
    return await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
  } catch (err) {
    throw new OdsLookupError(
      0,
      'Unable to reach the NHS ODS directory. Check the connection and try again, or fill the fields in manually.',
      `Network error fetching ${url}: ${err instanceof Error ? err.message : String(err)}`
    )
  }
}

export async function searchPractices(query: string): Promise<OdsSearchResult[]> {
  const url =
    `${ODS_BASE}/organisations?Name=${encodeURIComponent(query)}` +
    '&Status=Active&PrimaryRoleId=RO177&NonPrimaryRoleId=RO76&Limit=20&_format=json'
  const res = await odsFetch(url)
  // The ORD API answers 404 for searches with no matches.
  if (res.status === 404) return []
  if (!res.ok) {
    throw classifyOdsError(res.status, `ODS search failed (${res.status}) for ${url}`)
  }
  return mapOdsSearchResponse(await res.json())
}

export async function getPracticeDetail(odsCode: string): Promise<OdsPracticeDetail> {
  const url = `${ODS_BASE}/organisations/${encodeURIComponent(odsCode)}`
  const res = await odsFetch(url)
  if (res.status === 404) {
    throw new OdsLookupError(
      404,
      'Practice not found in the NHS ODS register.',
      `ODS organisation ${odsCode} returned 404`
    )
  }
  if (!res.ok) {
    throw classifyOdsError(res.status, `ODS detail failed (${res.status}) for ${url}`)
  }
  const json = (await res.json()) as OrdOrganisationPayload
  const base = mapOdsOrganisation(json)
  const pcnCode = findActivePcnCode(json?.Organisation?.Rels?.Rel)

  let pcnName: string | null = null
  if (pcnCode) {
    // Best effort: a failed PCN name fetch never blocks the practice detail.
    try {
      const pcnRes = await odsFetch(`${ODS_BASE}/organisations/${encodeURIComponent(pcnCode)}`)
      if (pcnRes.ok) {
        const pcnJson = (await pcnRes.json()) as OrdOrganisationPayload
        const rawName = asString(pcnJson?.Organisation?.Name)
        if (rawName) pcnName = toTitleCase(rawName)
      }
    } catch (err) {
      console.warn(
        `ODS PCN lookup failed for ${pcnCode}:`,
        err instanceof Error ? err.message : err
      )
    }
  }

  return { ...base, odsCode: base.odsCode || odsCode, pcnCode, pcnName }
}
