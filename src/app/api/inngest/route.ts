import { serve } from 'inngest/next'
import { inngest } from '@/inngest/client'
import { bulkGenerationOrchestrator, bulkGenerationChild } from '@/inngest/functions/bulk-generation'

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [bulkGenerationOrchestrator, bulkGenerationChild],
})
