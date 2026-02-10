import 'server-only'

import { promises as fs } from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { EditorialLearningCardZ, type EditorialRole } from '@/lib/schemas/editorial'
import { validateAdminCards, type AdminValidationIssue } from '@/lib/editorial/adminValidator'
import { getRoleProfile } from '@/lib/editorial/roleProfiles'
import {
  ADMIN_TOOLKIT_SOURCE_BASE_URL,
  ADMIN_TOOLKIT_SOURCE_PUBLISHER,
  ADMIN_TOOLKIT_SOURCE_TITLE,
} from '@/lib/editorial/toolkitSources'
import {
  parseAndValidateGeneration,
  type GenerationValidationIssue,
} from '@/lib/editorial/generationParsing'
import { promptTraceStore } from '@/lib/editorial/promptTraceStore'
import { z } from 'zod'

const DEFAULT_TEMPERATURE = 0.2

const OUTPUT_RULES = `
OUTPUT RULES:
- Output MUST be valid JSON only. No prose, no markdown, no code fences.
- Follow the JSON schema exactly.
- Use British English spelling.
`

const SHARED_CONTENT_RULES = `
CONTENT RULES:
- Use triage slot language where relevant: Red / Orange / Pink-Purple / Green.
- If high-risk content is present, mark riskLevel HIGH.
- Every card must include at least one interaction with an explanation.
- interactions MUST be an array. quiz.questions MUST be an array.
- correctIndex MUST be a number.
`

const GENERAL_SOURCE_RULES = `
SOURCES:
- Provide UK sources where possible (NHS, NICE, UKHSA, MHRA, GMC, RCGP, gov.uk).
- If you cannot provide a reliable UK source, set needsSourcing = true.
`

const ADMIN_CONTENT_RULES = `
ADMIN SCOPE:
- You are generating training cards for NON-CLINICAL reception/admin staff using our signposting toolkit.
- Primary authority is the provided TOOLKIT CONTEXT. Do not import GP-level guidance.
- Use toolkit slot language and recommended actions verbatim where possible.
- Avoid GP-only content: no clinical risk tools, no diagnostic frameworks, no management plans, no prescribing or treatment advice.
- DO NOT DIAGNOSE. DO NOT use the words "diagnose", "diagnosis", "diagnosed", or "diagnosing".
  Instead, use non-clinical phrasing: "this could be serious", "needs urgent medical assessment", "should be assessed by a clinician".
- If the toolkit lacks detail, you may reference NHS.uk or NICE for safety-netting wording only.
- Every card must include:
  1) A scenario in receptionist language
  2) The exact slot choice (Red / Orange / Pink-Purple / Green)
  3) A short script (1-3 lines): what to ask/say
  4) What to do next (handover/escalate)
  5) What NOT to do (1 line)
  6) Safety netting / escalation thresholds
- If the prompt is about mental health crisis or suicidal ideation:
  - Include immediate danger triggers and 999 guidance
  - Include boundaries: do not counsel, do not assess clinically, escalate

SLOT LANGUAGE (REQUIRED for ADMIN cards):
- slotLanguage.relevant MUST be true for every ADMIN card.
- slotLanguage.guidance MUST have at least one entry with slot (Red/Orange/Pink-Purple/Green) and rule.
- Extract the slot choice and action from the scenario (e.g. "Pink-Purple: Book telephone appointment for routine vertigo" or "Red: Escalate immediately for stroke symptoms").
- Even when the scenario involves "task GP" or "Epley manoeuvre", include slot guidance from the toolkit (e.g. Pink-Purple for routine, Red for urgent).
`

const ADMIN_SOURCE_RULES = `
ADMIN SOURCES:
- sources[0] MUST be "Signposting Toolkit ({surgery name})" or "Signposting Toolkit (internal)" using the TOOLKIT SOURCE details provided.
- The URL may be null if the source is from the practice-specific toolkit database.
- If there is no real URL, set url to null. Do NOT output an empty string.
- Only add NHS/NICE for safety-netting wording if needed.
- Do not cite GP college guidance for admin cards.
`

type ToolkitPack = {
  id: string
  filePath: string
  keywords: string[]
  sourceRoute: string
}

export type GenerationAttemptRecord = {
  requestId: string
  attemptIndex: number
  modelName?: string
  rawModelOutput: string
  rawModelJson?: unknown
  validationErrors?: GenerationValidationIssue[]
  repaired?: boolean
  status: 'SUCCESS' | 'FAILED'
}

export type EditorialDebugInfo = {
  stage: string
  requestId: string
  surgeryId?: string
  targetRole?: string
  promptText?: string
  traceId?: string
  toolkitInjected: boolean
  toolkitSource?: { title: string; url: string | null; publisher?: string } | null
  matchedSymptoms: string[]
  toolkitContextLength: number
  fallbackUsed?: boolean
  fallbackReason?: string | null
  totalSymptomsSearched?: number
  toolkitContextSnippet?: string | null
  promptSystem?: string
  promptUser?: string
  modelRawText?: string
  modelRawJson?: unknown
  modelNormalisedJson?: unknown
  schemaErrors?: Array<{ path: string; message: string }>
  safetyErrors?: Array<{ code: string; message: string; cardTitle?: string }>
  error?: { name?: string; message?: string; stack?: string }
}

export type GenerationMeta = {
  toolkitInjected: boolean
  matchedSymptoms: string[]
  toolkitContextLength: number
  fallbackUsed: boolean
  fallbackReason: string | null
  totalSymptomsSearched: number
  validationOverridden?: boolean
  validationIssues?: Array<{ code: string; message: string; cardTitle?: string }>
}

const ADMIN_TOOLKIT_PACKS: ToolkitPack[] = [
  {
    id: 'admin-mental-health',
    filePath: 'content/toolkit/admin-mental-health.md',
    keywords: ['mental health', 'suicide', 'suicidal', 'self-harm', 'self harm', 'crisis', 'overdose'],
    sourceRoute: 'mental-health-crisis',
  },
]

