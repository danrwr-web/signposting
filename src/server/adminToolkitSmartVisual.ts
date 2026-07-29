import 'server-only'

import { createHash } from 'crypto'
import { prisma } from '@/lib/prisma'
import { callAzureOpenAI, extractJson, type AzureOpenAIMessage } from '@/server/azureOpenAI'
import { stripHtmlToPlainText } from '@/lib/sanitizeHtml'
import {
  getIntroTextBlock,
  getFooterTextBlock,
  getRoleCardsBlock,
  splitRoleCardBodyToLines,
} from '@/lib/adminToolkitContentBlocksShared'
import {
  SMART_VISUAL_VERSION,
  SmartVisualLayoutZ,
  normalizeSmartVisualLayout,
  type SmartVisualLayout,
} from '@/lib/adminToolkitSmartVisualShared'
import type { AdminToolkitPageItem } from '@/server/adminToolkit'

const MAX_INPUT_CHARS = 16000
const MAX_LIST_ROWS_SERIALIZED = 60

/**
 * Resolve the footer HTML for a PAGE item using the same legacy fallback the
 * item view page applies (FOOTER_TEXT block, else legacy contentHtml). The
 * fingerprint and the AI source text must both see exactly what a viewer sees.
 */
function resolveFooterHtml(item: AdminToolkitPageItem): string {
  const footerBlock = getFooterTextBlock(item.contentJson ?? null)
  return footerBlock?.html ?? (item.contentHtml || '')
}

function sortedListColumns(item: AdminToolkitPageItem) {
  return [...(item.listColumns ?? [])].sort((a, b) => a.orderIndex - b.orderIndex)
}

function listRowValues(item: AdminToolkitPageItem, columnKeys: string[]): string[][] {
  return [...(item.listRows ?? [])]
    .sort((a, b) => a.orderIndex - b.orderIndex)
    .map((row) => {
      const raw = row.dataJson
      const obj =
        raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {}
      // Only values for defined columns, in column order — mirrors the list view.
      return columnKeys.map((key) => {
        const v = obj[key]
        return v === null || v === undefined ? '' : String(v)
      })
    })
}

/**
 * Canonical content snapshot for staleness detection. Built with explicit key
 * order and orderIndex-sorted arrays (ids stripped) so the same visible
 * content always produces the same hash. Excludes timestamps, attachments and
 * permissions — those don't change what the visual was generated from.
 */
function buildCanonicalSnapshot(item: AdminToolkitPageItem): Record<string, unknown> {
  const base: Record<string, unknown> = {
    type: item.type,
    title: item.title.trim(),
    warningLevel: item.warningLevel ?? null,
  }

  if (item.type === 'PAGE') {
    const intro = getIntroTextBlock(item.contentJson ?? null)?.html ?? ''
    const roleCardsBlock = getRoleCardsBlock(item.contentJson ?? null)
    const roleCards = roleCardsBlock
      ? {
          title: roleCardsBlock.title ?? null,
          layout: roleCardsBlock.layout ?? null,
          columns: roleCardsBlock.columns ?? null,
          cards: roleCardsBlock.cards.map((c) => ({ title: c.title, body: c.body })),
        }
      : null
    return { ...base, intro, roleCards, footer: resolveFooterHtml(item) }
  }

  const columns = sortedListColumns(item)
  return {
    ...base,
    columns: columns.map((c) => ({ key: c.key, label: c.label, fieldType: c.fieldType })),
    rows: listRowValues(item, columns.map((c) => c.key)),
  }
}

export function computeSmartVisualFingerprint(item: AdminToolkitPageItem): string {
  return createHash('sha256').update(JSON.stringify(buildCanonicalSnapshot(item))).digest('hex')
}

/**
 * Serialize the item content into plain text for the AI prompt.
 */
