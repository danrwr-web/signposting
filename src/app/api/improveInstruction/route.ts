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

BRIEF INSTRUCTION (what the receptionist should usually say first to the caller):
"""${briefInstruction || '(none provided)'}"""

FULL INSTRUCTION (internal guidance / escalation steps for reception staff):
"""${currentText || '(none provided)'}"""

TASK:
1. Rewrite BOTH sections to improve clarity, flow, and readability for a non-clinical GP receptionist, without changing any clinical meaning, urgency wording, or escalation pathway.
2. Keep all safety-critical triggers and emergency wording EXACTLY as given, unless you are only fixing obvious grammar.
3. Preserve shorthand like "pink/purple" instead of changing it to "pink or purple".
4. The full instruction must be returned as HTML using basic tags (<p>, <ul>, <li>, <strong>, etc.). Use paragraphs and bullet lists where helpful.

OUTPUT FORMAT:
Return ONLY valid JSON, with this exact structure:
{
  "briefInstruction": "string - the rewritten briefInstruction text, plain sentence form suitable to say to a caller",
  "fullInstructionHtml": "string - the rewritten full instruction in HTML"
}
Do not include any other keys, explanations, or markdown. Return raw JSON only.
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

