import 'server-only'

/**
 * Shared Azure OpenAI helper.
 *
 * Centralises configuration validation, the HTTP call, and error
 * classification so that every AI route returns actionable diagnostics
 * instead of a generic "AI service error".
 */

// ---------------------------------------------------------------------------
// Error class
// ---------------------------------------------------------------------------

export class AzureOpenAIError extends Error {
  constructor(
    /** HTTP status returned by Azure (0 for network / config errors) */
    public readonly status: number,
    /** Safe-to-display message for the client */
    public readonly clientMessage: string,
    serverDetails: string,
  ) {
    super(serverDetails)
    this.name = 'AzureOpenAIError'
  }
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export interface AzureOpenAIConfig {
  apiUrl: string
  apiKey: string
  deployment: string
}

export function getAzureOpenAIConfig(): AzureOpenAIConfig {
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT
  const apiKey = process.env.AZURE_OPENAI_API_KEY
  const deployment = process.env.AZURE_OPENAI_DEPLOYMENT
  const apiVersion = process.env.AZURE_OPENAI_API_VERSION

  if (!endpoint || !apiKey || !deployment || !apiVersion) {
    const missing = [
      !endpoint && 'AZURE_OPENAI_ENDPOINT',
      !apiKey && 'AZURE_OPENAI_API_KEY',
      !deployment && 'AZURE_OPENAI_DEPLOYMENT',
      !apiVersion && 'AZURE_OPENAI_API_VERSION',
    ].filter(Boolean).join(', ')

    throw new AzureOpenAIError(
      0,
      'AI service is not configured. Please contact your administrator.',
      `Missing Azure OpenAI environment variables: ${missing}`,
    )
  }

  const apiUrl = `${endpoint}openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`
  return { apiUrl, apiKey, deployment }
}

// ---------------------------------------------------------------------------
// API call
// ---------------------------------------------------------------------------

export interface AzureOpenAIMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface AzureOpenAIOptions {
  messages: AzureOpenAIMessage[]
  temperature?: number
  max_tokens?: number
}

/** Successful parsed response from Azure OpenAI */
export interface AzureOpenAIResponse {
  content: string
  model: string
  usage: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

/**
 * Call Azure OpenAI chat completions and return the parsed response.
 *
 * Throws `AzureOpenAIError` with an actionable `clientMessage` on failure.
 */
export async function callAzureOpenAI(
  options: AzureOpenAIOptions,
): Promise<AzureOpenAIResponse> {
  const { apiUrl, apiKey, deployment } = getAzureOpenAIConfig()

  let response: Response
  try {
    response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': apiKey,
      },
      body: JSON.stringify({
        messages: options.messages,
        // Reasoning models (o1, o3-mini, etc.) only support temperature=1 and
        // use max_completion_tokens. Detect by deployment name convention or
        // allow callers to omit temperature to use the model default.
        ...(options.temperature != null ? { temperature: options.temperature } : {}),
        // Reasoning models (o1/o3-mini) use max_completion_tokens for BOTH
        // internal chain-of-thought AND visible output, so we need a generous
        // default to avoid truncated responses.
        max_completion_tokens: options.max_tokens ?? 4096,
      }),
    })
  } catch (err) {
    console.error('Azure OpenAI network error:', err)
    throw new AzureOpenAIError(
      0,
      'Unable to reach the AI service. Please check your network connection and try again.',
      `Network error calling Azure OpenAI: ${err instanceof Error ? err.message : String(err)}`,
    )
  }

  if (!response.ok) {
    const errorText = await response.text().catch(() => '(unable to read error body)')
    console.error('Azure OpenAI API error:', {
      status: response.status,
      deployment,
      apiUrl: apiUrl.replace(/api-key=[^&]+/, 'api-key=***'),
      errorText,
    })
    throw new AzureOpenAIError(
      response.status,
      classifyAzureError(response.status, deployment, errorText),
      `Azure OpenAI returned ${response.status}: ${errorText}`,
    )
  }

  const data = await response.json()
  const content = stripReasoningPrefix(data.choices?.[0]?.message?.content || '')
  const model = data.model || deployment

  return {
    content,
    model,
    usage: {
      prompt_tokens: data.usage?.prompt_tokens ?? 0,
      completion_tokens: data.usage?.completion_tokens ?? 0,
      total_tokens: data.usage?.total_tokens ?? 0,
    },
  }
}

// ---------------------------------------------------------------------------
// Reasoning-model helpers
// ---------------------------------------------------------------------------

/**
 * Strip `<think>…</think>` blocks that reasoning models (o1/o3-mini) may
 * prepend to their visible output.
 */