export function buildSmartVisualSourceText(item: AdminToolkitPageItem): {
  text: string
  truncated: boolean
} {
  const lines: string[] = [`TITLE: ${item.title.trim()}`]
  if (item.warningLevel) lines.push(`WARNING LEVEL: ${item.warningLevel}`)

  let rowsTruncated = false

  if (item.type === 'PAGE') {
    const intro = getIntroTextBlock(item.contentJson ?? null)?.html
    if (intro) {
      lines.push('', 'INTRO:', stripHtmlToPlainText(intro))
    }
    const roleCardsBlock = getRoleCardsBlock(item.contentJson ?? null)
    if (roleCardsBlock && roleCardsBlock.cards.length > 0) {
      lines.push('', `ROLE CARDS${roleCardsBlock.title ? ` (${roleCardsBlock.title})` : ''}:`)
      for (const card of roleCardsBlock.cards) {
        lines.push(`### ${card.title}`)
        for (const line of splitRoleCardBodyToLines(card.body)) {
          lines.push(`- ${line}`)
        }
      }
    }
    const footer = resolveFooterHtml(item)
    if (footer) {
      lines.push('', 'FOOTER:', stripHtmlToPlainText(footer))
    }
  } else {
    const columns = sortedListColumns(item)
    lines.push('', 'COLUMNS:', columns.map((c) => `${c.label} (${c.fieldType})`).join(' | '))
    const rows = listRowValues(item, columns.map((c) => c.key))
    lines.push('', 'ROWS:')
    for (const row of rows.slice(0, MAX_LIST_ROWS_SERIALIZED)) {
      lines.push(row.join(' | '))
    }
    if (rows.length > MAX_LIST_ROWS_SERIALIZED) {
      rowsTruncated = true
      lines.push(`... and ${rows.length - MAX_LIST_ROWS_SERIALIZED} more rows (omitted)`)
    }
  }

  let text = lines.join('\n')
  let truncated = rowsTruncated
  if (text.length > MAX_INPUT_CHARS) {
    text = text.slice(0, MAX_INPUT_CHARS) + '\n... [truncated — content too long to process in full]'
    truncated = true
  }
  return { text, truncated }
}

export function smartVisualItemHasContent(item: AdminToolkitPageItem): boolean {
  if (item.type === 'PAGE') {
    const intro = getIntroTextBlock(item.contentJson ?? null)
    const roleCards = getRoleCardsBlock(item.contentJson ?? null)
    const footer = resolveFooterHtml(item)
    return Boolean(intro || (roleCards && roleCards.cards.length > 0) || footer.trim())
  }
  return (item.listColumns ?? []).length > 0 && (item.listRows ?? []).length > 0
}

