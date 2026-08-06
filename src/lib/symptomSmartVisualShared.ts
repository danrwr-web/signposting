/**
 * Shared (client-safe) schema and helpers for signposting "smart visuals".
 *
 * A smart visual is an AI-generated, structured layout of a symptom's triage
 * instructions, rendered by an approved set of React components (see
 * src/components/symptom-smart-visual/). The schema below is the contract for
 * that layout: a constrained catalogue of section types with enum
 * themes/icons, plain-text-only fields and hard caps. It is deliberately NOT a
 * free-form page description format.
 *
 * This catalogue is a sibling of the Practice Handbook's
 * (src/lib/adminToolkitSmartVisualShared.ts) but shaped for triage rather than
 * rotas: the handbook's people/roles/working-day sections are dropped, and
 * "redFlags" and "routing" are added so escalation criteria and "if X, do Y"
 * signposting can never be flattened into ordinary bullets.
 *
 * The AI prompt in src/server/symptomSmartVisual.ts is a prose rendering of
 * this schema — keep the two in sync when changing section shapes.
 *
 * Keep this file free of `server-only` and heavy runtime dependencies.
 */

import { z } from 'zod'
import {
  IconZ,
  OptTxt,
  ThemeZ,
  Txt,
  normalizeLayoutWithSchema,
} from '@/lib/smartVisualPrimitives'

export {
  SMART_VISUAL_THEMES,
  SMART_VISUAL_ICONS,
  type SmartVisualTheme,
  type SmartVisualIcon,
} from '@/lib/smartVisualPrimitives'

export const SYMPTOM_SMART_VISUAL_VERSION = 1

/**
 * How quickly a routing option must happen. Rendered as a coloured urgency
 * chip; the AI picks from this fixed list rather than writing its own wording,
 * so urgency can never be softened by paraphrase.
 */
export const SYMPTOM_ROUTING_URGENCIES = ['emergency', 'sameDay', 'urgent', 'routine'] as const
const UrgencyZ = z.enum(SYMPTOM_ROUTING_URGENCIES)
export type SymptomRoutingUrgency = z.infer<typeof UrgencyZ>

const SummarySectionZ = z.object({
  type: z.literal('summary'),
  text: Txt(500),
  keyPoints: z.array(Txt(140)).max(5).optional(),
})

const CalloutSectionZ = z.object({
  type: z.literal('callout'),
  tone: z.enum(['info', 'warning', 'urgent', 'success']),
  title: OptTxt(80),
  body: Txt(400),
})

const RedFlagsSectionZ = z.object({
  type: z.literal('redFlags'),
  title: OptTxt(80),
  /** The single action to take when ANY listed flag is present. */
  action: Txt(200),
  flags: z.array(Txt(200)).min(1).max(12),
})

const RoutingSectionZ = z.object({
  type: z.literal('routing'),
  title: OptTxt(80),
  options: z
    .array(
      z.object({
        when: Txt(160),
        action: Txt(160),
        urgency: UrgencyZ.optional(),
        note: OptTxt(200),
      })
    )
    .min(1)
    .max(10),
})

const StepsSectionZ = z.object({
  type: z.literal('steps'),
  title: OptTxt(80),
  steps: z
    .array(
      z.object({
        title: Txt(90),
        detail: OptTxt(300),
      })
    )
    .min(1)
    .max(12),
})

const ChecklistSectionZ = z.object({
  type: z.literal('checklist'),
  title: OptTxt(80),
  items: z
    .array(
      z.object({
        text: Txt(200),
        detail: OptTxt(200),
      })
    )
    .min(1)
    .max(15),
})

const PairsSectionZ = z.object({
  type: z.literal('pairs'),
  title: OptTxt(80),
  leftLabel: OptTxt(40),
  rightLabel: OptTxt(40),
  pairs: z
    .array(
      z.object({
        left: Txt(80),
        right: Txt(80),
        note: OptTxt(120),
      })
    )
    .min(1)
    .max(12),
})

const FactsSectionZ = z.object({
  type: z.literal('facts'),
  title: OptTxt(80),
  facts: z
    .array(
      z.object({
        label: Txt(60),
        value: Txt(140),
        icon: IconZ.optional(),
        theme: ThemeZ.optional(),
      })
    )
    .min(1)
    .max(8),
})

const BulletsSectionZ = z.object({
  type: z.literal('bullets'),
  groups: z
    .array(
      z.object({
        title: Txt(80),
        icon: IconZ.optional(),
        theme: ThemeZ.optional(),
        items: z.array(Txt(220)).min(1).max(8),
      })
    )
    .min(1)
    .max(6),
})

const TableSectionZ = z
  .object({
    type: z.literal('table'),
    title: OptTxt(80),
    headers: z.array(Txt(60)).min(1).max(6),
    rows: z.array(z.array(z.string().trim().max(180))).min(1).max(20),
  })
  .superRefine((section, ctx) => {
    section.rows.forEach((row, idx) => {
      if (row.length !== section.headers.length) {
        ctx.addIssue({
          code: 'custom',
          path: ['rows', idx],
          message: `Row must have exactly ${section.headers.length} cells to match the headers.`,
        })
      }
    })
  })

export const SymptomSmartVisualSectionZ = z.discriminatedUnion('type', [
  SummarySectionZ,
  CalloutSectionZ,
  RedFlagsSectionZ,
  RoutingSectionZ,
  StepsSectionZ,
  ChecklistSectionZ,
  PairsSectionZ,
  FactsSectionZ,
  BulletsSectionZ,
  TableSectionZ,
])

export type SymptomSmartVisualSection = z.infer<typeof SymptomSmartVisualSectionZ>

export const SymptomSmartVisualLayoutZ = z.object({
  version: z.literal(SYMPTOM_SMART_VISUAL_VERSION),
  sections: z.array(SymptomSmartVisualSectionZ).min(1).max(12),
})

export type SymptomSmartVisualLayout = z.infer<typeof SymptomSmartVisualLayoutZ>

/**
 * Post-parse normalisation of a validated layout: strips stray HTML tags,
 * collapses whitespace and drops emptied optional string fields. Run this
 * after `SymptomSmartVisualLayoutZ.safeParse` on every path that accepts a
 * layout (generation and save) — never trust AI or client input to be plain
 * text.
 */
export function normalizeSymptomSmartVisualLayout(
  layout: SymptomSmartVisualLayout
): SymptomSmartVisualLayout {
  return normalizeLayoutWithSchema(SymptomSmartVisualLayoutZ, layout)
}

/** Human-readable list of section types present in a layout (for audit rows). */
export function symptomSmartVisualSectionTypes(layout: SymptomSmartVisualLayout): string[] {
  return layout.sections.map((s) => s.type)
}
