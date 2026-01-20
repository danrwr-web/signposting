# Audit Report: Daily Dose Editorial AI Not Using Signposting Toolkit Advice

**Date:** 2025-01-XX  
**Branch:** `cursor/daily-dose-editorial-use-signposting-advice`  
**Status:** Audit Complete, Fix Plan Proposed

---

## Executive Summary

The Daily Dose Editorial AI generator has partial toolkit context support for ADMIN role cards, but it does not access the actual Signposting Toolkit database (symptom instructions, workflows, appointment types). The current implementation uses static markdown files based on keyword matching, and the `surgeryId` context is available in the API route but never passed to the AI generation function. This prevents the AI from incorporating practice-specific, approved signposting guidance verbatim.

---

## Step 1: Entry Points Identified

### Route Paths + Files
- **Editorial Page Route:** `/editorial` 
  - Server Component: `src/app/editorial/page.tsx`
  - Client Component: `src/app/editorial/EditorialGeneratorClient.tsx`
  - Layout: `src/app/editorial/layout.tsx`

### Primary React Components
- `EditorialGeneratorClient.tsx` (lines 1-200)
  - Collects: `promptText`, `targetRole`, `count`, `tags`, `interactiveFirst`
  - **Missing:** No UI field to select symptoms/workflows to include

### Server Action/API Handler
- **API Route:** `src/app/api/editorial/generate/route.ts` (POST handler, lines 20-197)
  - Validates request via `EditorialGenerateRequestZ`
  - Resolves `surgeryId` from user context (line 34)
  - Calls `generateEditorialBatch()` at line 81
  - **Issue:** `surgeryId` is available but NOT passed to `generateEditorialBatch()`

### AI Provider & Prompt Builder
- **Core AI Module:** `src/server/editorialAi.ts` (664 lines)
  - Exports: `generateEditorialBatch()`, `generateEditorialVariations()`, `regenerateEditorialSection()`
  - Azure OpenAI wrapper: `callAzureOpenAi()` (lines 600-641)
  - Prompt builders: `buildSystemPrompt()`, `buildUserPrompt()` (lines 203-272)
  - **Current toolkit integration:** `resolveAdminToolkitContext()` (lines 319-335)

### Schema Validators/Repair Loop
- **Parsing/Validation:** `src/lib/editorial/generationParsing.ts` (referenced but not examined in detail)
- **Admin Validation:** `src/lib/editorial/adminValidator.ts` (referenced, validates scope safety)
- **Repair loop:** Yes - one retry on schema mismatch (lines 374-419 in `editorialAi.ts`)

---

## Step 2: Current Payload Sent to Model

### Prompt Structure Analysis

#### System Prompt (ADMIN role)
```
Location: `buildSystemPrompt({ role: 'ADMIN' })` (lines 203-213)
```
- ADMIN_CONTENT_RULES (lines 43-60): Defines admin scope, slot language, scenario requirements
- OUTPUT_RULES (lines 21-26): JSON schema compliance
- SHARED_CONTENT_RULES (lines 28-35): Slot language, risk levels, interactions
- ADMIN_SOURCE_RULES (lines 62-67): "sources[0] MUST be 'Signposting Toolkit (internal)'"
- Role profile formatting (lines 185-201)

#### User Prompt Structure
```
Location: `buildUserPrompt()` (lines 242-272)
```
Current structure:
1. **Toolkit Section** (if ADMIN role): `formatToolkitSection()` output (lines 229-240)
   - Currently only includes static markdown content from `content/toolkit/admin-mental-health.md`
   - Or generic `DEFAULT_ADMIN_TOOLKIT_CONTEXT` if no keyword match
2. **Validation Issues Section** (if retry): Admin validation failures
3. **Editorial Brief:** User's prompt text, count, tags, interactive-first flag
4. **Schema:** JSON schema definition

#### Toolkit Context Resolution
```
Function: `resolveAdminToolkitContext()` (lines 319-335)
```
- **Input:** `promptText` and `tags` (combined for keyword matching)
- **Keyword Matching:** Searches for keywords in `ADMIN_TOOLKIT_PACKS` (lines 87-94)
  - Only one pack: `admin-mental-health` (keywords: 'mental health', 'suicide', 'crisis', etc.)
- **Output:** Static markdown content or generic context
- **Source Metadata:** Constructs URL to `https://app.signpostingtool.co.uk/toolkit/{sourceRoute}`

