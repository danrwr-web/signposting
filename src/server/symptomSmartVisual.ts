import 'server-only'

import { createHash } from 'crypto'
import { prisma } from '@/lib/prisma'
import { callAzureOpenAI, extractJson, type AzureOpenAIMessage } from '@/server/azureOpenAI'
// stripHtmlToPlainText drops <img> entirely, so adding or removing an inline
// image intentionally does not change the fingerprint or mark a visual stale.
import { stripHtmlToPlainText } from '@/lib/sanitizeHtml'
import { formatAgeGroupLabel } from '@/lib/ageGroups'
import {
  SYMPTOM_SMART_VISUAL_VERSION,
  SymptomSmartVisualLayoutZ,
  normalizeSymptomSmartVisualLayout,
  type SymptomSmartVisualLayout,
} from '@/lib/symptomSmartVisualShared'
import type { EffectiveSymptom } from '@/server/effectiveSymptoms'

const MAX_INPUT_CHARS = 12000
const MAX_GUIDANCE_CHARS = 500

/** variantKey value meaning "the symptom's own instructions", not a variant. */
export const MAIN_VARIANT_KEY = ''

type VariantGroup = { key: string; label: string; instructions: string }

/**
 * The age-group variants a viewer can choose between, or [] when the symptom
 * has none (or the practice has hidden them). Mirrors the read path in
 * InstructionView: `symptom.variants` is already the effective value, with a
 * surgery override shadowing the base symptom's.
 */
export function symptomVariantGroups(symptom: EffectiveSymptom): VariantGroup[] {
  const variants = symptom.variants as { ageGroups?: unknown } | null | undefined
  if (!variants || !Array.isArray(variants.ageGroups)) return []
  return variants.ageGroups
    .filter((g): g is VariantGroup => {
      if (!g || typeof g !== 'object') return false
      const group = g as Record<string, unknown>
      return typeof group.key === 'string' && typeof group.instructions === 'string'
    })
    .map((g) => ({ key: g.key, label: g.label ?? g.key, instructions: g.instructions }))
}

export type ResolvedSymptomVariant = {
  variantKey: string
  /** Human-readable label for the variant, or null for the main instructions. */
  variantLabel: string | null
  instructionsHtml: string
}

/**
 * Resolve the instructions a viewer actually sees for a given variant key.
 * Returns null when the key names a variant this symptom does not have — the
 * caller must reject rather than silently fall back to the main instructions,
 * or a visual could be saved against wording it was not generated from.
 */
export function resolveSymptomVariant(
  symptom: EffectiveSymptom,
  variantKey: string
): ResolvedSymptomVariant | null {
  if (variantKey === MAIN_VARIANT_KEY) {
    return {
      variantKey: MAIN_VARIANT_KEY,
      variantLabel: null,
      instructionsHtml: symptom.instructionsHtml || symptom.instructions || '',
    }
  }
  const group = symptomVariantGroups(symptom).find((g) => g.key === variantKey)
  if (!group) return null
  return {
    variantKey: group.key,
    variantLabel: group.label,
    instructionsHtml: group.instructions || '',
  }
}

/**
 * Options that change what the AI is shown. Anything added here is picked up
 * by the fingerprint automatically — see
 * `computeSymptomSmartVisualFingerprint`.
 */
export type SymptomSmartVisualSourceOptions = {
  /** Practice hides age bands, so the prompt omits age-group framing. */
  hideAgeBands?: boolean
}

/**
 * Staleness fingerprint: a hash of the exact source text the AI was given.
 *
 * Deliberately derived from `buildSymptomSmartVisualSourceText` rather than
 * from a parallel snapshot of the symptom's fields. A separate snapshot has to
 * be kept in step with the prompt builder by hand, and drifts silently the
 * moment either side gains an input the other doesn't know about (the
 * `hideAgeBands` option was exactly that). Hashing the prompt input makes the
 * two impossible to diverge: if the AI would see something different, the
 * visual is stale, by construction.
 */