// This prompt is the prose rendering of SmartVisualLayoutZ in
// src/lib/adminToolkitSmartVisualShared.ts — keep the two in sync.
const SYSTEM_PROMPT = `You are converting a GP practice handbook page into a structured visual layout for reception and admin staff. You do NOT write new content — you reorganise the provided content into a fixed set of visual sections so the page becomes scannable at a glance.

OUTPUT: Return ONLY a JSON object of the form { "version": ${SMART_VISUAL_VERSION}, "sections": [ ... ] } with between 1 and 10 sections. Each section must be one of:

1. "summary" — { "type": "summary", "text": string (<=500 chars), "keyPoints"?: string[] (max 5, each <=140) }
   Use for: a short orientation paragraph when the page has mixed prose.
2. "callout" — { "type": "callout", "tone": "info"|"warning"|"urgent"|"success", "title"?: string (<=80), "body": string (<=400) }
   Use for: warnings, must-not-do rules, escalation notes. Use "urgent" only where the source is explicitly urgent/same-day/emergency.
3. "steps" — { "type": "steps", "title"?: string (<=80), "steps": [{ "title": string (<=90), "detail"?: string (<=300) }] (1-12) }
   Use for: processes carried out in order.
4. "checklist" — { "type": "checklist", "title"?: string (<=80), "items": [{ "text": string (<=200), "detail"?: string (<=200) }] (1-15) }
   Use for: things to check or verify, in any order.
5. "contacts" — { "type": "contacts", "title"?: string (<=80), "contacts": [{ "name": string (<=80), "role"?: string (<=80), "phone"?: string (<=40), "extension"?: string (<=12), "email"?: string (<=120), "note"?: string (<=160) }] (1-12) }
   Use for: people, teams or services with phone numbers, extensions or emails. Copy every phone number, extension and email VERBATIM from the source.
6. "pairs" — { "type": "pairs", "title"?: string (<=80), "leftLabel"?: string (<=40), "rightLabel"?: string (<=40), "pairs": [{ "left": string (<=80), "right": string (<=80), "note"?: string (<=120) }] (1-12) }
   Use for: buddy systems, who-covers-whom, X-maps-to-Y relationships.
7. "roles" — { "type": "roles", "title"?: string (<=80), "roles": [{ "role": string (<=80), "person"?: string (<=80), "theme"?: theme, "responsibilities": string[] (1-6, each <=180) }] (1-8) }
   Use for: responsibilities grouped by role or person.
8. "facts" — { "type": "facts", "title"?: string (<=80), "facts": [{ "label": string (<=60), "value": string (<=140), "icon"?: icon, "theme"?: theme }] (1-8) }
   Use for: standalone key facts (times, codes, locations, limits).
9. "bullets" — { "type": "bullets", "groups": [{ "title": string (<=80), "icon"?: icon, "theme"?: theme, "items": string[] (1-8, each <=220) }] (1-6) }
   Use for: grouped lists that fit none of the above.
10. "table" — { "type": "table", "title"?: string (<=80), "headers": string[] (1-6, each <=60), "rows": string[][] (1-20 rows, each row exactly as many cells as headers, each cell <=180) }
   Use ONLY when the source is genuinely tabular and small (<=20 rows). Never invent columns.

icon values: "phone", "email", "clock", "alert", "check", "info", "people", "document", "star", "calendar".
theme values: "blue" (neutral/default), "green" (go/ok), "amber" (caution), "red" (urgent/stop), "grey" (background info).

RULES:
- Plain text only in every field. No HTML, no markdown, no emojis.
- Use ONLY facts present in the source. Never invent names, numbers, times or steps.
- You do not need to include every sentence — choose the treatments that make the page scannable, and keep wording close to the source.
- Prefer 3-6 sections. Lead with the most important information.
- If the page has a warning level or urgent wording, it MUST surface as a "callout" near the top.
- Keep the original meaning exactly. Never soften or omit safety wording.
- Use British English.`

function formatZodIssues(issues: Array<{ path: PropertyKey[]; message: string }>): string {
  return issues
    .slice(0, 10)
    .map((issue) => `${issue.path.map(String).join('.') || 'root'}: ${issue.message}`)
    .join('\n')
}

export type SmartVisualGenerationResult = {
  layout: SmartVisualLayout
  sourceFingerprint: string
  modelUsed: string
}

/**
 * Generate a smart visual layout for a handbook item via Azure OpenAI.
 * The response is validated against SmartVisualLayoutZ, with one corrective
 * retry that feeds the validation errors back to the model. Token usage from
 * all attempts is logged as a single TokenUsageLog row.
 */
