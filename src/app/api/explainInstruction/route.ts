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

    const userPrompt = `You will be given internal GP signposting guidance used by reception/admin staff.

BRIEF INSTRUCTION (routing label):
"""${briefInstruction || '(none)'}"""

FULL INSTRUCTION (staff guidance):
"""${currentText}"""

Explain the reasoning behind this rule and what staff should understand about it.

Please output HTML with the following sections:

<h3>Why this rule exists</h3>
<p>Short summary of the underlying clinical or workflow reasoning.</p>

<h3>What to focus on</h3>
<ul>
  <li>3–5 key bullet points for reception/admin staff — what to ask or check</li>
</ul>

<h3>Common pitfalls</h3>
<ul>
  <li>Typical misunderstandings or errors to avoid</li>
</ul>

<h3>Quick recap</h3>
<p>2–3 sentences reinforcing safe, confident signposting behaviour.</p>

Style: plain English, reading age 10–12, supportive, non-judgemental.
Do not add or remove any clinical criteria — just explain context.
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
    
    const explanationHtml = data.choices?.[0]?.message?.content || ''
    
    if (!explanationHtml) {
      console.error('AI response missing explanation:', data)
      return NextResponse.json({ error: 'Invalid AI response' }, { status: 500 })
    }

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

