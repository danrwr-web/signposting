import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/rbac'
import { z } from 'zod'

export const runtime = 'nodejs'

const explainInstructionSchema = z.object({
  symptomId: z.string(),
  briefInstruction: z.string().optional(),
  currentText: z.string(),
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
    const { symptomId, briefInstruction, currentText } = explainInstructionSchema.parse(body)

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
    const systemPrompt = `You are a GP practice educator helping to train non-clinical reception and admin staff.

You explain medical signposting rules in clear, reassuring language suitable for NHS staff training.

Keep tone factual, supportive, and consistent with NHS style.
`

    const userPrompt = `
You will be given internal GP signposting guidance used by reception/admin staff in UK primary care.

BRIEF INSTRUCTION (routing label used by staff, not spoken to the patient):
"""${briefInstruction || '(none)'}"""

FULL INSTRUCTION (internal guidance for staff, not read out word-for-word to the patient):
"""${currentText}"""

Your job is to create a short training explanation that helps a NEW, NON-CLINICAL GP RECEPTIONIST understand:
- why this rule exists
- what they should pay attention to
- what can go wrong
- how to act safely and confidently.

IMPORTANT SAFETY AND STYLE RULES:
- You MAY refer to other named screens, tabs, or pages if they are explicitly mentioned in the provided instruction text (for example, if the instruction mentions a 'chest pain' tab or 'sepsis screen', you can mention it).
- Do NOT invent new UI elements, buttons, tabs, or processes that were not mentioned.
- Do NOT invent new red-flag criteria, escalation routes, or time frames.
- Do NOT soften or change escalation wording (e.g. 'call 999', 'same day GP', 'urgent').
- Keep this focused on what the receptionist needs to understand in practical terms.
- Use plain English, calm supportive tone, reading age ~11–12.
- Assume the staff member is not clinically trained.

OUTPUT FORMAT:
You MUST return VALID HTML with the following sections, in this order:

<h3>Why this rule exists</h3>
<p>Short summary of the underlying clinical or workflow reasoning if known. Explain the purpose of the rule in simple terms.</p>

<h3>What to focus on</h3>
<ul>
  <li>3–5 key bullet points explaining what the receptionist should ask or check, and what they should do next.</li>
</ul>

<h3>Common pitfalls</h3>
<ul>
  <li>Typical misunderstandings, mistakes, or risks to avoid.</li>
</ul>

<h3>Quick recap</h3>
<p>2–3 sentences reinforcing safe, confident signposting behaviour for this scenario.</p>

REQUIRED:
- Do NOT wrap your answer in Markdown code fences.
- Do NOT include \`\`\`html or any other \`\`\` fences.
- Return RAW HTML ONLY, starting directly with <h3>...</h3>.
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
        max_tokens: 900,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Azure OpenAI API error:', response.status, errorText)
      return NextResponse.json({ error: 'AI service error' }, { status: 500 })
    }

    const data = await response.json()
    
    let explanationHtml = data.choices?.[0]?.message?.content || ''
    
    if (!explanationHtml) {
      console.error('AI response missing explanation:', data)
      return NextResponse.json({ error: 'Invalid AI response' }, { status: 500 })
    }

    // Strip markdown code fences if the model wraps the output despite instructions
    explanationHtml = explanationHtml.trim()
    // Remove ```html or ``` at the start
    explanationHtml = explanationHtml.replace(/^```html?\s*/i, '')
    // Remove ``` at the end
    explanationHtml = explanationHtml.replace(/\s*```\s*$/, '')
    explanationHtml = explanationHtml.trim()

    const model = data.model || deployment
    const timestamp = new Date().toISOString()

    // Log audit information
    console.info('AI explanation generated:', { symptomId, model, timestamp })

    // Return the result
    return NextResponse.json({
      explanationHtml,
      model,
      timestamp,
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
    
    console.error('Error in explainInstruction:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

