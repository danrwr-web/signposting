import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/rbac'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { isFeatureEnabledForUser } from '@/lib/features'
import { callAzureOpenAI, AzureOpenAIError, extractJson } from '@/server/azureOpenAI'

export const runtime = 'nodejs'

const questionPromptsSchema = z.object({
  symptomName: z.string(),
  ageGroup: z.string(),
  briefInstruction: z.string().optional(),
  instructionsText: z.string().optional(),
  instructionsHtml: z.string().optional(),
})

interface QuestionGroup {
  label: string
  questions: string[]
}

interface QuestionPromptsResponse {
  symptom: string
  ageGroup: string
  groups: QuestionGroup[]
}

export async function POST(request: NextRequest) {
  try {
    // Check authentication and feature flag
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user has access to ai_training feature
    const canUse = await isFeatureEnabledForUser(user.id, 'ai_training')
    if (!canUse) {
      return NextResponse.json({ error: 'Feature not enabled for this user' }, { status: 403 })
    }

    // Parse and validate request body
    const body = await request.json()
    const { symptomName, ageGroup, briefInstruction, instructionsText, instructionsHtml } = questionPromptsSchema.parse(body)

    // Get the instructions text - prefer HTML if available, fallback to plain text
    // Truncate to prevent exceeding model context window
    const MAX_INPUT_CHARS = 8000
    let instructionsContent = instructionsHtml || instructionsText || ''
    if (instructionsContent.length > MAX_INPUT_CHARS) {
      console.warn(`question-prompts: truncating instructions from ${instructionsContent.length} to ${MAX_INPUT_CHARS} chars`)
      instructionsContent = instructionsContent.slice(0, MAX_INPUT_CHARS) + '\n... [truncated — original text was too long to process in full]'
    }

    if (!instructionsContent.trim()) {
      return NextResponse.json({ error: 'Instructions text or HTML is required' }, { status: 400 })
    }

    // Azure OpenAI configuration is read by the shared helper

    // Create the prompt
    const systemPrompt = `You are an assistant helping non-clinical GP admin and reception staff by generating PATIENT-FRIENDLY QUESTIONS based on written signposting instructions.

Your role is to help staff gather the information they need to follow the toolkit rules correctly.`

    const userPrompt = `
You will be given internal GP signposting guidance used by reception/admin staff in UK primary care.

SYMPTOM NAME: "${symptomName}"
AGE GROUP: "${ageGroup}"
BRIEF INSTRUCTION (routing label): "${briefInstruction || '(none provided)'}"

FULL INSTRUCTIONS (internal guidance for staff):
"""
${instructionsContent}
"""

TASK:
Generate PATIENT-FRIENDLY QUESTIONS that help non-clinical admin/reception staff gather the information needed to follow these instructions correctly.

CRITICAL RULES:
- Use ONLY information implied by the provided instructions. Do NOT invent new rules or criteria.
- Keep language plain and simple, avoiding medical jargon.
- Focus on questions that help identify:
  * Emergencies / red flags (if mentioned in instructions)
  * How soon they need to be seen (if mentioned in instructions)
  * Where they should be directed (self-care, pharmacy, nurse, GP, urgent appointment, 999, etc.) - ONLY if this is actually present in the instructions
- If unsure, bias questions towards safety and earlier review, but do NOT contradict the written instructions.
- Questions should be phrased as if the receptionist is asking the patient directly (patient-friendly language).
- Do NOT include questions about things not mentioned in the instructions.

OUTPUT FORMAT:
You MUST return VALID JSON ONLY, with this exact structure:
{
  "symptom": "${symptomName}",
  "ageGroup": "${ageGroup}",
  "groups": [
    {
      "label": "Check for emergencies / red flags",
      "questions": [
        "Question 1 here",
        "Question 2 here"
      ]
    },
    {
      "label": "Assess urgency / timing",
      "questions": [
        "Question 1 here"
      ]
    },
    {
      "label": "Determine appropriate care pathway",
      "questions": [
        "Question 1 here"
      ]
    }
  ]
}

IMPORTANT:
- Return ONLY valid JSON. Do NOT include markdown code fences, explanations, or any other text.
- Group questions logically by purpose (e.g., red flags, urgency, routing).
- Include 2-5 questions per group.
- If a category doesn't apply based on the instructions, omit that group entirely.
- Use clear, concise labels for groups.
- Questions should be complete sentences that can be asked directly to patients.
`

    // Call Azure OpenAI API via shared helper
    const aiResponse = await callAzureOpenAI({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: 4096,
    })

    const rawContent = aiResponse.content

    if (!rawContent) {
      console.error('AI response missing content')
      return NextResponse.json({ error: 'Invalid AI response' }, { status: 500 })
    }

    // Parse JSON with fallback extraction (handles markdown fences, reasoning prefixes, etc.)
    const parsed = extractJson(rawContent)
    if (!parsed) {
      console.error('Failed to parse AI response as JSON:', rawContent.slice(0, 500))
      return NextResponse.json({
        error: 'Failed to parse AI response. The service returned invalid JSON.',
      }, { status: 500 })
    }

    const questionPrompts = parsed as unknown as QuestionPromptsResponse

    // Fill in missing fields from request data rather than failing
    questionPrompts.symptom = questionPrompts.symptom || symptomName
    questionPrompts.ageGroup = questionPrompts.ageGroup || ageGroup

    if (!Array.isArray(questionPrompts.groups)) {
      console.error('Invalid question prompts structure (missing groups):', parsed)
      return NextResponse.json({
        error: 'Invalid response structure from AI service'
      }, { status: 500 })
    }

    const model = aiResponse.model
    const timestamp = new Date().toISOString()

    // Log audit information
    console.info('AI question prompts generated:', { symptomName, ageGroup, model, timestamp })

    // Log token usage (non-blocking)
    try {
      const { prompt_tokens: promptTokens, completion_tokens: completionTokens, total_tokens: totalTokens } = aiResponse.usage

      const inputRate = parseFloat(process.env.AZURE_OPENAI_COST_INPUT_PER_1K_USD || '0')
      const outputRate = parseFloat(process.env.AZURE_OPENAI_COST_OUTPUT_PER_1K_USD || '0')

      const estimatedCostUsd =
        ((promptTokens * inputRate) + (completionTokens * outputRate)) / 1000

      await prisma.tokenUsageLog.create({
        data: {
          userEmail: user.email,
          route: 'questionPrompts',
          modelUsed: model,
          promptTokens,
          completionTokens,
          totalTokens,
          estimatedCostUsd,
        },
      })
    } catch (error) {
      // Don't block the API response if logging fails
      console.error('Failed to log token usage:', error)
    }

    // Return the result
    return NextResponse.json({
      ...questionPrompts,
      model,
      timestamp,
    })
  } catch (error) {
    if (error instanceof AzureOpenAIError) {
      const httpStatus = error.status === 0 ? 503 : 500
      return NextResponse.json({ error: error.clientMessage }, { status: httpStatus })
    }
    if (error instanceof z.ZodError) {
      console.error('Validation error:', error.issues)
      return NextResponse.json({
        error: 'Invalid input',
        details: error.issues
      }, { status: 400 })
    }

    console.error('Error in questionPrompts:', error)
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