const DEFAULT_ADMIN_TOOLKIT_CONTEXT = `
Use the Signposting Toolkit slot language and admin-safe escalation steps.
Focus on recognition of red flags, what to say, what to do, boundaries, and safety netting.
Do not include clinical assessment tools or clinical advice.
`

const GENERATION_SCHEMA = `
{
  "cards": [
    {
      "targetRole": "ADMIN|GP|NURSE",
      "title": "string",
      "estimatedTimeMinutes": 3-10,
      "tags": ["string"],
      "riskLevel": "LOW|MED|HIGH",
      "needsSourcing": true|false,
      "reviewByDate": "YYYY-MM-DD (must be a future date, typically 6 months from today)",
      "sources": [{ "title": "string", "url": "https://", "publisher": "string?", "accessedDate": "string?" }],
      "contentBlocks": [
        { "type": "text|callout", "text": "string" },
        { "type": "steps|do-dont", "items": ["string"] }
      ],
      "interactions": [
        {
          "type": "mcq|true_false|choose_action",
          "question": "string",
          "options": ["string"],
          "correctIndex": 0,
          "explanation": "string"
        }
      ],
      "slotLanguage": {
        "relevant": true|false,
        "guidance": [{ "slot": "Red|Orange|Pink-Purple|Green", "rule": "string" }]
      },
      "safetyNetting": ["string"]
    }
  ],
  "quiz": {
    "title": "string",
    "questions": [
      {
        "type": "mcq|true_false",
        "question": "string",
        "options": ["string"],
        "correctIndex": 0,
        "explanation": "string",
        "linkedCardIds": ["card-id-optional"]
      }
    ]
  }
}
`

const VARIATION_SCHEMA = `
{
  "cards": [
    {
      "targetRole": "ADMIN|GP|NURSE",
      "title": "string",
      "estimatedTimeMinutes": 3-10,
      "tags": ["string"],
      "riskLevel": "LOW|MED|HIGH",
      "needsSourcing": true|false,
      "reviewByDate": "YYYY-MM-DD (must be a future date, typically 6 months from today)",
      "sources": [{ "title": "string", "url": "https://", "publisher": "string?", "accessedDate": "string?" }],
      "contentBlocks": [
        { "type": "text|callout", "text": "string" },
        { "type": "steps|do-dont", "items": ["string"] }
      ],
      "interactions": [
        {
          "type": "mcq|true_false|choose_action",
          "question": "string",
          "options": ["string"],
          "correctIndex": 0,
          "explanation": "string"
        }
      ],
      "slotLanguage": {
        "relevant": true|false,
        "guidance": [{ "slot": "Red|Orange|Pink-Purple|Green", "rule": "string" }]
      },
      "safetyNetting": ["string"]
    }
  ]
}
`

function formatRoleProfile(role: EditorialRole) {
  const profile = getRoleProfile(role)
  const allowed = profile.allowedContent.map((item) => `- ${item}`).join('\n')
  const disallowed = profile.disallowedContent.map((item) => `- ${item}`).join('\n')
  const sourcing = profile.sourcingGuidance.map((item) => `- ${item}`).join('\n')
  return `
ROLE PROFILE (${profile.role}):
- Audience: ${profile.audience}
- Tone: ${profile.tone}
- Allowed content:
${allowed}
- Disallowed content:
${disallowed}
- Sourcing guidance:
${sourcing}
`
}

function buildSystemPrompt(params: { role: EditorialRole; strictAdmin?: boolean }) {
  const roleProfile = formatRoleProfile(params.role)
  if (params.role === 'ADMIN') {
    return `
${ADMIN_CONTENT_RULES}
${OUTPUT_RULES}
${SHARED_CONTENT_RULES}
${ADMIN_SOURCE_RULES}
${roleProfile}
${params.strictAdmin ? 'STRICT ADMIN MODE: Remove clinician-only content and follow toolkit wording.' : ''}
`.trim()
  }

  return `
You are an editorial assistant for Daily Dose learning cards in UK general practice.
${OUTPUT_RULES}
${SHARED_CONTENT_RULES}
${GENERAL_SOURCE_RULES}
${roleProfile}
`.trim()
}

function formatAdminValidationIssues(issues: AdminValidationIssue[]) {
  const lines = issues.map((issue) => `- ${issue.message}${issue.cardTitle ? ` (Card: ${issue.cardTitle})` : ''}`)
  const hasSlotGuidance = issues.some((i) => i.code === 'MISSING_SLOT_GUIDANCE')
  if (hasSlotGuidance) {
    lines.push(
      '- Ensure slotLanguage.relevant is true and slotLanguage.guidance has at least one { slot, rule } entry (e.g. { "slot": "Pink-Purple", "rule": "Book telephone appointment for routine vertigo" }).',
    )
  }
  return lines.join('\n')
}

function formatToolkitSection(toolkitContext?: string, toolkitSource?: { title: string; url: string | null; publisher: string }) {
  if (!toolkitContext || !toolkitSource) return ''
  
  // Check if this is the new format with INTERNAL PRACTICE-APPROVED GUIDANCE header
  const isNewFormat = toolkitContext.includes('INTERNAL PRACTICE-APPROVED GUIDANCE')
  
  if (isNewFormat) {
    // New format already includes usage rules, just add source info
    return `${toolkitContext.trim()}

TOOLKIT SOURCE (use as sources[0]):
Title: ${toolkitSource.title}
URL: ${toolkitSource.url}
Publisher: ${toolkitSource.publisher}

`
  }
  
  // Legacy format - add emphasis
  return `INTERNAL PRACTICE-APPROVED GUIDANCE (MUST USE VERBATIM WHERE APPLICABLE)

${toolkitContext.trim()}

TOOLKIT SOURCE (use as sources[0]):
Title: ${toolkitSource.title}
URL: ${toolkitSource.url}
Publisher: ${toolkitSource.publisher}

CRITICAL: Use the wording above verbatim for slot language, escalation steps, and safety netting. Do not paraphrase or invent beyond what is provided.

`
}

