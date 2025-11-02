import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/rbac'
import { z } from 'zod'

export const runtime = 'nodejs'

const improveInstructionSchema = z.object({
  symptomId: z.string(),
  currentText: z.string().optional(),
  briefInstruction: z.string().optional(),
  highlightedText: z.string().optional(),
})

export async function POST(request: NextRequest) {
  try {
    // Check authentication and superuser role
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (user.globalRole !== 'SUPERUSER') {
      return NextResponse.json({ error: 'Superuser access required' }, { status: 403 })
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
    const systemPrompt = `
You are improving signposting guidance used by GP reception and admin staff in UK primary care.

STYLE AND TONE:
- Write in the clear, directive tone of NHS internal guidance — concise, instructional, and neutral.
- Address staff, not patients (e.g. "Send patients to pharmacy", not "Please visit your local pharmacy").
- Use plain English and short sentences, but keep professional phrasing.
- You may improve flow and readability, but do not make it wordier or more conversational.
- Preserve shorthand and colour descriptors (e.g. "pink/purple") exactly as written.
- Use bullet points or short paragraphs for clarity.
- Maintain all safety wording, urgency instructions, and escalation rules exactly as given.
- Output valid HTML (paragraphs, lists, bold, italics).
`


const userPrompt = `
You will be given the current triage / signposting guidance for GP practice admin staff.

BRIEF INSTRUCTION (this is a short routing label used by staff, not wording said to the patient):
"""${briefInstruction || '(none provided)'}"""

FULL INSTRUCTION (internal guidance / escalation steps for reception staff):
"""${currentText || '(none provided)'}"""

TASK:
1. Improve BOTH sections for clarity and consistency for non-clinical GP reception/admin staff.
2. VERY IMPORTANT: The "briefInstruction" you return must stay as a short routing label, similar in style/length to the original. It can be adjusted for clarity, but it must:
   - Remain concise (ideally a phrase, not a sentence).
   - Keep all original pathways/options and escalation endpoints (e.g. if the original said "Community Pharmacy / Face to Face Consultation", do not drop "Face to Face Consultation").
   - NOT become patient-facing language like "Please visit...".
   - NOT become a full sentence or instruction.
3. The "fullInstructionHtml" you return should:
   - Use clear, directive staff-facing language ("Send patients to...", "Book a...").
   - Keep escalation and urgency wording exactly the same (do not soften "urgent", "same day", "999", etc.).
   - Preserve shorthand like "pink/purple" exactly.
   - Be output as HTML using simple tags (<p>, <ul>, <li>, <strong>, etc.).
   - Be broken into short paragraphs or bullet points for readability.
4. Do not invent any new red flag criteria or escalation routes.

OUTPUT FORMAT:
Return ONLY valid JSON, with this exact structure:
{
  "briefInstruction": "string - the improved brief routing label, still concise and still including all original routing destinations/options",
  "fullInstructionHtml": "string - the rewritten full instruction in HTML for staff use"
}
Do not include any other keys, explanations, or markdown. Return raw JSON only.
`
;


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

