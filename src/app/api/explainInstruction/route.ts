import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/rbac'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { isFeatureEnabledForUser } from '@/lib/features'
import { callAzureOpenAI, AzureOpenAIError } from '@/server/azureOpenAI'

export const runtime = 'nodejs'

const explainInstructionSchema = z.object({
  symptomId: z.string(),
  briefInstruction: z.string().optional(),
  currentText: z.string(),
})

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
    const { symptomId, briefInstruction, currentText } = explainInstructionSchema.parse(body)

    // Truncate input to prevent exceeding model context window
    const MAX_INPUT_CHARS = 8000
    let safeCurrentText = currentText
    if (safeCurrentText.length > MAX_INPUT_CHARS) {
      console.warn(`explainInstruction: truncating currentText from ${safeCurrentText.length} to ${MAX_INPUT_CHARS} chars`)
      safeCurrentText = safeCurrentText.slice(0, MAX_INPUT_CHARS) + '\n... [truncated — original text was too long to process in full]'
    }

    // Azure OpenAI configuration is read by the shared helper

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
"""${safeCurrentText}"""

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

    // Call Azure OpenAI API via shared helper
    const aiResponse = await callAzureOpenAI({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: 900,
    })

    let explanationHtml = aiResponse.content
    
    if (!explanationHtml) {
      console.error('AI response missing explanation')
      return NextResponse.json({ error: 'Invalid AI response' }, { status: 500 })
    }

    // Strip markdown code fences if the model wraps the output despite instructions
    explanationHtml = explanationHtml.trim()
    // Remove ```html or ``` at the start
    explanationHtml = explanationHtml.replace(/^```html?\s*/i, '')
    // Remove ``` at the end
    explanationHtml = explanationHtml.replace(/\s*```\s*$/, '')
    explanationHtml = explanationHtml.trim()

    const model = aiResponse.model
    const timestamp = new Date().toISOString()

    // Log audit information
    console.info('AI explanation generated:', { symptomId, model, timestamp })

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
          route: 'explainInstruction',
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
      explanationHtml,
      model,
      timestamp,
      symptomId,
    })
  } catch (error) {
    if (error instanceof AzureOpenAIError) {
      return NextResponse.json({ error: error.clientMessage }, { status: 500 })
    }
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