export function computeSymptomSmartVisualFingerprint(
  symptom: EffectiveSymptom,
  variant: ResolvedSymptomVariant,
  options: SymptomSmartVisualSourceOptions = {}
): string {
  // Deliberately the FULL text, not the truncated prompt: hashing the
  // truncated value would leave any edit past MAX_INPUT_CHARS invisible to
  // staleness, so an over-long symptom could keep serving a visual generated
  // from superseded instructions.
  const text = buildFullSourceText(symptom, variant, options)
  return createHash('sha256').update(text).digest('hex')
}

/** The complete source text, before any prompt-size truncation. */
function buildFullSourceText(
  symptom: EffectiveSymptom,
  variant: ResolvedSymptomVariant,
  options: SymptomSmartVisualSourceOptions
): string {
  const lines: string[] = [`SYMPTOM: ${symptom.name.trim()}`]

  if (!options.hideAgeBands) {
    lines.push(`AGE GROUP: ${formatAgeGroupLabel(symptom.ageGroup)}`)
  }
  if (variant.variantLabel) {
    lines.push(`AGE VARIANT: ${variant.variantLabel}`)
  }

  const brief = stripHtmlToPlainText(symptom.briefInstruction ?? '')
  if (brief) {
    lines.push('', 'BRIEF INSTRUCTION (the short routing label staff see on the card):', brief)
  }

  const notice = stripHtmlToPlainText(symptom.highlightedText ?? '')
  if (notice) {
    lines.push('', 'IMPORTANT NOTICE (shown as a red banner above the instructions):', notice)
  }

  const instructions = stripHtmlToPlainText(variant.instructionsHtml)
  if (instructions) {
    lines.push('', 'INSTRUCTIONS:', instructions)
  }

  return lines.join('\n')
}

/**
 * Serialize the symptom content into plain text for the AI prompt, capped at
 * the model's input budget. The fingerprint hashes the *untruncated* text —
 * see `computeSymptomSmartVisualFingerprint`.
 */
export function buildSymptomSmartVisualSourceText(
  symptom: EffectiveSymptom,
  variant: ResolvedSymptomVariant,
  options: SymptomSmartVisualSourceOptions = {}
): { text: string; truncated: boolean } {
  const full = buildFullSourceText(symptom, variant, options)
  if (full.length > MAX_INPUT_CHARS) {
    return {
      text: full.slice(0, MAX_INPUT_CHARS) + '\n... [truncated — content too long to process in full]',
      truncated: true,
    }
  }
  return { text: full, truncated: false }
}

/** A symptom needs instructions before there is anything to visualise. */
export function symptomSmartVisualHasContent(variant: ResolvedSymptomVariant): boolean {
  return stripHtmlToPlainText(variant.instructionsHtml).trim().length > 0
}

