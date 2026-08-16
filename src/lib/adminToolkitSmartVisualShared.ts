/**
 * Shared (client-safe) schema and helpers for Practice Handbook "smart visuals".
 *
 * A smart visual is an AI-generated, structured layout of a handbook item,
 * rendered by an approved set of React components (see
 * src/components/admin-toolkit/smart-visual/). The schema below is the
 * contract for that layout: a constrained catalogue of section types with
 * enum themes/icons, plain-text-only fields and hard caps. It is deliberately
 * NOT a free-form page description format.
 *
 * The AI prompt in src/server/adminToolkitSmartVisual.ts is a prose rendering
 * of this schema — keep the two in sync when changing section shapes.
 *
 * Theme/icon enums and the plain-text helpers are shared with the other smart
 * visual surfaces — see src/lib/smartVisualPrimitives.ts.
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

export const SMART_VISUAL_VERSION = 1

// Working-day chips are a handbook rota concern only, so this enum stays local.
export const SMART_VISUAL_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const
const DayZ = z.enum(SMART_VISUAL_DAYS)
export type SmartVisualDay = z.infer<typeof DayZ>

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

const ContactsSectionZ = z.object({
  type: z.literal('contacts'),
  title: OptTxt(80),
  contacts: z
    .array(
      z.object({
        name: Txt(80),
        role: OptTxt(80),
        phone: OptTxt(40),
        extension: OptTxt(12),
        email: OptTxt(120),
        note: OptTxt(160),
      })
    )
    .min(1)
    .max(12),
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

const PeopleSectionZ = z.object({
  type: z.literal('people'),
  title: OptTxt(80),
  groups: z
    .array(
      z.object({
        title: Txt(80),
        theme: ThemeZ.optional(),
        note: OptTxt(160),
        members: z
          .array(
            z.object({
              name: Txt(80),
              tag: OptTxt(40),
              days: z.array(DayZ).max(7).optional(),
              facts: z
                .array(
                  z.object({
                    label: Txt(40),
                    value: Txt(140),
                  })
                )
                .max(4)
                .optional(),
              note: OptTxt(160),
            })
          )
          .min(1)
          .max(12),
      })
    )
    .min(1)
    .max(8),
})

const RolesSectionZ = z.object({
  type: z.literal('roles'),
  title: OptTxt(80),
  roles: z
    .array(
      z.object({
        role: Txt(80),
        person: OptTxt(80),
        theme: ThemeZ.optional(),
        responsibilities: z.array(Txt(180)).min(1).max(6),
      })
    )
    .min(1)
    .max(8),
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

export const SmartVisualSectionZ = z.discriminatedUnion('type', [
  SummarySectionZ,
  CalloutSectionZ,
  StepsSectionZ,
  ChecklistSectionZ,
  ContactsSectionZ,
  PairsSectionZ,
  PeopleSectionZ,
  RolesSectionZ,
  FactsSectionZ,
  BulletsSectionZ,
  TableSectionZ,
])

export type SmartVisualSection = z.infer<typeof SmartVisualSectionZ>

export const SmartVisualLayoutZ = z.object({
  version: z.literal(SMART_VISUAL_VERSION),
  sections: z.array(SmartVisualSectionZ).min(1).max(12),
})

export type SmartVisualLayout = z.infer<typeof SmartVisualLayoutZ>

/**
 * Post-parse normalisation of a validated layout: strips stray HTML tags,
 * collapses whitespace and drops emptied optional string fields. Run this
 * after `SmartVisualLayoutZ.safeParse` on every path that accepts a layout
 * (generation and save) — never trust AI or client input to be plain text.
 */
export function normalizeSmartVisualLayout(layout: SmartVisualLayout): SmartVisualLayout {
  return normalizeLayoutWithSchema(SmartVisualLayoutZ, layout)
}

/** Human-readable list of section types present in a layout (for audit rows). */
export function smartVisualSectionTypes(layout: SmartVisualLayout): string[] {
  return layout.sections.map((s) => s.type)
}
