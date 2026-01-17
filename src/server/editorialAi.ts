import 'server-only'

import {
  EditorialGenerationOutputZ,
  EditorialLearningCardZ,
  EditorialQuizZ,
  type EditorialRole,
} from '@/lib/schemas/editorial'
import { z } from 'zod'

const DEFAULT_TEMPERATURE = 0.2

const BASE_SYSTEM_PROMPT = `
You are an editorial assistant for Daily Dose learning cards in UK general practice.

OUTPUT RULES:
- Output MUST be valid JSON only. No prose, no markdown, no code fences.
- Follow the JSON schema exactly.
- Use British English spelling.

CONTENT RULES:
- Admin-facing tone: process, recognition, escalation, safety netting.
- No diagnosis or prescriptive clinical advice.
- Use triage slot language where relevant: Red / Orange / Pink-Purple / Green.
- If high-risk content is present, mark riskLevel HIGH.
- Every card must include at least one interaction with an explanation.
- Provide UK sources (NHS, NICE, UKHSA, MHRA, GMC, RCGP, gov.uk).
- If you cannot provide a reliable UK source, set needsSourcing = true.
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

export async function generateEditorialBatch(params: {
  promptText: string
  targetRole: EditorialRole
  count: number
  tags?: string[]
  interactiveFirst: boolean
}) {
  const userPrompt = `
Create ${params.count} learning cards for ${params.targetRole} staff.
Prompt: ${params.promptText}
Tags: ${(params.tags || []).join(', ') || 'none'}
Interactive-first: ${params.interactiveFirst ? 'yes' : 'no'}

Return JSON using this schema:
${GENERATION_SCHEMA}
`

  const result = await callAzureOpenAi({
    systemPrompt: BASE_SYSTEM_PROMPT,
    userPrompt,
  })

  const parsed = parseJson(result.content)
  const validation = EditorialGenerationOutputZ.safeParse(parsed)
  if (!validation.success) {
    throw new EditorialAiError('INVALID_JSON', 'Generated output did not match schema', validation.error)
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
  const userPrompt = `
Create ${params.variationsCount} variations of the card below.
Keep the learning objective the same but change scenario framing and wording.
${params.userInstruction ? `Extra instruction: ${params.userInstruction}` : ''}

SOURCE CARD JSON:
${JSON.stringify(params.sourceCard, null, 2)}

Return JSON using this schema:
${VARIATION_SCHEMA}
`

  const result = await callAzureOpenAi({
    systemPrompt: BASE_SYSTEM_PROMPT,
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
  const sectionPrompt = `
Regenerate ONLY the "${params.section}" section of the card JSON below.
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
    systemPrompt: BASE_SYSTEM_PROMPT,
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
    public code: 'CONFIG_MISSING' | 'LLM_FAILED' | 'LLM_EMPTY' | 'INVALID_JSON',
    message: string,
    public details?: unknown
  ) {
    super(message)
  }
}