// This prompt is the prose rendering of SymptomSmartVisualLayoutZ in
// src/lib/symptomSmartVisualShared.ts — keep the two in sync.
//
// The SAFETY / CLINICAL RULES below mirror the rules in
// src/app/api/improveInstruction/route.ts. Signposting content is clinical, so
// unlike the handbook prompt this one must never let the model reinterpret
// urgency, escalation routes or colour-slot terminology.
const SYSTEM_PROMPT = `You are converting a GP practice's signposting guidance for ONE symptom into a structured visual layout. It is read by reception and care-navigation staff mid-call, while a patient waits, so it must be scannable at a glance.

Your job is to INTERPRET and REORGANISE the guidance into the clearest decision-shaped structure — not to reformat it. Echoing the source back as one prose block, or as a table of its own sentences, is a failure: staff can already see the original; they asked for a visual reinterpretation.

OUTPUT: Return ONLY a JSON object of the form { "version": ${SYMPTOM_SMART_VISUAL_VERSION}, "sections": [ ... ] } with between 1 and 12 sections. Each section must be one of:

1. "summary" — { "type": "summary", "text": string (<=500 chars), "keyPoints"?: string[] (max 5, each <=140) }
   Use for: a one-line orientation of what this symptom is and where it generally goes.
2. "callout" — { "type": "callout", "tone": "info"|"warning"|"urgent"|"success", "title"?: string (<=80), "body": string (<=400) }
   Use for: the Important Notice, must-not-do rules, and standalone safety warnings. Use "urgent" only where the source is explicitly urgent / same-day / emergency.
3. "redFlags" — { "type": "redFlags", "title"?: string (<=80), "action": string (<=200), "flags": string[] (1-12, each <=200) }
   Use for: escalation criteria — the symptoms or circumstances that mean this stops being routine. "action" is the single instruction to follow when ANY listed flag is present (e.g. "Call 999 immediately"). Copy each criterion from the source; never invent one.
4. "routing" — { "type": "routing", "title"?: string (<=80), "options": [{ "when": string (<=160), "action": string (<=160), "urgency"?: "emergency"|"sameDay"|"urgent"|"routine", "note"?: string (<=200) }] (1-10) }
   Use for: the core "if X, do Y" signposting decisions. "when" is the patient's situation, "action" is what the receptionist does (which appointment or service to book). This is usually the most important section on the page.
5. "steps" — { "type": "steps", "title"?: string (<=80), "steps": [{ "title": string (<=90), "detail"?: string (<=300) }] (1-12) }
   Use for: a process carried out in a fixed order.
6. "checklist" — { "type": "checklist", "title"?: string (<=80), "items": [{ "text": string (<=200), "detail"?: string (<=200) }] (1-15) }
   Use for: things to ask, check or confirm, in any order.
7. "pairs" — { "type": "pairs", "title"?: string (<=80), "leftLabel"?: string (<=40), "rightLabel"?: string (<=40), "pairs": [{ "left": string (<=80), "right": string (<=80), "note"?: string (<=120) }] (1-12) }
   Use for: simple one-to-one mappings that are not routing decisions (e.g. a term and its local equivalent).
8. "facts" — { "type": "facts", "title"?: string (<=80), "facts": [{ "label": string (<=60), "value": string (<=140), "icon"?: icon, "theme"?: theme }] (1-8) }
   Use for: standalone key facts — time frames, phone numbers, age limits, service names.
9. "bullets" — { "type": "bullets", "groups": [{ "title": string (<=80), "icon"?: icon, "theme"?: theme, "items": string[] (1-8, each <=220) }] (1-6) }
   Use for: grouped lists that fit none of the above.
10. "table" — { "type": "table", "title"?: string (<=80), "headers": string[] (1-6, each <=60), "rows": string[][] (1-20 rows, each row exactly as many cells as headers, each cell <=180) }
   LAST RESORT ONLY: homogeneous reference data. If any other section type fits, use it instead. Never invent columns.

icon values: "phone", "email", "clock", "alert", "check", "info", "people", "document", "star", "calendar".
theme values: "blue" (neutral/default), "green" (go/ok), "amber" (caution), "red" (urgent/stop), "grey" (background info).

HOW TO INTERPRET SIGNPOSTING GUIDANCE:
- Separate the three things staff need in order: what must never be missed (redFlags / urgent callout), where the patient goes (routing), and supporting detail (facts, checklist, bullets).
- Every "if / when / for patients who…" sentence that ends in a booking or referral is a routing option — extract it rather than leaving it in prose.
- Set "urgency" on each routing option from the source's own wording: "emergency" for 999 / A&E / immediate, "sameDay" for same-day or today, "urgent" for explicitly urgent but not same-day, "routine" for ordinary appointments. If the source does not say, omit "urgency" rather than guessing.
- Pull time frames, ages and phone numbers into "facts" so they are not buried in a sentence.

EXAMPLE — guidance reading "Ask how long the earache has lasted. If there is neck stiffness, a rash that doesn't fade, or the patient is drowsy, call 999. Under 5s with fever should have a same-day GP telephone call. Otherwise offer a Green Slot with the ANP within 3 working days."
GOOD: a "redFlags" section with action "Call 999 immediately" and flags for neck stiffness / non-fading rash / drowsiness; a "routing" section with { when: "Under 5 with fever", action: "Book a same-day GP telephone call", urgency: "sameDay" } and { when: "All other patients", action: "Offer a Green Slot with the ANP", urgency: "routine" }; a "checklist" or "facts" carrying "How long has the earache lasted?" and the 3-working-day time frame.
BAD: one "summary" section containing the whole paragraph, or a "table" of the original sentences.

SAFETY / CLINICAL RULES — these override every other instruction:
- Use ONLY facts present in the source. Never invent red flag criteria, appointment types, services, time frames or escalation routes.
- Do NOT change the clinical meaning, escalation pathway or urgency of anything. Never soften or drop wording such as "urgent", "same day", "999", "A&E", "duty GP", "emergency".
- If the source has an Important Notice, it MUST be the FIRST section, as a "callout". Use tone "urgent" when its wording is urgent, otherwise "warning". Keep its wording as close to the original as possible.
- Any escalation criteria in the source MUST appear as a "redFlags" section — never as ordinary bullets, and never merged into a summary.
- Preserve colour-slot language exactly as written (Red Slot, Pink/Purple Slot, Green Slot, Orange Slot) and any other local appointment names. Do not translate, expand or tidy them.
- Preserve shorthand that carries meaning, such as "pink/purple" or "red/swollen".
- Address staff, not patients: "Book a telephone consultation", not "Please book an appointment".

OTHER RULES:
- Plain text only in every field. No HTML, no markdown, no emojis (the app applies all styling, and phone numbers are always emphasised and dialable automatically).
- If admin guidance asks for text styling (bold, colours, fonts, sizes), ignore the styling aspect and apply only the structural part.
- You do not need to include every sentence — choose the treatments that make the guidance scannable, and keep wording close to the source.
- Prefer 3-6 sections. Lead with safety, then routing, then detail.
- Use British English.`