function buildUserPrompt(params: {
  promptText: string
  targetRole: EditorialRole
  count: number
  interactiveFirst: boolean
  toolkitContext?: string
  toolkitSource?: { title: string; url: string | null; publisher: string }
  validationIssues?: AdminValidationIssue[]
}) {
  const toolkitSection =
    params.targetRole === 'ADMIN' ? formatToolkitSection(params.toolkitContext, params.toolkitSource) : ''

  const validationSection =
    params.validationIssues && params.validationIssues.length > 0
      ? `VALIDATION FAILURES TO FIX:
${formatAdminValidationIssues(params.validationIssues)}

`
      : ''

  return `${toolkitSection}${validationSection}Create ${params.count} learning cards for ${params.targetRole} staff.
Prompt: ${params.promptText}
Interactive-first: ${params.interactiveFirst ? 'yes' : 'no'}

IMPORTANT: reviewByDate must be a future date (YYYY-MM-DD format). Use a date approximately 6 months from today. Never use past dates.

Return JSON using this schema:
${GENERATION_SCHEMA}
Return ONLY valid JSON. No markdown, no commentary.
`
}

const GENERATION_SCHEMA_SUMMARY = `
Required top-level keys: cards, quiz.
Each card must include: targetRole, title, estimatedTimeMinutes, tags, riskLevel, needsSourcing, reviewByDate, sources, contentBlocks, interactions, slotLanguage, safetyNetting.
Quiz must include: title, questions (array of { type, question, options, correctIndex, explanation }).
`

function buildSchemaCorrectionPrompt(params: {
  issues: GenerationValidationIssue[]
  previousJson: unknown
}) {
  const issueLines = params.issues.map((issue) => `- ${issue.path}: ${issue.message}`).join('\n')
  return `
The previous JSON did not match the schema. Fix the errors below.
${GENERATION_SCHEMA_SUMMARY.trim()}

Validation issues:
${issueLines}

Previous JSON:
${JSON.stringify(params.previousJson, null, 2)}

Return corrected JSON only. Do not add or remove top-level keys.
Return ONLY valid JSON. No markdown, no commentary.
`
}

function toRawSnippet(raw: string) {
  return raw.slice(0, 2000)
}

function findToolkitPack(text: string) {
  const lower = text.toLowerCase()
  return ADMIN_TOOLKIT_PACKS.find((pack) => pack.keywords.some((keyword) => lower.includes(keyword)))
}

async function readToolkitFile(filePath: string) {
  const fullPath = path.join(process.cwd(), filePath)
  try {
    return await fs.readFile(fullPath, 'utf8')
  } catch (error) {
    console.warn('Unable to read toolkit context', error)
    return ''
  }
}

async function resolveAdminToolkitContext(params: { promptText: string; tags?: string[] }): Promise<{
  context: string
  source: { title: string; url: string | null; publisher: string }
}> {
  const combined = [params.promptText, ...(params.tags || [])].join(' ')
  const pack = findToolkitPack(combined)
  const sourceRoute = pack?.sourceRoute ?? 'admin-core'
  const source: { title: string; url: string | null; publisher: string } = {
    title: ADMIN_TOOLKIT_SOURCE_TITLE,
    url: `${ADMIN_TOOLKIT_SOURCE_BASE_URL}/${sourceRoute}`,
    publisher: ADMIN_TOOLKIT_SOURCE_PUBLISHER,
  }

  if (!pack) {
    return { context: DEFAULT_ADMIN_TOOLKIT_CONTEXT.trim(), source }
  }

  const context = await readToolkitFile(pack.filePath)
  return { context: context.trim() || DEFAULT_ADMIN_TOOLKIT_CONTEXT.trim(), source }
}

/** Stop-words excluded from token matching to avoid false positives. */
const MATCHING_STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'is', 'are', 'was', 'were', 'be',
  'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will',
  'would', 'could', 'should', 'may', 'might', 'shall', 'can', 'to', 'of',
  'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as', 'into', 'about',
  'it', 'its', 'this', 'that', 'these', 'those', 'i', 'we', 'you', 'they',
  'he', 'she', 'my', 'our', 'your', 'their', 'me', 'us', 'him', 'her',
  'not', 'no', 'nor', 'so', 'if', 'then', 'than', 'too', 'very', 'just',
  'also', 'how', 'what', 'when', 'where', 'who', 'which', 'why',
  'all', 'each', 'every', 'both', 'few', 'more', 'most', 'other', 'some',
  'such', 'only', 'same', 'up', 'out', 'off', 'over', 'under',
  'create', 'make', 'cards', 'card', 'learning', 'training', 'team',
  'staff', 'admin', 'reception', 'about', 'please', 'generate', 'draft',
])

/**
 * Tokenise text into meaningful lowercase words, stripping stop-words and
 * very short tokens (<3 chars) unless they appear useful (e.g. "uti").
 */
function tokenise(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 2 && !MATCHING_STOP_WORDS.has(t))
}

/**
 * Score a symptom against prompt tokens. Higher = better match.
 * Awards points for:
 *  - Exact token match in symptom name (3 pts)
 *  - Partial token match in symptom name, e.g. "throat" in "sore throat" (1 pt)
 *  - Exact token match in briefInstruction (1 pt)
 */
function scoreSymptom(
  promptTokens: string[],
  symptomName: string,
  briefInstruction: string,
): number {
  const nameTokens = tokenise(symptomName)
  const nameLower = symptomName.toLowerCase()
  const briefLower = briefInstruction.toLowerCase()
  let score = 0

  for (const pt of promptTokens) {
    // Exact token match in symptom name tokens (strongest signal)
    if (nameTokens.includes(pt)) {
      score += 3
      continue
    }
    // Partial match: prompt token appears inside the full symptom name string
    if (nameLower.includes(pt)) {
      score += 1
      continue
    }
    // Token appears in brief instruction
    if (briefLower.includes(pt)) {
      score += 1
    }
  }

  return score
}