### Model Parameters
```
Location: `callAzureOpenAi()` (lines 617-624)
```
- **Temperature:** `DEFAULT_TEMPERATURE = 0.2` (line 19) - deterministic
- **Messages:** System + User prompts
- **Model:** Deployment name from env var `AZURE_OPENAI_DEPLOYMENT`

### Source Selection
- **UI:** No dropdown or selector for "Signposting Toolkit" sources in `EditorialGeneratorClient.tsx`
- **Backend:** Source is hardcoded for ADMIN role as "Signposting Toolkit (internal)" (see `ADMIN_SOURCE_RULES` line 64)
- **Prompt Impact:** Toolkit context is only added if `targetRole === 'ADMIN'` (line 252)
- **Gap:** No way for user to select which symptoms/workflows to include from the toolkit

---

## Step 3: Available Signposting Toolkit Advice

### Data Model Overview

#### 1. Effective Symptoms (Per-Surgery)
**Location:** `src/server/effectiveSymptoms.ts`

**Functions Available:**
- `getEffectiveSymptoms(surgeryId, includeDisabled?)` - Returns full symptom list with rich content
- `getCachedEffectiveSymptoms(surgeryId, includeDisabled?)` - Cached version
- `getEffectiveSymptomById(id, surgeryId?)` - Single symptom lookup
- `getEffectiveSymptomByName(name, surgeryId?)` - Search by name

**Data Structure:** `EffectiveSymptom` interface (lines 10-25)
```typescript
{
  id: string
  slug: string
  name: string
  ageGroup: 'U5' | 'O5' | 'Adult'
  briefInstruction: string | null        // ← Short routing label
  highlightedText: string | null         // ← Highlighted excerpt
  instructions: string | null            // ← Full instruction (legacy markdown)
  instructionsHtml: string | null        // ← HTML format with colour support
  instructionsJson: string | null        // ← ProseMirror JSON
  linkToPage: string | null
  source: 'base' | 'override' | 'custom'
  baseSymptomId?: string
}
```

**Assembly Logic:**
- Base symptoms merged with surgery-specific overrides (lines 132-161)
- Overrides can override: name, ageGroup, briefInstruction, highlightedText, instructions, linkToPage
- Custom symptoms appended (surgery-specific, not in base library)
- **Result:** Practice-approved wording specific to the surgery

#### 2. Workflow Templates & Instances
**Location:** Prisma schema (referenced, not fully explored)
- `WorkflowTemplate` - Global or surgery-specific workflow definitions
- `WorkflowInstance` - Active workflow instances
- **Not currently used in Editorial AI**

#### 3. Appointment Directory
**Location:** Prisma schema + API routes
- `AppointmentType` - Local appointment types with colour codes, staff types
- `AppointmentStaffType` - Staff type definitions
- **Not currently used in Editorial AI**

#### 4. Highlight Rules & High-Risk Tags
**Location:** Various (referenced in schema)
- `HighlightRule` - Visual highlighting rules for symptom instructions
- `DefaultHighRiskButtonConfig` - High-risk escalation patterns
- **Not currently used in Editorial AI**

### Concrete Advice Payloads Available

**A) Effective Symptom Instructions (Per Surgery)**
```typescript
// Example payload structure:
{
  source: "Signposting Toolkit (Ide Lane Surgery)",
  asOf: "2025-01-XX",
  items: [
    {
      type: "symptom",
      name: "Chest pain",
      ageGroup: "Adult",
      briefInstruction: "Book a Red Slot if severe chest pain",
      effectiveInstructions: "<p>If patient reports severe chest pain...</p>", // HTML
      highlightedText: "severe chest pain, radiating, breathlessness",
      redFlags: ["severe", "radiating", "breathlessness"], // parsed from highlights
      safetyNet: "If unsure, escalate to duty GP immediately"
    }
  ],
  usageRule: "Use this wording verbatim for workflow phrasing; do not invent beyond it."
}
```

**B) Practice Workflow Language**
- Slot colours (Red/Orange/Pink-Purple/Green) from symptom instructions
- Escalation phrases ("duty GP", "same day", "999", "urgent")
- Appointment type names from Appointment Directory
- Staff type assignments