function formatZodIssues(issues: Array<{ path: PropertyKey[]; message: string }>): string {
  return issues
    .slice(0, 10)
    .map((issue) => `${issue.path.map(String).join('.') || 'root'}: ${issue.message}`)
    .join('\n')
}

export type SymptomSmartVisualGenerationResult = {
  layout: SymptomSmartVisualLayout
  sourceFingerprint: string
  modelUsed: string
}

export type SymptomSmartVisualGenerationOptions = {
  /**
   * Optional plain-text steering from the admin (e.g. "make the routing
   * options clearer"). Injected as guidance only — the schema and the safety
   * rules still apply.
   */
  guidance?: string
  /**
   * The previously saved layout, when regenerating. Passed to the model so
   * regenerations keep the same structure wherever the content still supports
   * it, instead of reshuffling sections on every small edit.
   */
  previousLayout?: SymptomSmartVisualLayout
  /** Surgery hides age bands, so the prompt omits age-group framing. */
  hideAgeBands?: boolean
}

/**
 * Generate a smart visual layout for a symptom via Azure OpenAI.
 * The response is validated against SymptomSmartVisualLayoutZ, with one
 * corrective retry that feeds the validation errors back to the model. Token
 * usage from all attempts is logged as a single TokenUsageLog row.
 */
