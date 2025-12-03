import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/rbac'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { isFeatureEnabledForUser } from '@/lib/features'

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
    const instructionsContent = instructionsHtml || instructionsText || ''

    if (!instructionsContent.trim()) {
      return NextResponse.json({ error: 'Instructions text or HTML is required' }, { status: 400 })
    }

    // Get Azure OpenAI configuration from environment variables
    const endpoint = process.env.AZURE_OPENAI_ENDPOINT
    const apiKey = process.env.AZURE_OPENAI_API_KEY
    const deployment = process.env.AZURE_OPENAI_DEPLOYMENT
    const apiVersion = process.env.AZURE_OPENAI_API_VERSION

    if (!endpoint || !apiKey || !deployment || !apiVersion) {
      console.error('Missing Azure OpenAI configuration')
      return NextResponse.json({ error: 'AI service configuration error' }, { status: 500 })
    }

    // Construct the API URL - Azure OpenAI chat completions endpoint
    const apiUrl = `${endpoint}openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`

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

    // Call Azure OpenAI API
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': apiKey,
      },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.4,
        max_tokens: 1200,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Azure OpenAI API error:', response.status, errorText)
      return NextResponse.json({ error: 'AI service error' }, { status: 500 })
    }

    const data = await response.json()
    
    let rawContent = data.choices?.[0]?.message?.content || ''
    
    if (!rawContent) {
      console.error('AI response missing content:', data)
      return NextResponse.json({ error: 'Invalid AI response' }, { status: 500 })
    }

    // Strip markdown code fences if present
    rawContent = rawContent.trim()
    rawContent = rawContent.replace(/^```json\s*/i, '')
    rawContent = rawContent.replace(/^```\s*/i, '')
    rawContent = rawContent.replace(/\s*```\s*$/, '')
    rawContent = rawContent.trim()

    // Parse JSON safely
    let questionPrompts: QuestionPromptsResponse
    try {
      questionPrompts = JSON.parse(rawContent) as QuestionPromptsResponse
    } catch (parseError) {
      console.error('Failed to parse AI response as JSON:', rawContent)
      return NextResponse.json({ 
        error: 'Failed to parse AI response. The service returned invalid JSON.',
        details: parseError instanceof Error ? parseError.message : 'Unknown parsing error'
      }, { status: 500 })
    }

    // Validate the structure
    if (!questionPrompts.symptom || !questionPrompts.ageGroup || !Array.isArray(questionPrompts.groups)) {
      console.error('Invalid question prompts structure:', questionPrompts)
      return NextResponse.json({ 
        error: 'Invalid response structure from AI service'
      }, { status: 500 })
    }

    const model = data.model || deployment
    const timestamp = new Date().toISOString()

    // Log audit information
    console.info('AI question prompts generated:', { symptomName, ageGroup, model, timestamp })

    // Log token usage (non-blocking)
    try {
      const promptTokens = data.usage?.prompt_tokens ?? 0
      const completionTokens = data.usage?.completion_tokens ?? 0
      const totalTokens = data.usage?.total_tokens ?? (promptTokens + completionTokens)

      const inputRate = parseFloat(process.env.AZURE_OPENAI_COST_INPUT_PER_1K_USD || '0')
      const outputRate = parseFloat(process.env.AZURE_OPENAI_COST_OUTPUT_PER_1K_USD || '0')

      // cost = (promptTokens * inputRate + completionTokens * outputRate) / 1000
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