export type ToolkitAdviceResult = {
  context: string
  source: { title: string; url: string | null; publisher: string }
  matchedSymptomNames: string[]
  fallbackUsed: boolean
  fallbackReason?: string
  totalSymptomsSearched: number
  toolkitContextSnippet: string
}

async function resolveSignpostingToolkitAdvice(params: {
  surgeryId: string
  promptText: string
  targetRole: EditorialRole
}): Promise<ToolkitAdviceResult | null> {
  // Only for ADMIN role
  if (params.targetRole !== 'ADMIN') {
    return null
  }

  try {
    // Import here to avoid circular dependencies
    const { getEffectiveSymptoms } = await import('@/server/effectiveSymptoms')
    const { prisma } = await import('@/lib/prisma')

    // Get surgery name for source attribution
    const surgery = await prisma.surgery.findUnique({
      where: { id: params.surgeryId },
      select: { name: true },
    })

    // Tokenise the prompt into meaningful search tokens
    const promptTokens = tokenise(params.promptText)

    if (promptTokens.length === 0) {
      // If prompt has no meaningful tokens, fall back to static context
      const existing = await resolveAdminToolkitContext({
        promptText: params.promptText,
        tags: params.tags,
      })
      console.log('[Editorial AI] No meaningful prompt tokens, using static toolkit fallback')
      return {
        ...existing,
        source: {
          ...existing.source,
          url: `/s/${params.surgeryId}`,
        },
        matchedSymptomNames: [],
        fallbackUsed: true,
        fallbackReason: 'No meaningful tokens extracted from prompt',
        totalSymptomsSearched: 0,
        toolkitContextSnippet: existing.context.slice(0, 500),
      }
    }

    // Load all effective symptoms for this surgery and score them
    const allSymptoms = await getEffectiveSymptoms(params.surgeryId, false)

    const scored = allSymptoms
      .map((symptom) => ({
        symptom,
        score: scoreSymptom(promptTokens, symptom.name || '', symptom.briefInstruction || ''),
      }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5) // Top 5 matches

    const matchedSymptoms = scored.map(({ symptom }) => symptom)

    // If no matches, fall back to existing static toolkit context
    if (matchedSymptoms.length === 0) {
      const existing = await resolveAdminToolkitContext({
        promptText: params.promptText,
        tags: params.tags,
      })
      console.log(`[Editorial AI] No symptom matches (searched ${allSymptoms.length} symptoms, tokens: [${promptTokens.join(', ')}]), using static toolkit fallback`)
      return {
        ...existing,
        source: {
          ...existing.source,
          url: `/s/${params.surgeryId}`,
        },
        matchedSymptomNames: [],
        fallbackUsed: true,
        fallbackReason: `No symptoms matched prompt tokens [${promptTokens.join(', ')}] across ${allSymptoms.length} symptoms`,
        totalSymptomsSearched: allSymptoms.length,
        toolkitContextSnippet: existing.context.slice(0, 500),
      }
    }

    // Build context string from effective symptoms
    const contextItems = matchedSymptoms
      .map((symptom) => {
        const parts: string[] = []
        if (symptom.name) {
          parts.push(`## ${symptom.name}`)
        }
        if (symptom.ageGroup) {
          parts.push(`**Age group:** ${symptom.ageGroup}`)
        }
        if (symptom.briefInstruction) {
          parts.push(`**Brief instruction:** ${symptom.briefInstruction}`)
        }
        if (symptom.instructionsHtml) {
          // Strip HTML tags for plain text version
          let plainText = symptom.instructionsHtml.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
          // Truncate to ~1,500 chars per symptom to prevent prompt bloat
          if (plainText.length > 1500) {
            plainText = plainText.slice(0, 1500) + '...'
          }
          parts.push(`**Full instructions:**\n${plainText}`)
        } else if (symptom.instructions) {
          // Truncate legacy markdown too
          let truncated = symptom.instructions.trim()
          if (truncated.length > 1500) {
            truncated = truncated.slice(0, 1500) + '...'
          }
          parts.push(`**Full instructions:**\n${truncated}`)
        }
        if (symptom.highlightedText) {
          parts.push(`**Key phrases:** ${symptom.highlightedText}`)
        }
        return parts.join('\n\n')
      })

    const context = `INTERNAL PRACTICE-APPROVED GUIDANCE (MUST USE VERBATIM WHERE APPLICABLE)

This guidance is from ${surgery?.name || 'this practice'}'s approved Signposting Toolkit database. Use this wording exactly as written for workflow phrasing and slot language.

${contextItems.join('\n\n---\n\n')}

USAGE RULES:
- Use this wording verbatim for slot choices (Red/Orange/Pink-Purple/Green) and escalation steps
- Do not invent new slot colours or escalation routes
- Preserve exact phrasing for safety netting and red flags
- If a symptom is mentioned, use the exact instruction text above
- If guidance contradicts generic knowledge, prefer the internal guidance`

    const source = {
      title: `Signposting Toolkit (${surgery?.name || 'internal'})`,
      url: `/s/${params.surgeryId}`,
      publisher: 'Signposting Toolkit',
    }

    const matchedNames = matchedSymptoms.map((s) => s.name || 'Unknown').filter(Boolean)
    console.log(`[Editorial AI] Injected toolkit context: ${matchedSymptoms.length} symptom(s) [${matchedNames.join(', ')}], ${context.length} chars, tokens: [${promptTokens.join(', ')}]`)

    return {
      context,
      source,
      matchedSymptomNames: matchedNames,
      fallbackUsed: false,
      totalSymptomsSearched: allSymptoms.length,
      toolkitContextSnippet: context.slice(0, 500),
    }
  } catch (error) {
    // On error, fall back to static toolkit context
    console.warn('[Editorial AI] Error resolving signposting toolkit advice, falling back to static:', error)
    const existing = await resolveAdminToolkitContext({
      promptText: params.promptText,
      tags: params.tags,
    })
    return {
      ...existing,
      source: {
        ...existing.source,
        url: `/s/${params.surgeryId}`,
      },
      matchedSymptomNames: [],
      fallbackUsed: true,
      fallbackReason: `Error during symptom matching: ${error instanceof Error ? error.message : String(error)}`,
      totalSymptomsSearched: 0,
      toolkitContextSnippet: existing.context.slice(0, 500),
    }
  }
}

type GenerationAttemptResult = {
  modelUsed: string
  rawOutput: string
  parseResult: ReturnType<typeof parseAndValidateGeneration>
}

async function runGenerationAttempt(params: {
  systemPrompt: string
  userPrompt: string
  requestId: string
  attemptIndex: number
  traceId?: string
  onAttempt?: (attempt: GenerationAttemptRecord) => Promise<void> | void
}): Promise<GenerationAttemptResult> {
  const result = await callAzureOpenAi({
    systemPrompt: params.systemPrompt,
    userPrompt: params.userPrompt,
  })

  const parseResult = parseAndValidateGeneration(result.content)
  
  // Update trace with model output (dev/preview only)
  if (process.env.NODE_ENV !== 'production' && params.traceId) {
    promptTraceStore.update(params.traceId, {
      modelRawText: result.content,
      modelRawJson: parseResult.rawJson,
      modelNormalisedJson: parseResult.success ? parseResult.data : undefined,
      validationErrors: parseResult.success ? undefined : parseResult.issues,
    })
  }

  await params.onAttempt?.({
    requestId: params.requestId,
    attemptIndex: params.attemptIndex,
    modelName: result.modelUsed,
    rawModelOutput: result.content,
    rawModelJson: parseResult.rawJson,
    validationErrors: parseResult.success ? undefined : parseResult.issues,
    repaired: parseResult.repaired,
    status: parseResult.success ? 'SUCCESS' : 'FAILED',
  })

  return {
    modelUsed: result.modelUsed,
    rawOutput: result.content,
    parseResult,
  }
}

async function resolveGenerationResult(params: {
  attempt: GenerationAttemptResult
  requestId: string
  attemptIndex: () => number
  systemPrompt: string
  traceId?: string
  onAttempt?: (attempt: GenerationAttemptRecord) => Promise<void> | void
}) {
  if (params.attempt.parseResult.success) {
    return {
      data: params.attempt.parseResult.data,
      modelUsed: params.attempt.modelUsed,
    }
  }

  const issues = params.attempt.parseResult.issues
  const rawJson = params.attempt.parseResult.rawJson
  if (!rawJson) {
    throw new EditorialAiError('SCHEMA_MISMATCH', 'Generated output did not match schema', {
      requestId: params.requestId,
      traceId: params.traceId,
      issues,
      rawSnippet: toRawSnippet(params.attempt.rawOutput),
    })
  }

  const correctionPrompt = buildSchemaCorrectionPrompt({ issues, previousJson: rawJson })
  const retryAttempt = await runGenerationAttempt({
    systemPrompt: params.systemPrompt,
    userPrompt: correctionPrompt,
    requestId: params.requestId,
    attemptIndex: params.attemptIndex(),
    traceId: params.traceId,
    onAttempt: params.onAttempt,
  })

  if (!retryAttempt.parseResult.success) {
    throw new EditorialAiError('SCHEMA_MISMATCH', 'Generated output did not match schema after retry', {
      requestId: params.requestId,
      traceId: params.traceId,
      issues: retryAttempt.parseResult.issues,
      rawSnippet: toRawSnippet(retryAttempt.rawOutput),
    })
  }

  return {
    data: retryAttempt.parseResult.data,
    modelUsed: retryAttempt.modelUsed,
  }
}

/**
 * Return the hardcoded default system prompt for a role.
 * Exported so the settings UI can show the default for comparison.
 */
export function buildDefaultSystemPrompt(role: EditorialRole): string {
  return buildSystemPrompt({ role })
}

/**
 * Load the system prompt for a given role.
 * Returns the saved template from the database if one exists,
 * otherwise falls back to the hardcoded default.
 */
export async function getSystemPromptForRole(role: EditorialRole): Promise<string> {
  try {
    const { prisma } = await import('@/lib/prisma')
    const saved = await prisma.dailyDosePromptTemplate.findUnique({
      where: { role },
      select: { template: true },
    })
    if (saved?.template) {
      return saved.template
    }
  } catch (error) {
    // If the table doesn't exist yet or DB is unavailable, fall back silently
    console.warn('getSystemPromptForRole: failed to load saved template, using default', error)
  }
  return buildSystemPrompt({ role })
}

/**
 * Build the fully constructed system and user prompts without calling the AI.
 * Used by the preview endpoint so superusers can inspect/edit prompts before generation.
 */
export async function buildEditorialPrompts(params: {
  surgeryId: string
  promptText: string
  targetRole: EditorialRole
  count: number
  interactiveFirst: boolean
}) {
  const toolkit = await resolveSignpostingToolkitAdvice({
    surgeryId: params.surgeryId,
    promptText: params.promptText,
    targetRole: params.targetRole,
  })

  const systemPrompt = await getSystemPromptForRole(params.targetRole)
  const userPrompt = buildUserPrompt({
    promptText: params.promptText,
    targetRole: params.targetRole,
    count: params.count,
    interactiveFirst: params.interactiveFirst,
    toolkitContext: toolkit?.context,
    toolkitSource: toolkit?.source,
  })

  const matchedSymptomNames: string[] = toolkit?.matchedSymptomNames || []

  return {
    systemPrompt,
    userPrompt,
    toolkitMeta: {
      toolkitInjected: !!toolkit,
      matchedSymptoms: matchedSymptomNames,
      toolkitContextLength: toolkit?.context?.length || 0,
      fallbackUsed: toolkit?.fallbackUsed ?? false,
      fallbackReason: toolkit?.fallbackReason ?? null,
      totalSymptomsSearched: toolkit?.totalSymptomsSearched ?? 0,
      toolkitContextSnippet: toolkit?.toolkitContextSnippet ?? null,
      toolkitSource: toolkit?.source || null,
    },
    // Raw toolkit fields needed by generateEditorialBatch for retry prompts
    _rawToolkitContext: toolkit?.context,
    _rawToolkitSource: toolkit?.source,
  }
}

export async function generateEditorialBatch(params: {
  surgeryId: string
  promptText: string
  targetRole: EditorialRole
  count: number
  interactiveFirst: boolean
  requestId: string
  onAttempt?: (attempt: GenerationAttemptRecord) => Promise<void> | void
  returnDebugInfo?: boolean
  userId?: string
  traceId?: string // Optional: if provided, use this; otherwise generate new one
  overrideValidation?: boolean // When true (superuser only), save cards even when safety validation fails
  systemPromptOverride?: string // When provided (superuser only), use this instead of the constructed system prompt
  userPromptOverride?: string // When provided (superuser only), use this instead of the constructed user prompt
}) {
  const traceId = params.traceId || randomUUID()
  let attemptIndex = 0

  // Build prompts normally, then override if superuser provided custom prompts
  const built = await buildEditorialPrompts({
    surgeryId: params.surgeryId,
    promptText: params.promptText,
    targetRole: params.targetRole,
    count: params.count,
    tags: params.tags,
    interactiveFirst: params.interactiveFirst,
  })

  const toolkit = built.toolkitMeta
  const systemPrompt = params.systemPromptOverride ?? built.systemPrompt
  const userPrompt = params.userPromptOverride ?? built.userPrompt

  // Use matched symptom names directly from the toolkit result (no need to re-parse)
  const matchedSymptomNames: string[] = toolkit.matchedSymptoms

  // Store initial trace (dev/preview only)
  if (process.env.NODE_ENV !== 'production') {
    promptTraceStore.set({
      traceId,
      createdAt: new Date().toISOString(),
      userId: params.userId,
      surgeryId: params.surgeryId,
      targetRole: params.targetRole,
      promptText: params.promptText,
      toolkitInjected: toolkit.toolkitInjected,
      matchedSymptoms: matchedSymptomNames,
      toolkitContextLength: toolkit.toolkitContextLength,
      promptSystem: systemPrompt,
      promptUser: userPrompt,
    })
  }

  const primaryResult = await runGenerationAttempt({
    systemPrompt,
    userPrompt,
    requestId: params.requestId,
    attemptIndex: attemptIndex++,
    traceId,
    onAttempt: params.onAttempt,
  })

  const primaryParsed = await resolveGenerationResult({
    attempt: primaryResult,
    requestId: params.requestId,
    attemptIndex: () => attemptIndex++,
    systemPrompt,
    traceId,
    onAttempt: params.onAttempt,
  })

  let finalResult = primaryParsed
  let validationOverriddenIssues: Array<{ code: string; message: string; cardTitle?: string }> | undefined

  // Post-process ADMIN cards before safety validation:
  // 1. Force sources[0] to be Signposting Toolkit (internal) with URL to surgery's signposting page
  // 2. Normalize empty/whitespace URLs to null
  // 3. Check for forbidden "diagnose/diagnosis" wording
  if (params.targetRole === 'ADMIN') {
    const toolkitSource = {
      title: 'Signposting Toolkit (internal)',
      url: `/s/${params.surgeryId}`,
      publisher: 'Signposting Toolkit',
    }

    const diagnosePattern = /\bdiagnos(e|is|ed|ing)\b/i
    const diagnoseIssues: Array<{ code: string; message: string; cardTitle?: string }> = []

    finalResult.data.cards = finalResult.data.cards.map((card) => {
      // Normalize sources: convert empty/whitespace URLs to null
      let normalizedSources = card.sources.map((source) => ({
        ...source,
        url: source.url && source.url.trim() ? source.url.trim() : null,
      }))

      // Force sources[0] to be Signposting Toolkit (internal) with URL to surgery's signposting page
      const firstIsToolkit =
        normalizedSources[0]?.title === toolkitSource.title && normalizedSources[0]?.url === toolkitSource.url
      if (!firstIsToolkit) {
        normalizedSources = [toolkitSource, ...normalizedSources.filter((s) => s.title !== toolkitSource.title)]
      }

      // Check for forbidden "diagnose/diagnosis" wording
      const cardText = JSON.stringify(card)
      if (diagnosePattern.test(cardText)) {
        // Extract the offending snippet (50 chars around match)
        const match = cardText.match(diagnosePattern)
        if (match && match.index !== undefined) {
          const start = Math.max(0, match.index - 25)
          const end = Math.min(cardText.length, match.index + match[0].length + 25)
          const snippet = cardText.slice(start, end).replace(/\s+/g, ' ').trim()
          diagnoseIssues.push({
            code: 'FORBIDDEN_PATTERN',
            message: `Forbidden content detected: diagnose/diagnosis. Offending snippet: "${snippet}"`,
            cardTitle: card.title,
          })
        }
      }

      return {
        ...card,
        sources: normalizedSources,
      }
    })

    // If diagnose/diagnosis detected, fail early with clear error
    if (diagnoseIssues.length > 0) {
      const debugInfoForError: EditorialDebugInfo | undefined = params.returnDebugInfo
        ? {
            stage: 'after_normalise',
            requestId: params.requestId,
            traceId,
            toolkitInjected: toolkit.toolkitInjected,
            toolkitSource: toolkit.toolkitSource,
            matchedSymptoms: matchedSymptomNames,
            toolkitContextLength: toolkit.toolkitContextLength,
            promptSystem: systemPrompt,
            promptUser: userPrompt,
            modelRawJson: finalResult.data,
            modelNormalisedJson: finalResult.data,
            safetyErrors: diagnoseIssues,
          }
        : undefined

      throw new EditorialAiError('VALIDATION_FAILED', 'Admin output contains forbidden "diagnose/diagnosis" wording', {
        issues: diagnoseIssues,
        traceId,
        debug: debugInfoForError,
      })
    }

    const issues = validateAdminCards({ cards: finalResult.data.cards, promptText: params.promptText })
    if (issues.length > 0) {
      // Superuser override: skip retry and throw, proceed with current cards
      if (params.overrideValidation) {
        validationOverriddenIssues = issues
        if (process.env.NODE_ENV !== 'production') {
          promptTraceStore.update(traceId, {
            safetyValidationPassed: false,
            safetyValidationErrors: issues.map((issue) => ({
              code: issue.code,
              message: issue.message,
              cardTitle: issue.cardTitle,
            })),
          })
        }
      } else {
        // Store initial safety validation failure in trace (before retry)
        if (process.env.NODE_ENV !== 'production') {
          promptTraceStore.update(traceId, {
            safetyValidationPassed: false,
            safetyValidationErrors: issues.map((issue) => ({
              code: issue.code,
              message: issue.message,
              cardTitle: issue.cardTitle,
            })),
          })
        }
        // Reuse the same toolkit context for retry (no need to refetch)
        const retryPrompt = buildUserPrompt({
          promptText: params.promptText,
          targetRole: params.targetRole,
          count: params.count,
          interactiveFirst: params.interactiveFirst,
          toolkitContext: built._rawToolkitContext,
          toolkitSource: built._rawToolkitSource,
          validationIssues: issues,
        })

        const strictSystemPrompt = buildSystemPrompt({ role: params.targetRole, strictAdmin: true })
        const strictResult = await runGenerationAttempt({
          systemPrompt: strictSystemPrompt,
          userPrompt: retryPrompt,
          requestId: params.requestId,
          attemptIndex: attemptIndex++,
          traceId,
          onAttempt: params.onAttempt,
        })

        finalResult = await resolveGenerationResult({
          attempt: strictResult,
          requestId: params.requestId,
          attemptIndex: () => attemptIndex++,
          systemPrompt: strictSystemPrompt,
          traceId,
          onAttempt: params.onAttempt,
        })

        // Re-normalise sources after retry (same logic as before retry)
        finalResult.data.cards = finalResult.data.cards.map((card) => {
          let normalizedSources = card.sources.map((source) => ({
            ...source,
            url: source.url && source.url.trim() ? source.url.trim() : null,
          }))
          const firstIsToolkit =
            normalizedSources[0]?.title === toolkitSource.title && normalizedSources[0]?.url === toolkitSource.url
          if (!firstIsToolkit) {
            normalizedSources = [toolkitSource, ...normalizedSources.filter((s) => s.title !== toolkitSource.title)]
          }
          return { ...card, sources: normalizedSources }
        })

        const retryIssues = validateAdminCards({
          cards: finalResult.data.cards,
          promptText: params.promptText,
        })
        if (retryIssues.length > 0) {
          // Superuser override: skip throw, proceed with current cards
          if (params.overrideValidation) {
            validationOverriddenIssues = retryIssues
          } else {
            // Store safety validation failure in trace before throwing
            if (process.env.NODE_ENV !== 'production') {
              promptTraceStore.update(traceId, {
                safetyValidationPassed: false,
                safetyValidationErrors: retryIssues.map((issue) => ({
                  code: issue.code,
                  message: issue.message,
                  cardTitle: issue.cardTitle,
                })),
              })
            }
            // Build debug info for error response
            const debugInfoForError: EditorialDebugInfo | undefined = params.returnDebugInfo
              ? {
                  stage: 'safety_validation',
                  requestId: params.requestId,
                  traceId,
                  toolkitInjected: toolkit.toolkitInjected,
                  toolkitSource: toolkit.toolkitSource,
                  matchedSymptoms: matchedSymptomNames,
                  toolkitContextLength: toolkit.toolkitContextLength,
                  promptSystem: systemPrompt,
                  promptUser: userPrompt,
                  modelRawJson: finalResult.data,
                  modelNormalisedJson: finalResult.data,
                  safetyErrors: retryIssues.map((issue) => ({
                    code: issue.code,
                    message: issue.message,
                    cardTitle: issue.cardTitle,
                  })),
                }
              : undefined

            throw new EditorialAiError('VALIDATION_FAILED', 'Admin output failed safety validation', {
              issues: retryIssues,
              traceId,
              debug: debugInfoForError,
            })
          }
        }
      }
    }
    
    // Mark safety validation as passed if we got here (ADMIN role only); skip when overridden
    if (
      params.targetRole === 'ADMIN' &&
      process.env.NODE_ENV !== 'production' &&
      !validationOverriddenIssues
    ) {
      promptTraceStore.update(traceId, {
        safetyValidationPassed: true,
        safetyValidationErrors: undefined,
      })
    }
  }

  // Update trace with final sources from cards (dev/preview only)
  if (process.env.NODE_ENV !== 'production') {
    const firstCardSources = finalResult.data.cards[0]?.sources
    promptTraceStore.update(traceId, {
      sources: firstCardSources,
    })
  }

  const result = {
    cards: finalResult.data.cards,
    quiz: finalResult.data.quiz,
    modelUsed: finalResult.modelUsed,
    traceId, // Always return traceId
  }

  // Build generation metadata (lightweight summary for DB persistence)
  const generationMeta = {
    toolkitInjected: toolkit.toolkitInjected,
    matchedSymptoms: matchedSymptomNames,
    toolkitContextLength: toolkit.toolkitContextLength,
    fallbackUsed: toolkit.fallbackUsed,
    fallbackReason: toolkit.fallbackReason,
    totalSymptomsSearched: toolkit.totalSymptomsSearched,
    ...(validationOverriddenIssues?.length
      ? {
          validationOverridden: true,
          validationIssues: validationOverriddenIssues.map((i) => ({
            code: i.code,
            message: i.message,
            cardTitle: i.cardTitle,
          })),
        }
      : {}),
  }

  // Add debug info if requested (superusers + non-production admins)
  if (params.returnDebugInfo) {
    return {
      ...result,
      generationMeta,
      debug: {
        promptUser: userPrompt,
        promptSystem: systemPrompt,
        toolkitInjected: toolkit.toolkitInjected,
        toolkitSource: toolkit.toolkitSource,
        matchedSymptoms: matchedSymptomNames,
        toolkitContextLength: toolkit.toolkitContextLength,
        fallbackUsed: toolkit.fallbackUsed,
        fallbackReason: toolkit.fallbackReason,
        totalSymptomsSearched: toolkit.totalSymptomsSearched,
        toolkitContextSnippet: toolkit.toolkitContextSnippet,
      },
    }
  }

  return { ...result, generationMeta }
}

export async function generateEditorialVariations(params: {
  surgeryId: string
  sourceCard: z.infer<typeof EditorialLearningCardZ>
  variationsCount: number
  userInstruction?: string
}) {
  const role = params.sourceCard.targetRole
  const toolkit = await resolveSignpostingToolkitAdvice({
    surgeryId: params.surgeryId,
    promptText: JSON.stringify(params.sourceCard),
    tags: params.sourceCard.tags,
    targetRole: role,
  })
  const toolkitSection = role === 'ADMIN' ? formatToolkitSection(toolkit?.context, toolkit?.source) : ''

  const userPrompt = `${toolkitSection}Create ${params.variationsCount} variations of the card below.
Keep the learning objective the same but change scenario framing and wording.
${params.userInstruction ? `Extra instruction: ${params.userInstruction}` : ''}

SOURCE CARD JSON:
${JSON.stringify(params.sourceCard, null, 2)}

Return JSON using this schema:
${VARIATION_SCHEMA}
Return ONLY valid JSON. No markdown, no commentary.
`

  const result = await callAzureOpenAi({
    systemPrompt: buildSystemPrompt({ role }),
    userPrompt,
  })

  const parsed = parseJson(result.content)
  const validation = z.object({ cards: z.array(EditorialLearningCardZ).min(1) }).safeParse(parsed)
  if (!validation.success) {
    throw new EditorialAiError('INVALID_JSON', 'Variation output did not match schema', validation.error)
  }

  return {
    cards: validation.data.cards,
    modelUsed: result.modelUsed,
  }
}

export async function regenerateEditorialSection(params: {
  surgeryId: string
  card: z.infer<typeof EditorialLearningCardZ>
  section: string
  userInstruction?: string
}) {
  const role = params.card.targetRole
  const toolkit = await resolveSignpostingToolkitAdvice({
    surgeryId: params.surgeryId,
    promptText: JSON.stringify(params.card),
    tags: params.card.tags,
    targetRole: role,
  })
  const toolkitSection = role === 'ADMIN' ? formatToolkitSection(toolkit?.context, toolkit?.source) : ''

  const sectionPrompt = `${toolkitSection}Regenerate ONLY the "${params.section}" section of the card JSON below.
Do not change other sections.
${params.userInstruction ? `Instruction: ${params.userInstruction}` : ''}

CARD JSON:
${JSON.stringify(params.card, null, 2)}

Return JSON with ONLY the updated section, using one of these shapes:
{"title": "string"}
{"contentBlocks": [ ... ]}
{"interaction": { ... }}
{"options": ["string"], "correctIndex": 0}
{"explanation": "string"}
{"safetyNetting": ["string"]}
{"sources": [{ "title": "string", "url": "https://", "publisher": "string?", "accessedDate": "string?" }]}
{"slotLanguage": { "relevant": true|false, "guidance": [{ "slot": "Red|Orange|Pink-Purple|Green", "rule": "string" }] }}
Return ONLY valid JSON. No markdown, no commentary.
`

  const result = await callAzureOpenAi({
    systemPrompt: buildSystemPrompt({ role }),
    userPrompt: sectionPrompt,
  })

  return {
    patch: parseJson(result.content),
    modelUsed: result.modelUsed,
  }
}

async function callAzureOpenAi(params: { systemPrompt: string; userPrompt: string }) {
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT
  const apiKey = process.env.AZURE_OPENAI_API_KEY
  const deployment = process.env.AZURE_OPENAI_DEPLOYMENT
  const apiVersion = process.env.AZURE_OPENAI_API_VERSION

  if (!endpoint || !apiKey || !deployment || !apiVersion) {
    throw new EditorialAiError('CONFIG_MISSING', 'Missing Azure OpenAI configuration')
  }

  const apiUrl = `${endpoint}openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`
  
  // Add timeout controller for long-running requests
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 240000) // 4 minute timeout
  
  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': apiKey,
      },
      body: JSON.stringify({
        temperature: DEFAULT_TEMPERATURE,
        messages: [
          { role: 'system', content: params.systemPrompt.trim() },
          { role: 'user', content: params.userPrompt.trim() },
        ],
      }),
      signal: controller.signal,
    })
    clearTimeout(timeoutId)

    if (!response.ok) {
      const errorText = await response.text()
      throw new EditorialAiError('LLM_FAILED', `AI request failed: ${response.status}`, errorText)
    }

    const data = await response.json()
    const content = data?.choices?.[0]?.message?.content
    if (!content) {
      throw new EditorialAiError('LLM_EMPTY', 'AI returned empty content')
    }

    return {
      content: content as string,
      modelUsed: data?.model ?? deployment,
    }
  } catch (error) {
    clearTimeout(timeoutId)
    if (error instanceof Error && error.name === 'AbortError') {
      throw new EditorialAiError('LLM_TIMEOUT', 'AI request timed out after 4 minutes')
    }
    throw error
  }
}

function parseJson(input: string) {
  const trimmed = input.trim()
  const withoutFence = trimmed.replace(/^```json\s*/i, '').replace(/```$/i, '')
  return JSON.parse(withoutFence)
}

export class EditorialAiError extends Error {
  constructor(
    public code:
      | 'CONFIG_MISSING'
      | 'LLM_FAILED'
      | 'LLM_EMPTY'
      | 'INVALID_JSON'
      | 'VALIDATION_FAILED'
      | 'SCHEMA_MISMATCH',
    message: string,
    public details?: unknown
  ) {
    super(message)
  }
}
