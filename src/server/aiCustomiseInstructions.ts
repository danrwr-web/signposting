import 'server-only'
import { prisma } from '@/lib/prisma'

export interface CustomisedInstructionResult {
  briefInstruction: string
  instructionsHtml: string
  instructionsJson?: string
  modelUsed: string
}

interface BaseSymptomData {
  name: string
  ageGroup: string
  briefInstruction: string | null
  instructionsHtml: string | null
}

interface OnboardingProfileJson {
  surgeryName: string | null
  urgentCareModel: {
    hasDutyDoctor: boolean
    dutyDoctorTerm: string | null
    usesRedSlots: boolean
    redSlotName?: string | null
    urgentSlotsDescription: string
  }
  bookingRules: {
    canBookDirectly: string[]
    mustNotBookDirectly: string
  }
  team: {
    roles: string[]
    roleRoutingNotes: string
  }
  escalation: {
    firstEscalation: string | null
    urgentWording: string
  }
  localServices: {
    msk: string
    mentalHealth: string
    socialPrescribing: string
    communityNursing: string
    audiology: string
    frailty: string
    sexualHealth: string
    outOfHours: string
    includeInInstructions: 'yes' | 'brief' | 'no'
  }
  communicationStyle: {
    detailLevel: 'brief' | 'moderate' | 'detailed'
    terminologyPreference: 'surgery' | 'generic' | 'mixed'
  }
}

/**
 * Customise symptom instructions using AI based on surgery onboarding profile
 */
export async function customiseInstructions(
  baseSymptom: BaseSymptomData,
  onboardingProfile: OnboardingProfileJson,
  userEmail: string
): Promise<CustomisedInstructionResult> {
  // Get Azure OpenAI configuration
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT
  const apiKey = process.env.AZURE_OPENAI_API_KEY
  const deployment = process.env.AZURE_OPENAI_DEPLOYMENT
  const apiVersion = process.env.AZURE_OPENAI_API_VERSION

  if (!endpoint || !apiKey || !deployment || !apiVersion) {
    throw new Error('Missing Azure OpenAI configuration')
  }

  const apiUrl = `${endpoint}openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`

  // Build system prompt
  const systemPrompt = `You are rewriting admin-facing signposting instructions for a specific GP surgery.

Your task is to adapt generic symptom signposting guidance to match this surgery's:
- Real terminology (e.g., duty doctor name, slot names, team roles)
- Local services (MSK, mental health, community nursing, etc.)
- Role setup (who can book what directly)
- Urgent care model (duty doctor, red slots, escalation pathways)
- Preferred communication detail level and terminology style

CRITICAL SAFETY RULES:
- Maintain clinical safety exactly as written in the base instructions. Do NOT dilute urgency, red flags, or escalation criteria.
- Keep content strictly within admin signposting scope — do NOT create new clinical advice.
- Preserve all clinical meaning, time frames, and safety triggers exactly.

IMPROVEMENT GOALS:
- Improve clarity, structure, readability, and workflow for reception/admin teams.
- Use the surgery's preferred terminology (e.g., their duty doctor term, slot names).
- Follow the surgery's preferred communication detail level (brief/moderate/detailed).
- Follow the surgery's terminology preference (surgery-specific vs generic vs mixed).

ICON USAGE:
You are encouraged to add icons when they:
- Reinforce meaning
- Improve scanning
- Highlight warnings, actions, or categories
- Match existing ImageIcon phrase rules

Automatically insert phrases that trigger icons when appropriate (but not excessively):
- "urgent", "warning", "important", "checklist", "action steps", "red flags" → may trigger warning icons
- "bee", "pawprint", "arrow" → may trigger specific icon types
- Use natural language that matches existing ImageIcon phrase patterns

Preserve the original meaning while improving clarity.

OUTPUT FORMAT:
Return ONLY valid JSON with these exact fields:
{
  "briefInstruction": "string - improved brief routing label",
  "instructionsHtml": "string - rewritten full instruction in clean HTML suitable for TipTap/sanitisation"
}

Use simple HTML tags: <p>, <ul>, <li>, <strong>, <em>, <br />. Ensure HTML is clean and suitable for sanitisation.`

  // Build user prompt with symptom and profile data
  const userPrompt = `SYMPTOM TO CUSTOMISE:
Name: ${baseSymptom.name}
Age Group: ${baseSymptom.ageGroup}
Brief Instruction: ${baseSymptom.briefInstruction || '(none)'}
Full Instructions: ${baseSymptom.instructionsHtml || '(none)'}

SURGERY ONBOARDING PROFILE:
${JSON.stringify(onboardingProfile, null, 2)}

TASK:
Rewrite the symptom instructions to match this surgery's:
1. Terminology (use their duty doctor term, slot names, team roles)
2. Local services (reference their specific services where relevant)
3. Booking rules (reflect who can book directly)
4. Escalation pathways (use their first escalation point and urgent wording)
5. Communication style (match their detail level and terminology preference)

IMPORTANT:
- Maintain all clinical safety exactly as written.
- Use icons/phrases that match ImageIcon rules when helpful.
- Produce clean HTML suitable for TipTap/sanitisation.
- Keep briefInstruction concise and routing-focused.

Return ONLY the JSON object with briefInstruction and instructionsHtml fields.`

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
      temperature: 0.3,
      max_tokens: 2000,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error('Azure OpenAI API error:', response.status, errorText)
    throw new Error(`AI service error: ${response.status}`)
  }

  const data = await response.json()
  const rawContent = data.choices?.[0]?.message?.content || ''

  let briefInstruction = ''
  let instructionsHtml = ''

  try {
    const parsed = JSON.parse(rawContent)
    briefInstruction = parsed.briefInstruction || baseSymptom.briefInstruction || ''
    instructionsHtml = parsed.instructionsHtml || ''
  } catch (err) {
    console.error('Failed to parse AI response as JSON:', err)
    throw new Error('Invalid AI response format')
  }

  if (!instructionsHtml) {
    throw new Error('AI response missing instructionsHtml')
  }

  const modelUsed = data.model || deployment

  // Log token usage (non-blocking)
  try {
    const promptTokens = data.usage?.prompt_tokens ?? 0
    const completionTokens = data.usage?.completion_tokens ?? 0
    const totalTokens = data.usage?.total_tokens ?? (promptTokens + completionTokens)

    const inputRate = parseFloat(process.env.AZURE_OPENAI_COST_INPUT_PER_1K_USD || '0')
    const outputRate = parseFloat(process.env.AZURE_OPENAI_COST_OUTPUT_PER_1K_USD || '0')

    const estimatedCostUsd =
      ((promptTokens * inputRate) + (completionTokens * outputRate)) / 1000

    await prisma.tokenUsageLog.create({
      data: {
        userEmail,
        route: 'customiseInstructions',
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

  return {
    briefInstruction,
    instructionsHtml,
    modelUsed,
  }
}