function stripReasoningPrefix(raw: string): string {
  const trimmed = raw.trim()
  const thinkOpen = trimmed.indexOf('<think>')
  if (thinkOpen === -1) return trimmed

  const thinkClose = trimmed.indexOf('</think>')
  if (thinkClose !== -1) {
    return trimmed.slice(thinkClose + '</think>'.length).trim()
  }

  // Truncated thinking block — try to find start of actual payload
  const jsonStart = trimmed.indexOf('{', thinkOpen + 7)
  if (jsonStart !== -1) return trimmed.slice(jsonStart).trim()

  const htmlStart = trimmed.indexOf('<h', thinkOpen + 7)
  if (htmlStart !== -1) return trimmed.slice(htmlStart).trim()

  return trimmed
}

/**
 * Try to parse a JSON object from a string that may contain surrounding text
 * (e.g. markdown fences, reasoning prefixes, or trailing commentary).
 *
 * Returns the parsed object or `null` if extraction fails.
 */
export function extractJson(raw: string): Record<string, unknown> | null {
  // Clean markdown fences
  let cleaned = raw.trim()
  cleaned = cleaned.replace(/^```json\s*/i, '')
  cleaned = cleaned.replace(/^```\s*/i, '')
  cleaned = cleaned.replace(/\s*```\s*$/, '')
  cleaned = cleaned.trim()

  // Try direct parse first
  try {
    return JSON.parse(cleaned) as Record<string, unknown>
  } catch {
    // Fall through to brace extraction
  }

  // Extract substring between first { and last }
  const firstBrace = cleaned.indexOf('{')
  const lastBrace = cleaned.lastIndexOf('}')
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    try {
      const result = JSON.parse(cleaned.slice(firstBrace, lastBrace + 1)) as Record<string, unknown>
      console.warn('extractJson: recovered JSON via brace extraction')
      return result
    } catch {
      // Fall through
    }
  }

  return null
}

// ---------------------------------------------------------------------------
// Error classification
// ---------------------------------------------------------------------------

function classifyAzureError(status: number, deployment: string, errorText: string): string {
  const apiVersion = process.env.AZURE_OPENAI_API_VERSION || '(not set)'

  switch (status) {
    case 400: {
      // 400 Bad Request — most commonly caused by a retired API version or
      // an unsupported parameter for the deployed model.
      if (errorText.includes('api-version') || errorText.includes('ApiVersionNotSupported') || errorText.includes('retired')) {
        return `AI service rejected the request: API version "${apiVersion}" is not supported or has been retired. Please update AZURE_OPENAI_API_VERSION to a current GA version (e.g. "2024-10-21").`
      }
      if (errorText.includes('unsupported_parameter') || errorText.includes('Unsupported parameter')) {
        const snippet = errorText.length > 300 ? errorText.slice(0, 300) + '…' : errorText
        return `AI service rejected the request due to an unsupported parameter. This may require a code update. Details: ${snippet}`
      }
      if (errorText.includes('content_filter') || errorText.includes('ContentFilter')) {
        return 'AI service blocked the request due to content filtering. Please try rephrasing the input.'
      }
      if (errorText.includes('context_length') || errorText.includes('context_length_exceeded')) {
        return 'AI service rejected the request: the input is too long for the deployed model. Please try with shorter content.'
      }
      // Generic 400 — surface enough detail to help debug
      const snippet = errorText.length > 200 ? errorText.slice(0, 200) + '…' : errorText
      return `AI service rejected the request (400 Bad Request). This is often caused by a retired API version. Current API version: "${apiVersion}". Azure response: ${snippet}`
    }
    case 401:
      return 'AI service authentication failed. The API key may be invalid or expired. Please contact your administrator.'
    case 403:
      return 'AI service access denied. The API key may lack the required permissions. Please contact your administrator.'
    case 404: {
      // Distinguish between "deployment not found" and "endpoint not found"
      if (errorText.includes('DeploymentNotFound') || errorText.includes('deployment')) {
        return `AI deployment "${deployment}" was not found. Please check your AZURE_OPENAI_DEPLOYMENT setting.`
      }
      if (errorText.includes('Resource not found') || errorText.includes('invalid_request_error')) {
        return 'AI service endpoint not found. The API version may be retired or the endpoint URL may be incorrect. Please check your AZURE_OPENAI_ENDPOINT and AZURE_OPENAI_API_VERSION settings.'
      }
      return `AI service returned 404 Not Found. Please check your Azure OpenAI configuration (endpoint, deployment, and API version).`
    }
    case 429:
      return 'AI service is temporarily busy (rate limit reached). Please wait a moment and try again.'
    case 408:
    case 504:
      return 'AI service request timed out. Please try again.'
    default:
      if (status >= 500) {
        return `AI service is temporarily unavailable (Azure returned ${status}). Please try again later.`
      }
      return `AI service request failed (status ${status}). Please contact your administrator.`
  }
}
