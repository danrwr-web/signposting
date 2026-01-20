/**
 * Shared (client-safe) helpers for Admin Toolkit `contentJson` blocks.
 *
 * Keep this file free of `server-only` and heavy runtime dependencies.
 */

export type AdminToolkitContentJson = {
  blocks?: AdminToolkitContentBlock[]
}

export type AdminToolkitContentBlock = RoleCardsBlock | IntroTextBlock | FooterTextBlock | { type: string; [key: string]: unknown }

export type RoleCardsLayout = 'grid' | 'row'
export type RoleCardsColumns = 2 | 3 | 4

export type RoleCard = {
  id: string
  title: string
  body: string
  orderIndex: number
}

export type RoleCardsBlock = {
  type: 'ROLE_CARDS'
  id: string
  title?: string | null
  layout?: RoleCardsLayout | null
  columns?: RoleCardsColumns | null
  cards: RoleCard[]
}

export type IntroTextBlock = {
  type: 'INTRO_TEXT'
  html: string
}

export type FooterTextBlock = {
  type: 'FOOTER_TEXT'
  html: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function normaliseLayout(value: unknown): RoleCardsLayout {
  return value === 'row' ? 'row' : 'grid'
}

function normaliseColumns(value: unknown): RoleCardsColumns {
  return value === 2 || value === 4 ? value : 3
}

export function getRoleCardsBlock(contentJson: unknown): RoleCardsBlock | null {
  if (!isRecord(contentJson)) return null
  const blocks = Array.isArray(contentJson.blocks) ? contentJson.blocks : []

  for (const b of blocks) {
    if (!isRecord(b)) continue
    if (b.type !== 'ROLE_CARDS') continue

    const id = asString(b.id).trim()
    if (!id) continue

    const titleRaw = asString(b.title).trim()
    const title = titleRaw ? titleRaw : null

    const layout = normaliseLayout(b.layout)
    const columns = normaliseColumns(asNumber(b.columns))

    const rawCards = Array.isArray(b.cards) ? b.cards : []
    const cards: RoleCard[] = rawCards
      .map((c): RoleCard | null => {
        if (!isRecord(c)) return null
        const cid = asString(c.id).trim()
        const ctitle = asString(c.title).trim()
        const body = asString(c.body)
        const orderIndex = asNumber(c.orderIndex) ?? 0
        if (!cid) return null
        return { id: cid, title: ctitle, body, orderIndex }
      })
      .filter((x): x is RoleCard => x !== null)
      .sort((a, b) => a.orderIndex - b.orderIndex)
      .map((c, idx) => ({ ...c, orderIndex: idx }))

    return {
      type: 'ROLE_CARDS',
      id,
      title,
      layout,
      columns,
      cards,
    }
  }

  return null
}

export function splitRoleCardBodyToLines(body: string): string[] {
  return (body || '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => (l.startsWith('- ') ? l.slice(2).trim() : l))
    .filter(Boolean)
}

/**
 * Check if HTML content is effectively empty (whitespace, empty tags, etc.)
 */
export function isHtmlEmpty(html: string | null | undefined): boolean {
  if (!html) return true
  const trimmed = html.trim()
  if (!trimmed) return true
  // Remove common empty HTML tags and whitespace
  const cleaned = trimmed
    .replace(/<p[^>]*>\s*<\/p>/gi, '')
    .replace(/<br\s*\/?>/gi, '')
    .replace(/&nbsp;/gi, '')
    .replace(/\s+/g, '')
    .trim()
  return cleaned.length === 0
}

/**
 * Get a block of a specific type from contentJson
 */
export function getBlock<T extends AdminToolkitContentBlock>(
  contentJson: unknown,
  type: T['type']
): T | null {
  if (!isRecord(contentJson)) return null
  const blocks = Array.isArray(contentJson.blocks) ? contentJson.blocks : []

  for (const b of blocks) {
    if (!isRecord(b)) continue
    if (b.type !== type) continue
    return b as T
  }

  return null
}

/**
 * Get INTRO_TEXT block HTML, or null if not present/empty
 */
export function getIntroTextBlock(contentJson: unknown): IntroTextBlock | null {
  const block = getBlock<IntroTextBlock>(contentJson, 'INTRO_TEXT')
  if (!block) return null
  const html = asString(block.html).trim()
  return isHtmlEmpty(html) ? null : { type: 'INTRO_TEXT', html }
}

/**
 * Get FOOTER_TEXT block HTML, or null if not present/empty
 */
export function getFooterTextBlock(contentJson: unknown): FooterTextBlock | null {
  const block = getBlock<FooterTextBlock>(contentJson, 'FOOTER_TEXT')
  if (!block) return null
  const html = asString(block.html).trim()
  return isHtmlEmpty(html) ? null : { type: 'FOOTER_TEXT', html }
}

/**
 * Upsert a block in contentJson, replacing existing block of same type
 */
export function upsertBlock(
  contentJson: unknown,
  block: AdminToolkitContentBlock
): AdminToolkitContentJson {
  const base = isRecord(contentJson) ? ({ ...contentJson } as Record<string, unknown>) : {}
  const blocksRaw = Array.isArray(base.blocks) ? base.blocks : []
  
  // Remove existing block of same type
  const kept = blocksRaw.filter(
    (b) => !(isRecord(b) && b.type === block.type)
  )
  
  // Add new block
  return {
    ...base,
    blocks: [...kept, block],
  }
}