export async function generateSmartVisualLayout(
  item: AdminToolkitPageItem,
  userEmail: string,
): Promise<SmartVisualGenerationResult> {
  const { text: sourceText, truncated } = buildSmartVisualSourceText(item)

  const userPrompt = `HANDBOOK ITEM TYPE: ${item.type}

SOURCE CONTENT:
${sourceText}
${
  truncated && item.type === 'LIST'
    ? '\nNOTE: The row list above was truncated. Do NOT output a "table" section of the rows — summarise the structure and surface key contacts or facts instead.\n'
    : ''
}
TASK: Produce the JSON layout now.`

  const baseMessages: AzureOpenAIMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: userPrompt },
  ]

  type Attempt =
    | { ok: true; layout: SmartVisualLayout; model: string }
    | { ok: false; failure: string; rawContent: string; model: string }

  let promptTokens = 0
  let completionTokens = 0
  let totalTokens = 0

  const callAndParse = async (messages: AzureOpenAIMessage[]): Promise<Attempt> => {
    const aiResponse = await callAzureOpenAI({ messages, max_tokens: 4096, temperature: 0.4 })
    promptTokens += aiResponse.usage.prompt_tokens
    completionTokens += aiResponse.usage.completion_tokens
    totalTokens += aiResponse.usage.total_tokens

    const rawContent = aiResponse.content
    const parsed = extractJson(rawContent)
    if (!parsed) {
      return {
        ok: false,
        failure: 'root: response was not a valid JSON object',
        rawContent,
        model: aiResponse.model,
      }
    }
    const result = SmartVisualLayoutZ.safeParse(parsed)
    if (!result.success) {
      return {
        ok: false,
        failure: formatZodIssues(result.error.issues),
        rawContent,
        model: aiResponse.model,
      }
    }
    try {
      return { ok: true, layout: normalizeSmartVisualLayout(result.data), model: aiResponse.model }
    } catch {
      return {
        ok: false,
        failure: 'root: a required field was empty after removing HTML/markdown formatting',
        rawContent,
        model: aiResponse.model,
      }
    }
  }

  let attempt = await callAndParse(baseMessages)
  if (!attempt.ok) {
    const corrective = `Your previous answer was not a valid layout. Problems:\n${attempt.failure}\n\nReturn ONLY the corrected JSON object, keeping the same content. Do not add new sections.`
    attempt = await callAndParse([
      ...baseMessages,
      { role: 'assistant', content: attempt.rawContent },
      { role: 'user', content: corrective },
    ])
  }

  const modelUsed = attempt.model

  // Log token usage (non-blocking)
  try {
    const inputRate = parseFloat(process.env.AZURE_OPENAI_COST_INPUT_PER_1K_USD || '0')
    const outputRate = parseFloat(process.env.AZURE_OPENAI_COST_OUTPUT_PER_1K_USD || '0')
    const estimatedCostUsd = ((promptTokens * inputRate) + (completionTokens * outputRate)) / 1000

    await prisma.tokenUsageLog.create({
      data: {
        userEmail,
        route: 'handbookSmartVisual',
        modelUsed,
        promptTokens,
        completionTokens,
        totalTokens,
        estimatedCostUsd,
      },
    })
  } catch (error) {
    // Don't block the response if logging fails
    console.error('Failed to log token usage:', error)
  }

  if (!attempt.ok) {
    console.error('generateSmartVisualLayout: invalid layout after retry:', attempt.failure)
    throw new Error('The AI returned an invalid layout. Please try again.')
  }

  return {
    layout: attempt.layout,
    sourceFingerprint: computeSmartVisualFingerprint(item),
    modelUsed,
  }
}

export type AdminToolkitSmartVisualView = {
  layout: SmartVisualLayout
  generatedAt: Date
  modelUsed: string | null
  isStale: boolean
}

/**
 * Load the saved smart visual for an item, flagging it stale when the item's
 * current content no longer matches what the visual was generated from.
 * Returns null when no visual exists or the stored layout fails validation
 * (e.g. rows written by an older schema version) — never crash the page.
 */
export async function getAdminToolkitSmartVisualForItem(
  item: AdminToolkitPageItem,
): Promise<AdminToolkitSmartVisualView | null> {
  const row = await prisma.adminItemSmartVisual.findUnique({
    where: { adminItemId: item.id },
    select: { layoutJson: true, sourceFingerprint: true, generatedAt: true, modelUsed: true },
  })
  if (!row) return null

  const parsed = SmartVisualLayoutZ.safeParse(row.layoutJson)
  if (!parsed.success) return null

  return {
    layout: parsed.data,
    generatedAt: row.generatedAt,
    modelUsed: row.modelUsed,
    isStale: row.sourceFingerprint !== computeSmartVisualFingerprint(item),
  }
}
