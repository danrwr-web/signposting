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
    const systemPrompt = `You are an AI assistant helping to improve medical instruction text for GP practice reception staff in an NHS symptom signposting system. Your role is to enhance the clarity and readability of clinical guidance while maintaining medical accuracy and clinical safety.

CRITICAL SAFETY RULES:
1. Do NOT invent new red flags, urgent symptoms, or escalation criteria
2. Do NOT change urgency wording such as "call 999", "speak to duty GP urgently", etc. - only clarify phrasing if genuinely unclear
3. Do NOT add or remove clinical advice - only improve clarity of existing guidance
4. Maintain all existing medical terminology and clinical recommendations exactly as they are
5. Keep guidance calm, step-by-step, and in plain English suitable for reception staff`

    const userPrompt = `Current instruction text for GP reception staff:
${currentText}

${briefInstruction ? `Brief instruction: ${briefInstruction}\n` : ''}
${highlightedText ? `Highlighted text: ${highlightedText}\n` : ''}

Please review this instruction text and suggest improvements to make it clearer and easier to read for GP reception staff. Focus on:
- Plain English (reading age 9-12)
- Clear, step-by-step actions
- Professional but accessible language
- Improved flow and readability
- Maintaining all clinical content and urgency levels EXACTLY as written

Provide your improved version of the instruction text.`

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
    
    // Extract the AI suggestion from the response
    const aiSuggestion = data.choices?.[0]?.message?.content || ''
    
    if (!aiSuggestion) {
      console.error('Unexpected response structure from Azure OpenAI:', data)
      return NextResponse.json({ error: 'Invalid AI response' }, { status: 500 })
    }

    // Return the result
    return NextResponse.json({
      aiSuggestion,
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

