import { z } from 'zod'
import { EditorialGenerationOutputZ } from '@/lib/schemas/editorial'

export type GenerationValidationIssue = {
  path: string
  message: string
}

export type ParseAndValidateResult =
  | {
      success: true
      data: z.infer<typeof EditorialGenerationOutputZ>
      rawJson: unknown
      normalisedJson: unknown
      repaired: boolean
    }
  | {
      success: false
      issues: GenerationValidationIssue[]
      rawJson?: unknown
      normalisedJson?: unknown
      repaired: boolean
    }

const SMART_QUOTES = /[“”]/g
const SMART_SINGLE_QUOTES = /[‘’]/g
const TRAILING_COMMAS = /,\s*([}\]])/g
const UNQUOTED_KEYS = /([{,]\s*)([A-Za-z0-9_]+)\s*:/g

const SLOT_NORMALISATION: Record<string, string> = {
  red: 'Red',
  orange: 'Orange',
  green: 'Green',
  'pink-purple': 'Pink-Purple',
  'pink/purple': 'Pink-Purple',
  'pink / purple': 'Pink-Purple',
  pink: 'Pink-Purple',
  purple: 'Pink-Purple',
}

const ROLE_NORMALISATION: Record<string, string> = {
  admin: 'ADMIN',
  receptionist: 'ADMIN',
  reception: 'ADMIN',
  gp: 'GP',
  nurse: 'NURSE',
}

const RISK_NORMALISATION: Record<string, string> = {
  low: 'LOW',
  med: 'MED',
  medium: 'MED',
  high: 'HIGH',
}

function normaliseSlot(value: unknown) {
  if (typeof value !== 'string') return value
  const normalised = SLOT_NORMALISATION[value.trim().toLowerCase()]
  return normalised ?? value
}

function normaliseRole(value: unknown) {
  if (typeof value !== 'string') return value
  const normalised = ROLE_NORMALISATION[value.trim().toLowerCase()]
  return normalised ?? value.toUpperCase()
}

function normaliseRiskLevel(value: unknown) {
  if (typeof value !== 'string') return value
  const normalised = RISK_NORMALISATION[value.trim().toLowerCase()]
  return normalised ?? value.toUpperCase()
}

function normaliseCorrectIndex(value: unknown) {
  if (typeof value === 'number') return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    if (!Number.isNaN(parsed)) {
      return parsed
    }
  }
  return value
}

function ensureArray<T>(value: T | T[] | undefined) {
  if (!value) return []
  return Array.isArray(value) ? value : [value]
}

function normaliseGenerationOutput(raw: unknown) {
  if (!raw || typeof raw !== 'object') return raw
  const output =
    typeof structuredClone === 'function'
      ? (structuredClone(raw) as Record<string, unknown>)
      : (JSON.parse(JSON.stringify(raw)) as Record<string, unknown>)
  const cards = Array.isArray(output.cards) ? output.cards : []

  output.cards = cards.map((card) => {
    if (!card || typeof card !== 'object') return card
    const typedCard = card as Record<string, unknown>
    typedCard.targetRole = normaliseRole(typedCard.targetRole)
    typedCard.riskLevel = normaliseRiskLevel(typedCard.riskLevel)

    typedCard.interactions = ensureArray(typedCard.interactions).map((interaction) => {
      if (!interaction || typeof interaction !== 'object') return interaction
      const typedInteraction = interaction as Record<string, unknown>
      typedInteraction.correctIndex = normaliseCorrectIndex(typedInteraction.correctIndex)
      return typedInteraction
    })

    if (typedCard.slotLanguage && typeof typedCard.slotLanguage === 'object') {
      const slotLanguage = typedCard.slotLanguage as Record<string, unknown>
      slotLanguage.guidance = ensureArray(slotLanguage.guidance).map((guidance) => {
        if (!guidance || typeof guidance !== 'object') return guidance
        const typedGuidance = guidance as Record<string, unknown>
        typedGuidance.slot = normaliseSlot(typedGuidance.slot)
        return typedGuidance
      })
      typedCard.slotLanguage = slotLanguage
    }

    return typedCard
  })

  if (output.quiz && typeof output.quiz === 'object') {
    const quiz = output.quiz as Record<string, unknown>
    quiz.questions = ensureArray(quiz.questions).map((question) => {
      if (!question || typeof question !== 'object') return question
      const typedQuestion = question as Record<string, unknown>
      typedQuestion.correctIndex = normaliseCorrectIndex(typedQuestion.correctIndex)
      return typedQuestion
    })
    output.quiz = quiz
  }

  return output
}

function stripJsonFences(value: string) {
  return value.replace(/```json\s*/gi, '').replace(/```/g, '')
}

function extractJsonSubstring(raw: string) {
  const trimmed = stripJsonFences(raw.trim())
  const firstBrace = trimmed.indexOf('{')
  if (firstBrace === -1) {
    return trimmed
  }
  const lastBrace = trimmed.lastIndexOf('}')
  if (lastBrace === -1) {
    return trimmed.slice(firstBrace)
  }
  return trimmed.slice(firstBrace, lastBrace + 1)
}

function attemptJsonRepair(input: string) {
  return input
    .replace(SMART_QUOTES, '"')
    .replace(SMART_SINGLE_QUOTES, '"')
    .replace(TRAILING_COMMAS, '$1')
    .replace(UNQUOTED_KEYS, '$1"$2":')
}

function formatZodIssues(error: z.ZodError): GenerationValidationIssue[] {
  return error.issues.map((issue) => {
    const path = issue.path.length > 0 ? issue.path.join('.') : 'root'
    const expected = 'expected' in issue ? issue.expected : undefined
    const received = 'received' in issue ? issue.received : undefined
    const suffix =
      expected && received ? ` (expected ${String(expected)}, received ${String(received)})` : ''
    return { path, message: `${issue.message}${suffix}` }
  })
}

function parseJsonWithRepair(raw: string) {
  const cleaned = extractJsonSubstring(raw)
  try {
    return { parsed: JSON.parse(cleaned), repaired: false }
  } catch {
    const repaired = attemptJsonRepair(cleaned)
    return { parsed: JSON.parse(repaired), repaired: true }
  }
}

function parseErrorIssue(error: unknown): GenerationValidationIssue[] {
  const message = error instanceof Error ? error.message : 'Unknown JSON parse error'
  return [{ path: 'root', message: `Unable to parse JSON (${message}).` }]
}

export function parseAndValidateGeneration(output: string): ParseAndValidateResult {
  let parsed: unknown
  let repaired = false

  try {
    const result = parseJsonWithRepair(output)
    parsed = result.parsed
    repaired = result.repaired
  } catch (error) {
    return { success: false, issues: parseErrorIssue(error), repaired: false }
  }

  const normalised = normaliseGenerationOutput(parsed)
  const validation = EditorialGenerationOutputZ.safeParse(normalised)
  if (!validation.success) {
    return {
      success: false,
      issues: formatZodIssues(validation.error),
      rawJson: parsed,
      normalisedJson: normalised,
      repaired,
    }
  }

  return {
    success: true,
    data: validation.data,
    rawJson: parsed,
    normalisedJson: normalised,
    repaired,
  }
}