**C) Highlight/Red Flag Phrasing Rules**
- Phrases that trigger highlighting (from HighlightRule)
- High-risk button text (from DefaultHighRiskButtonConfig)
- **Not currently accessible via clean API**

**D) Approved Admin Guidance Blocks**
- Currently only `content/toolkit/admin-mental-health.md` (static file)
- Could be extended to pull from symptom instructions dynamically

---

## Step 4: Comparison Against Daily Dose Spec Contract

**Spec Reference:** `docs/wiki/Daily-Dose.md` (lines 67-82)

### Spec Requirements vs Current Implementation

| Requirement | Spec Statement | Current Status | Gap |
|------------|----------------|----------------|-----|
| **Source selection** | "must always include Signposting Toolkit" | ✅ Hardcoded for ADMIN role | ⚠️ No UI selection; static content only |
| **Preferred language** | "Preferred language source for workflows" | ❌ Not implemented | Missing: actual symptom instructions |
| **Verbatim usage** | "Use practice-specific language verbatim when provided" | ❌ Not implemented | Missing: surgery-specific effective instructions |
| **UK specificity** | "UK sources where possible (NHS, NICE, UKHSA...)" | ✅ Enforced in prompt | OK |
| **Deterministic transformation** | "AI is a deterministic transformation engine" | ✅ Temperature 0.2 | OK |
| **Validation + repair** | "Validation + one repair loop" | ✅ Implemented | OK |
| **Surgery context** | Implicit (practice-approved) | ❌ Missing | `surgeryId` not passed to generator |

### Missing UI Fields
- **Symptom/workflow selector:** No UI to choose which symptoms to include
- **Source dropdown:** No explicit "Signposting Toolkit" toggle (though it's hardcoded for ADMIN)

### Missing Backend Wiring
- **No `surgeryId` parameter** passed to `generateEditorialBatch()` (available in route but unused)
- **No symptom lookup** - cannot fetch effective symptom instructions
- **No keyword-to-symptom mapping** - cannot match user prompt to relevant symptoms
- **Static content only** - toolkit context from markdown files, not database

---

## Step 5: Root Cause Diagnosis

### Primary Root Cause

**`surgeryId` is not passed to the AI generation function.**

**Evidence:**
1. `src/app/api/editorial/generate/route.ts` line 34: `surgeryId` is resolved and stored
2. Line 81: `generateEditorialBatch()` is called **without `surgeryId` parameter**
3. `src/server/editorialAi.ts` line 421: Function signature shows no `surgeryId`:
   ```typescript
   export async function generateEditorialBatch(params: {
     promptText: string
     targetRole: EditorialRole
     count: number
     tags?: string[]
     interactiveFirst: boolean
     requestId: string
     onAttempt?: (attempt: GenerationAttemptRecord) => Promise<void> | void
     // ❌ NO surgeryId here
   })
   ```

### Secondary Issues

1. **No symptom data fetch:** Even if `surgeryId` were passed, there's no code to fetch effective symptoms
2. **Static toolkit context:** Only matches keywords to static markdown files (one file: `admin-mental-health.md`)
3. **No prompt enhancement:** User's prompt text isn't analyzed to extract symptom names or topics for lookup
4. **Toolkit context is optional:** Falls back to generic context if no keyword match (line 330)
5. **Prompt positioning:** Toolkit context is included but may not be prominent enough (added at start of user prompt, but after system rules)

### File References

- **Missing surgeryId:** `src/app/api/editorial/generate/route.ts:81`
- **Toolkit resolution:** `src/server/editorialAi.ts:319-335`
- **Static packs:** `src/server/editorialAi.ts:87-94`
- **Available symptom functions:** `src/server/effectiveSymptoms.ts:186-207`

---

## Step 6: Minimal Fix Plan

### Objective
Ensure Editorial AI receives practice-approved Signposting Toolkit advice (effective symptom instructions) as a first-class input, deterministically included in the prompt.

### Proposed Changes

#### 1. Pass `surgeryId` to Generation Function

**File:** `src/app/api/editorial/generate/route.ts`
- **Line 81:** Add `surgeryId` to `generateEditorialBatch()` call
- **Change:**
  ```typescript
  const generated = await generateEditorialBatch({
    surgeryId,  // ← ADD THIS
    promptText: parsed.promptText,
    // ... rest unchanged
  })
  ```

#### 2. Update Function Signature & Fetch Toolkit Advice

**File:** `src/server/editorialAi.ts`

**A) Update function signature (line 421):**
```typescript
export async function generateEditorialBatch(params: {
  surgeryId: string  // ← ADD THIS
  promptText: string
  targetRole: EditorialRole
  count: number
  tags?: string[]
  interactiveFirst: boolean
  requestId: string
  onAttempt?: (attempt: GenerationAttemptRecord) => Promise<void> | void
})
```

