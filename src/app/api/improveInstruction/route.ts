import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/rbac'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { isFeatureEnabledForUser } from '@/lib/features'

export const runtime = 'nodejs'

const improveInstructionSchema = z.object({
  symptomId: z.string(),
  currentText: z.string().optional(),
  briefInstruction: z.string().optional(),
  highlightedText: z.string().optional(),
})

export async function POST(request: NextRequest) {
  try {
    // Check authentication and feature flag
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user has access to ai_instructions feature
    const canUse = await isFeatureEnabledForUser(user.id, 'ai_instructions')
    if (!canUse) {
      return NextResponse.json({ error: 'Feature not enabled for this user' }, { status: 403 })
    }

    // Parse and validate request body
    const body = await request.json()
    const { symptomId, currentText, briefInstruction, highlightedText } = improveInstructionSchema.parse(body)

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
    // Allow limited icons (emoji) to improve scan-ability for reception staff.
    // Icons must be from the approved list and must not change clinical meaning.
    //
    // Example expected output style with icons:
    // - Input: "Book a Red Slot if patient has severe chest pain"
    // - Output: "❗ Book a Red Slot if patient has severe chest pain"
    // - Input: "Send to pharmacy for minor insect bites"
    // - Output: "🐝 Send to pharmacy for minor insect bites / stings"
    // - Input: "For children under 5, book face-to-face appointment"
    // - Output: "🧒 For children under 5, book face-to-face appointment"
    const systemPrompt = `
You are improving signposting guidance used by GP reception and admin staff in UK primary care.

STYLE AND TONE:
- Write in the clear, directive tone of internal NHS guidance: concise, instructional, neutral.
- Address staff, not patients. For example: "Send patients to pharmacy", "Book a telephone consultation", "Offer a female GP if requested." Do NOT rewrite it as patient-facing text like "Please visit your local pharmacy".
- Keep sentences short and readable for non-clinical staff.
- You may reorganise or clarify wording to make it easier to follow, but do not make it more wordy.
- You may improve readability and structure (e.g. short paragraphs, bullet points) if this helps a receptionist follow the steps.

VISUAL ENHANCEMENT (ICONS):
- Where helpful, you may add small emoji icons at the start of lines or sections to act as visual anchors and improve scan-ability.
- ONLY use icons from this approved list:
  - ❗ for important warnings or high-risk "Red Slot" rules.
  - ➜ for clear action steps (e.g. "Book a Pink/Purple Slot", "Advise the patient to…").
  - 💊 for Pharmacy / Pharmacy First related instructions.
  - 🧒 for child-specific rules (e.g. under 5s).
  - ℹ️ for neutral information / general advice.
  - 📞 for telephone consultations or phone contact instructions.
  - 🐾 for animal bites/scratches.
  - 🐝 for insect bites/stings.
- Use icons sparingly and consistently. Not every line needs an icon.
- Do NOT introduce new icons outside this list.
- Icons are optional - if you omit them, the output should still be valid and usable.

SAFETY / CLINICAL RULES:
- Do NOT change the clinical meaning, escalation pathway, or urgency wording.
- Do NOT soften or alter phrases like "urgent", "same day", "999", "duty GP", "emergency".
- Do NOT invent new red flag criteria, new options, or new escalation routes.
- Preserve any shorthand and descriptors that carry meaning, including colour or symptom shorthand such as "pink/purple", "red/swollen", etc. Do NOT expand these to longer wording unless there is an obvious spelling/grammar error.
- Preserve existing colour-slot language (Red Slot, Pink/Purple Slot, Green Slot, Orange Slot).

OUTPUT FORMAT:
- For the full instruction, return valid HTML using simple tags (<p>, <ul>, <li>, <strong>, <em>, <br />).
- Emojis should be included directly in the HTML text content (they are valid Unicode characters in HTML).
- Do not include commentary about what you changed.
`

    const userPrompt = `
You will be given the current triage / signposting guidance used by GP practice admin and reception staff.

BRIEF INSTRUCTION:
"""${briefInstruction || '(none provided)'}"""

FULL INSTRUCTION:
"""${currentText || '(none provided)'}"""

TASK:
1. Improve BOTH sections for clarity and consistency for non-clinical GP reception/admin staff.

2. The "briefInstruction" you return MUST stay as a short routing label, not a full sentence. Rules for briefInstruction:
   - Keep it concise and in the same style as the original (e.g. "Community Pharmacy / Face to Face Consultation").
   - You MUST keep all escalation destinations or options that appear in the original. Do NOT drop or merge pathways. For example, if the original includes "Community Pharmacy / Face to Face Consultation", you must still include both pharmacy and face to face.
   - Do NOT turn it into patient-facing speech like "Please visit your pharmacy".
   - Do NOT rewrite it as a long explanatory sentence. It should read like a category or disposition, not a script.

3. The "fullInstructionHtml" you return should:
   - Be written in a clear, directive, staff-facing voice (e.g. "Send patients to...", "Book a telephone consultation...").
   - Use plain English and short sentences so that a non-clinical receptionist can follow it.
   - Preserve clinical meaning, safety triggers, escalation criteria, time frames, and urgency wording exactly.
   - Preserve shorthand like "pink/purple" exactly.
   - Use valid HTML (<p>, <ul>, <li>, <strong>, etc.). Use paragraphs and bullet lists where it helps.
   - Where helpful, add icons from the approved list to highlight warnings, key actions, pharmacy use, or child-specific rules. Use icons sparingly and consistently.

4. Do NOT invent any new red flag criteria, new actions, or new escalation routes. Only clarify what is already there.

OUTPUT FORMAT:
Return ONLY valid JSON, with this exact structure:
{
  "briefInstruction": "string - the improved brief routing label, still concise and still including all original routing destinations/options",
  "fullInstructionHtml": "string - the rewritten full instruction in HTML for staff use"
}

Do not include any other keys, explanations, markdown code fences, or commentary. Return raw JSON only.
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
        temperature: 0.3,
        max_tokens: 1200,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Azure OpenAI API error:', response.status, errorText)
      return NextResponse.json({ error: 'AI service error' }, { status: 500 })
    }

    const data = await response.json()
    
    const rawContent = data.choices?.[0]?.message?.content || ''
    
    let aiBrief = ''
    let aiFullHtml = ''
    
    try {
      const parsed = JSON.parse(rawContent)
      aiBrief = parsed.briefInstruction || ''
      aiFullHtml = parsed.fullInstructionHtml || ''
    } catch (err) {
      // fallback if the model didn't return JSON for some reason
      aiFullHtml = rawContent
    }
    
    if (!aiFullHtml) {
      console.error('AI response missing fullInstructionHtml:', rawContent)
      return NextResponse.json({ error: 'Invalid AI response' }, { status: 500 })
    }
    
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

      const modelUsed = data.model || deployment

      await prisma.tokenUsageLog.create({
        data: {
          userEmail: user.email,
          route: 'improveInstruction',
          modelUsed,
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
      aiSuggestion: aiFullHtml,
      aiBrief,
      model: data.model || deployment,
      timestamp: new Date().toISOString(),
      symptomId,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('Validation error:', error.issues)
      return NextResponse.json({ 
        error: 'Invalid input', 
        details: error.issues
      }, { status: 400 })
    }
    
    console.error('Error in improveInstruction:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

