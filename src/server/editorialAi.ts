import 'server-only'

import { promises as fs } from 'node:fs'
import path from 'node:path'
import {
  EditorialGenerationOutputZ,
  EditorialLearningCardZ,
  type EditorialRole,
} from '@/lib/schemas/editorial'
import { validateAdminCards, type AdminValidationIssue } from '@/lib/editorial/adminValidator'
import { getRoleProfile } from '@/lib/editorial/roleProfiles'
import {
  ADMIN_TOOLKIT_SOURCE_BASE_URL,
  ADMIN_TOOLKIT_SOURCE_PUBLISHER,
  ADMIN_TOOLKIT_SOURCE_TITLE,
} from '@/lib/editorial/toolkitSources'
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
`

const ADMIN_SOURCE_RULES = `
ADMIN SOURCES:
- sources[0] MUST be "Signposting Toolkit (internal)" using the TOOLKIT SOURCE details provided.
- Only add NHS/NICE for safety-netting wording if needed.
- Do not cite GP college guidance for admin cards.
`

type ToolkitPack = {
  id: string
  filePath: string
  keywords: string[]
  sourceRoute: string
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
      "reviewByDate": "YYYY-MM-DD",
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
      "reviewByDate": "YYYY-MM-DD",
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
  return issues.map((issue) => `- ${issue.message}${issue.cardTitle ? ` (Card: ${issue.cardTitle})` : ''}`).join('\n')
}

function formatToolkitSection(toolkitContext?: string, toolkitSource?: { title: string; url: string; publisher: string }) {
  if (!toolkitContext || !toolkitSource) return ''
  return `TOOLKIT CONTEXT (primary authority):
${toolkitContext.trim()}

TOOLKIT SOURCE (use as sources[0]):
Title: ${toolkitSource.title}
URL: ${toolkitSource.url}
Publisher: ${toolkitSource.publisher}

`
}

function buildUserPrompt(params: {
  promptText: string
  targetRole: EditorialRole
  count: number
  tags?: string[]
  interactiveFirst: boolean
  toolkitContext?: string
  toolkitSource?: { title: string; url: string; publisher: string }
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
Tags: ${(params.tags || []).join(', ') || 'none'}
Interactive-first: ${params.interactiveFirst ? 'yes' : 'no'}

Return JSON using this schema:
${GENERATION_SCHEMA}
`
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

async function resolveAdminToolkitContext(params: { promptText: string; tags?: string[] }) {
  const combined = [params.promptText, ...(params.tags || [])].join(' ')
  const pack = findToolkitPack(combined)
  const sourceRoute = pack?.sourceRoute ?? 'admin-core'
  const source = {
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

export async function generateEditorialBatch(params: {
  promptText: string
  targetRole: EditorialRole
  count: number
  tags?: string[]
  interactiveFirst: boolean
}) {
  const toolkit =
    params.targetRole === 'ADMIN'
      ? await resolveAdminToolkitContext({ promptText: params.promptText, tags: params.tags })
      : null

  const userPrompt = buildUserPrompt({
    promptText: params.promptText,
    targetRole: params.targetRole,
    count: params.count,
    tags: params.tags,
    interactiveFirst: params.interactiveFirst,
    toolkitContext: toolkit?.context,
    toolkitSource: toolkit?.source,
  })

  const result = await callAzureOpenAi({
    systemPrompt: buildSystemPrompt({ role: params.targetRole }),
    userPrompt,
  })

  const parsed = parseJson(result.content)
  const validation = EditorialGenerationOutputZ.safeParse(parsed)
  if (!validation.success) {
    throw new EditorialAiError('INVALID_JSON', 'Generated output did not match schema', validation.error)
  }

  if (params.targetRole === 'ADMIN') {
    const issues = validateAdminCards({ cards: validation.data.cards, promptText: params.promptText })
    if (issues.length > 0) {
      const retryPrompt = buildUserPrompt({
        promptText: params.promptText,
        targetRole: params.targetRole,
        count: params.count,
        tags: params.tags,
        interactiveFirst: params.interactiveFirst,
        toolkitContext: toolkit?.context,
        toolkitSource: toolkit?.source,
        validationIssues: issues,
      })

      const retryResult = await callAzureOpenAi({
        systemPrompt: buildSystemPrompt({ role: params.targetRole, strictAdmin: true }),
        userPrompt: retryPrompt,
      })

      const retryParsed = parseJson(retryResult.content)
      const retryValidation = EditorialGenerationOutputZ.safeParse(retryParsed)
      if (!retryValidation.success) {
        throw new EditorialAiError(
          'INVALID_JSON',
          'Generated output did not match schema after admin retry',
          retryValidation.error
        )
      }

      const retryIssues = validateAdminCards({
        cards: retryValidation.data.cards,
        promptText: params.promptText,
      })
      if (retryIssues.length > 0) {
        throw new EditorialAiError('VALIDATION_FAILED', 'Admin output failed safety validation', retryIssues)
      }

      return {
        cards: retryValidation.data.cards,
        quiz: retryValidation.data.quiz,
        modelUsed: retryResult.modelUsed,
      }
    }
  }

  return {
    cards: validation.data.cards,
    quiz: validation.data.quiz,
    modelUsed: result.modelUsed,
  }
}

export async function generateEditorialVariations(params: {
  sourceCard: z.infer<typeof EditorialLearningCardZ>
  variationsCount: number
  userInstruction?: string
}) {
  const role = params.sourceCard.targetRole
  const toolkit =
    role === 'ADMIN'
      ? await resolveAdminToolkitContext({
          promptText: JSON.stringify(params.sourceCard),
          tags: params.sourceCard.tags,
        })
      : null
  const toolkitSection = role === 'ADMIN' ? formatToolkitSection(toolkit?.context, toolkit?.source) : ''

  const userPrompt = `${toolkitSection}Create ${params.variationsCount} variations of the card below.
Keep the learning objective the same but change scenario framing and wording.
${params.userInstruction ? `Extra instruction: ${params.userInstruction}` : ''}

SOURCE CARD JSON:
${JSON.stringify(params.sourceCard, null, 2)}

Return JSON using this schema:
${VARIATION_SCHEMA}
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
  card: z.infer<typeof EditorialLearningCardZ>
  section: string
  userInstruction?: string
}) {
  const role = params.card.targetRole
  const toolkit =
    role === 'ADMIN'
      ? await resolveAdminToolkitContext({
          promptText: JSON.stringify(params.card),
          tags: params.card.tags,
        })
      : null
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
  })

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
}

function parseJson(input: string) {
  const trimmed = input.trim()
  const withoutFence = trimmed.replace(/^```json\s*/i, '').replace(/```$/i, '')
  return JSON.parse(withoutFence)
}

export class EditorialAiError extends Error {
  constructor(
    public code: 'CONFIG_MISSING' | 'LLM_FAILED' | 'LLM_EMPTY' | 'INVALID_JSON' | 'VALIDATION_FAILED',
    message: string,
    public details?: unknown
  ) {
    super(message)
  }
}