**B) Add new function to fetch Signposting Toolkit advice:**
```typescript
async function resolveSignpostingToolkitAdvice(params: {
  surgeryId: string
  promptText: string
  tags?: string[]
  targetRole: EditorialRole
}): Promise<{
  context: string
  source: { title: string; url: string; publisher: string }
} | null> {
  // Only for ADMIN role
  if (params.targetRole !== 'ADMIN') {
    return null
  }

  // Import here to avoid circular dependencies
  const { getEffectiveSymptoms } = await import('@/server/effectiveSymptoms')
  const { prisma } = await import('@/lib/prisma')

  // Get surgery name for source attribution
  const surgery = await prisma.surgery.findUnique({
    where: { id: params.surgeryId },
    select: { name: true }
  })

  // Extract symptom-related keywords from prompt/tags
  const searchTerms = [params.promptText, ...(params.tags || [])]
    .join(' ')
    .toLowerCase()

  // Get all effective symptoms (practice-approved)
  const symptoms = await getEffectiveSymptoms(params.surgeryId, false)

  // Match symptoms by name (simple keyword matching)
  const relevantSymptoms = symptoms.filter(symptom =>
    searchTerms.includes(symptom.name.toLowerCase()) ||
    (symptom.briefInstruction && searchTerms.includes(symptom.briefInstruction.toLowerCase()))
  ).slice(0, 5) // Limit to top 5 most relevant

  if (relevantSymptoms.length === 0) {
    // Fallback to generic toolkit context (existing behaviour)
    const existing = await resolveAdminToolkitContext({
      promptText: params.promptText,
      tags: params.tags
    })
    return existing
  }

  // Build context string from effective symptoms
  const contextItems = relevantSymptoms.map(symptom => {
    const parts: string[] = []
    parts.push(`## ${symptom.name}`)
    if (symptom.briefInstruction) {
      parts.push(`**Brief instruction:** ${symptom.briefInstruction}`)
    }
    if (symptom.instructionsHtml) {
      // Strip HTML tags for plain text version (or keep HTML if model supports it)
      const plainText = symptom.instructionsHtml.replace(/<[^>]*>/g, '').trim()
      parts.push(`**Full instructions:**\n${plainText}`)
    } else if (symptom.instructions) {
      parts.push(`**Full instructions:**\n${symptom.instructions}`)
    }
    if (symptom.highlightedText) {
      parts.push(`**Key phrases:** ${symptom.highlightedText}`)
    }
    return parts.join('\n\n')
  })

  const context = `INTERNAL PRACTICE-APPROVED GUIDANCE (MUST USE VERBATIM WHERE APPLICABLE)

This guidance is from ${surgery?.name || 'this practice'}'s approved Signposting Toolkit database. Use this wording exactly as written for workflow phrasing and slot language.

${contextItems.join('\n\n---\n\n')}

USAGE RULES:
- Use this wording verbatim for slot choices (Red/Orange/Pink-Purple/Green) and escalation steps
- Do not invent new slot colours or escalation routes
- Preserve exact phrasing for safety netting and red flags
- If a symptom is mentioned, use the exact instruction text above
`

  return {
    context,
    source: {
      title: `Signposting Toolkit (${surgery?.name || 'internal'})`,
      url: `https://app.signpostingtool.co.uk/s/${params.surgeryId}`,
      publisher: 'Signposting Toolkit'
    }
  }
}
```

**C) Update `generateEditorialBatch()` to use new function (line 431):**
```typescript
export async function generateEditorialBatch(params: {
  surgeryId: string  // ← ADD
  // ... rest
}) {
  let attemptIndex = 0
  
  // Replace existing toolkit resolution (lines 431-434)
  const toolkit = await resolveSignpostingToolkitAdvice({
    surgeryId: params.surgeryId,  // ← Use surgeryId
    promptText: params.promptText,
    tags: params.tags,
    targetRole: params.targetRole
  })

  const userPrompt = buildUserPrompt({
    // ... rest unchanged
    toolkitContext: toolkit?.context,
    toolkitSource: toolkit?.source,
  })
  
  // ... rest of function unchanged
}
```

**D) Update `formatToolkitSection()` to emphasize verbatim usage (line 229):**
```typescript
function formatToolkitSection(toolkitContext?: string, toolkitSource?: { title: string; url: string; publisher: string }) {
  if (!toolkitContext || !toolkitSource) return ''
  return `INTERNAL PRACTICE-APPROVED GUIDANCE (MUST USE VERBATIM WHERE APPLICABLE)

${toolkitContext.trim()}

TOOLKIT SOURCE (use as sources[0]):
Title: ${toolkitSource.title}
URL: ${toolkitSource.url}
Publisher: ${toolkitSource.publisher}

CRITICAL: Use the wording above verbatim for slot language, escalation steps, and safety netting. Do not paraphrase or invent beyond what is provided.

`
}
```

#### 3. Add Dev-Only Logging

**File:** `src/server/editorialAi.ts`
- Add logging after toolkit resolution (line ~435):
  ```typescript
  if (process.env.NODE_ENV !== 'production' && toolkit) {
    console.log('[Editorial AI] Toolkit context length:', toolkit.context.length)
    console.log('[Editorial AI] Toolkit source:', toolkit.source.title)
  }
  ```

#### 4. Update Variation & Regeneration Functions

**Files:** `src/server/editorialAi.ts`
- `generateEditorialVariations()` (line 511): Add `surgeryId` parameter
- `regenerateEditorialSection()` (line 555): Add `surgeryId` parameter
- Both should call `resolveSignpostingToolkitAdvice()` when role is ADMIN

### Files to Change

1. `src/app/api/editorial/generate/route.ts`
   - Line 81: Add `surgeryId` to function call

2. `src/server/editorialAi.ts`
   - Line 421: Add `surgeryId` to function signature
   - After line 335: Add new `resolveSignpostingToolkitAdvice()` function
   - Line 431: Replace `resolveAdminToolkitContext()` call with new function
   - Line 229: Enhance `formatToolkitSection()` emphasis
   - Line 511: Update `generateEditorialVariations()` signature and toolkit resolution
   - Line 555: Update `regenerateEditorialSection()` signature and toolkit resolution

3. `src/app/api/editorial/variations/route.ts` (if exists)
   - Pass `surgeryId` from request to `generateEditorialVariations()`

4. `src/app/api/editorial/regenerate-section/route.ts` (if exists)
   - Pass `surgeryId` from request to `regenerateEditorialSection()`

### Definition of Done

**Observable Behaviour:**
1. Generated ADMIN cards quote practice-approved slot language (e.g., "Red Slot", "Pink/Purple Slot") exactly as written in symptom instructions
2. Generated cards include `sources[0]` with title "Signposting Toolkit ({Surgery Name})"
3. When prompt mentions a symptom name (e.g., "chest pain"), generated card includes relevant instruction excerpts from that symptom
4. Cards use exact escalation phrasing from symptom instructions (e.g., "duty GP", "same day", "999")
5. Dev logs show toolkit context length > 0 for ADMIN role generations

**Test Cases:**
1. Generate ADMIN cards with prompt "Create cards about chest pain" → Should include chest pain symptom instructions
2. Generate ADMIN cards with prompt "Mental health crisis" → Should include mental health toolkit content (existing behaviour preserved)
3. Generate GP/NURSE cards → No toolkit context included (unchanged)
4. Generate with surgery that has symptom overrides → Uses override wording, not base wording

---

## Summary

**Root Cause:** `surgeryId` is available in the API route but never passed to the AI generation function, preventing access to surgery-specific effective symptom instructions.

**Fix Complexity:** Low-Medium
- Requires adding `surgeryId` parameter to 3 functions
- Requires new function to fetch and format symptom instructions
- Requires updating 2-3 API routes to pass `surgeryId`
- No UI changes required (can be enhanced later)

**Risk Level:** Low
- Existing behaviour preserved (falls back to static content if no symptom match)
- Only affects ADMIN role generations
- Backward compatible (surgeryId can be optional in existing static path)

**Estimated Impact:** High
- Enables practice-specific, approved wording in generated cards
- Fulfills spec requirement for verbatim toolkit language usage
- Makes cards more accurate and locally relevant
