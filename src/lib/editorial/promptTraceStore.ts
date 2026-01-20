/**
 * In-memory prompt trace store for Editorial AI debugging (dev/preview only)
 * Traces are stored for 10 minutes and automatically cleaned up.
 */

import 'server-only'

export interface PromptTrace {
  traceId: string
  createdAt: string // ISO string
  userId?: string
  surgeryId?: string
  targetRole?: string
  promptText?: string
  toolkitInjected: boolean
  matchedSymptoms: string[]
  toolkitContextLength: number
  promptSystem: string
  promptUser: string
  modelRawText?: string // raw model response text (or JSON string)
  modelRawJson?: unknown // parsed JSON before normalisation
  modelNormalisedJson?: unknown
  validationErrors?: unknown
  sources?: unknown
  safetyValidationPassed?: boolean
  safetyValidationErrors?: Array<{ code: string; message: string; cardTitle?: string }>
}

const TRACE_TTL_MS = 10 * 60 * 1000 // 10 minutes

class PromptTraceStore {
  private store: Map<string, { trace: PromptTrace; expiresAt: number }> = new Map()
  private cleanupInterval: NodeJS.Timeout | null = null

  constructor() {
    // Clean up expired traces every minute
    this.cleanupInterval = setInterval(() => {
      this.cleanup()
    }, 60 * 1000)
  }

  set(trace: PromptTrace): void {
    const expiresAt = Date.now() + TRACE_TTL_MS
    this.store.set(trace.traceId, { trace, expiresAt })
  }

  get(traceId: string): PromptTrace | null {
    const entry = this.store.get(traceId)
    if (!entry) {
      return null
    }
    if (Date.now() > entry.expiresAt) {
      this.store.delete(traceId)
      return null
    }
    return entry.trace
  }

  update(traceId: string, updates: Partial<PromptTrace>): void {
    const entry = this.store.get(traceId)
    if (!entry) {
      return
    }
    if (Date.now() > entry.expiresAt) {
      this.store.delete(traceId)
      return
    }
    entry.trace = { ...entry.trace, ...updates }
  }

  private cleanup(): void {
    const now = Date.now()
    for (const [traceId, entry] of this.store.entries()) {
      if (now > entry.expiresAt) {
        this.store.delete(traceId)
      }
    }
  }

  // For testing/cleanup purposes
  clear(): void {
    this.store.clear()
  }
}

// Singleton instance (shared across serverless functions in same process)
export const promptTraceStore = new PromptTraceStore()