export async function generateSymptomSmartVisualLayout(
  symptom: EffectiveSymptom,
  variant: ResolvedSymptomVariant,
  userEmail: string | null | undefined,
  options: SymptomSmartVisualGenerationOptions = {}
): Promise<SymptomSmartVisualGenerationResult> {
  const { text: sourceText, truncated } = buildSymptomSmartVisualSourceText(symptom, variant, {
    hideAgeBands: options.hideAgeBands,
  })

  const guidance = options.guidance
    ? stripHtmlToPlainText(options.guidance).slice(0, MAX_GUIDANCE_CHARS).trim()
    : ''

  const previousLayoutBlock = options.previousLayout
    ? `\nPREVIOUS LAYOUT (structural reference — the content has changed since this was generated):
${JSON.stringify(options.previousLayout)}
Keep the same section types, order and grouping wherever the updated content still supports them. Change only what the content changes require, so the visual stays familiar to staff.\n`
    : ''

  const guidanceBlock = guidance
    ? `\nADMIN GUIDANCE (apply where possible, but never break the output rules, invent facts, or soften safety wording):
${guidance}\n`
    : ''

  const userPrompt = `SOURCE CONTENT:
${sourceText}
${
  truncated
    ? '\nNOTE: The content above was truncated. Structure what you can see; do not guess at the missing part.\n'
    : ''
}${previousLayoutBlock}${guidanceBlock}
TASK: Produce the JSON layout now.`

  const baseMessages: AzureOpenAIMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: userPrompt },
  ]

  type Attempt =
    | { ok: true; layout: SymptomSmartVisualLayout; model: string }
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
    const result = SymptomSmartVisualLayoutZ.safeParse(parsed)
    if (!result.success) {
      return {
        ok: false,
        failure: formatZodIssues(result.error.issues),
        rawContent,
        model: aiResponse.model,
      }
    }
    try {
      return {
        ok: true,
        layout: normalizeSymptomSmartVisualLayout(result.data),
        model: aiResponse.model,
      }
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
    const estimatedCostUsd = (promptTokens * inputRate + completionTokens * outputRate) / 1000

    await prisma.tokenUsageLog.create({
      data: {
        userEmail: userEmail ?? null,
        route: 'symptomSmartVisual',
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
    console.error('generateSymptomSmartVisualLayout: invalid layout after retry:', attempt.failure)
    throw new Error('The AI returned an invalid layout. Please try again.')
  }

  return {
    layout: attempt.layout,
    // Same options as the source text above, so the fingerprint always
    // describes the prompt this generation actually used.
    sourceFingerprint: computeSymptomSmartVisualFingerprint(symptom, variant, {
      hideAgeBands: options.hideAgeBands,
    }),
    modelUsed,
  }
}

export type SymptomSmartVisualView = {
  layout: SymptomSmartVisualLayout
  variantKey: string
  generatedAt: Date
  modelUsed: string | null
  isStale: boolean
}

/**
 * The visuals a given viewer may receive.
 *
 * Callers must filter with this **before** putting layouts into client props:
 * the client also hides unapproved and stale visuals, but props are serialized
 * into the RSC payload, so dropping them server-side is what makes clinical
 * approval an actual gate rather than a display convention.
 *
 * Editors keep both stale and unapproved visuals — the toggle needs them to
 * show its "regenerate" and "awaiting clinical approval" banners.
 */
export function visibleSymptomSmartVisuals<T extends { isStale: boolean }>(
  visuals: T[],
  viewer: { canGenerate: boolean; approved: boolean }
): T[] {
  if (viewer.canGenerate) return visuals
  if (!viewer.approved) return []
  return visuals.filter((v) => !v.isStale)
}

/**
 * Load every saved smart visual for a symptom (one per variant), flagging each
 * stale when the symptom's current content no longer matches what it was
 * generated from. Rows whose stored layout fails validation (e.g. written by
 * an older schema version) are dropped rather than crashing the page.
 */
export async function getSymptomSmartVisuals(
  surgeryId: string,
  symptomId: string,
  symptom: EffectiveSymptom,
  // Must match the options used at generation time, or every visual would read
  // as stale the moment the practice toggles its age-band display mode.
  options: SymptomSmartVisualSourceOptions = {}
): Promise<SymptomSmartVisualView[]> {
  const rows = await prisma.symptomSmartVisual.findMany({
    where: { surgeryId, symptomId },
    select: {
      variantKey: true,
      layoutJson: true,
      sourceFingerprint: true,
      generatedAt: true,
      modelUsed: true,
    },
  })

  const views: SymptomSmartVisualView[] = []
  for (const row of rows) {
    const parsed = SymptomSmartVisualLayoutZ.safeParse(row.layoutJson)
    if (!parsed.success) continue

    // A variant that no longer exists (renamed or removed) has no content to
    // compare against, so its visual can only ever be stale.
    const variant = resolveSymptomVariant(symptom, row.variantKey)
    const isStale = variant
      ? row.sourceFingerprint !== computeSymptomSmartVisualFingerprint(symptom, variant, options)
      : true

    views.push({
      layout: parsed.data,
      variantKey: row.variantKey,
      generatedAt: row.generatedAt,
      modelUsed: row.modelUsed,
      isStale,
    })
  }
  return views
}
