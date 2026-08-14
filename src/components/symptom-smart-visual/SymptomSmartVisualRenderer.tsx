'use client'

import { createContext, useContext, useMemo } from 'react'
import type {
  SymptomSmartVisualLayout,
  SymptomSmartVisualSection,
  SymptomRoutingUrgency,
  SmartVisualTheme,
} from '@/lib/symptomSmartVisualShared'
import {
  SECTION_THEMES,
  DEFAULT_THEME,
  CALLOUT_TONE_THEMES,
} from '@/components/smart-visual/smartVisualTheme'
import { SmartVisualIconGlyph } from '@/components/smart-visual/smartVisualIcons'
import { splitHighlightSegments } from '@/lib/highlightSegments'
import type { HighlightRule } from '@/lib/highlighting'

/**
 * Renders a validated symptom smart visual layout using the approved section
 * components. All AI-provided text is emitted as React text nodes only — never
 * as HTML — including the practice's highlight rules, which arrive as segment
 * data rather than markup for exactly that reason.
 *
 * The highlight rules reach every piece of text through context: they are
 * needed in roughly thirty places, and threading them as props through each
 * section component would bury the layout in plumbing.
 */

type SmartVisualHighlights = {
  rules: HighlightRule[]
  enableBuiltInHighlights: boolean
}

const HighlightsContext = createContext<SmartVisualHighlights>({
  rules: [],
  enableBuiltInHighlights: true,
})

function useSmartVisualHighlights() {
  return useContext(HighlightsContext)
}

type SectionOf<T extends SymptomSmartVisualSection['type']> = Extract<
  SymptomSmartVisualSection,
  { type: T }
>

function themeOf(theme: SmartVisualTheme | undefined) {
  return SECTION_THEMES[theme ?? DEFAULT_THEME]
}

// Candidate phone numbers: NHS shortcodes (999/111/112) as standalone words,
// or UK-style numbers starting 0 with optional space/hyphen grouping. The
// 0-prefixed candidates are verified to carry 10-11 digits before styling,
// so ordinary numbers in prose are left alone.
const PHONE_CANDIDATE_REGEX = /(\b0[\d](?:[\s-]?\d){8,12}\b|\b(?:999|111|112)\b)/g

function isPhoneNumber(candidate: string): boolean {
  if (candidate === '999' || candidate === '111' || candidate === '112') return true
  const digits = candidate.replace(/\D/g, '')
  return candidate.startsWith('0') && digits.length >= 10 && digits.length <= 11
}

/**
 * Renders text with phone numbers emphasised: bold and dialable via tel:
 * links. Deterministic, app-side styling — the AI supplies plain text only.
 * Doubly valuable here, where 999 and 111 carry the urgency of the guidance.
 */
function PhoneAwareText({ text }: { text: string }) {
  const parts = text.split(PHONE_CANDIDATE_REGEX)
  if (parts.length === 1) return <>{text}</>
  return (
    <>
      {parts.map((part, i) =>
        part && isPhoneNumber(part) ? (
          <a
            key={i}
            href={`tel:${part.replace(/[\s-]/g, '')}`}
            className="font-bold text-gray-900 whitespace-nowrap hover:underline"
          >
            {part}
          </a>
        ) : (
          part
        )
      )}
    </>
  )
}

/**
 * The single text primitive for the whole visual: the practice's highlight
 * rules, then phone emphasis within each resulting segment (so a highlighted
 * "Call 999" stays both coloured and dialable).
 *
 * Highlights arrive as segment data rather than HTML precisely so this stays a
 * tree of React text nodes — the AI's text is never parsed as markup.
 */
function TextWithPhones({ text }: { text: string }) {
  const { rules, enableBuiltInHighlights } = useSmartVisualHighlights()
  const segments = splitHighlightSegments(text, rules, enableBuiltInHighlights)

  if (segments.length <= 1 && !segments[0]?.style && !segments[0]?.className) {
    return <PhoneAwareText text={text} />
  }

  return (
    <>
      {segments.map((segment, i) =>
        segment.style || segment.className ? (
          <span
            key={i}
            style={
              segment.style
                ? {
                    color: segment.style.color,
                    backgroundColor: segment.style.backgroundColor,
                    padding: '2px 4px',
                    borderRadius: '4px',
                    fontWeight: 500,
                  }
                : undefined
            }
            className={segment.className ?? 'text-sm'}
          >
            <PhoneAwareText text={segment.text} />
          </span>
        ) : (
          <PhoneAwareText key={i} text={segment.text} />
        )
      )}
    </>
  )
}

function SectionTitle({ title, className }: { title?: string; className?: string }) {
  if (!title) return null
  return (
    <h2 className={`text-lg font-semibold ${className ?? 'text-nhs-dark-blue'} mb-4`}>
      <TextWithPhones text={title} />
    </h2>
  )
}

function SummarySection({ section }: { section: SectionOf<'summary'> }) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="h-1 -mt-5 -mx-5 mb-4 rounded-t-xl bg-gradient-to-r from-nhs-blue via-nhs-blue/80 to-nhs-green" />
      <p className="text-base leading-relaxed text-gray-800">
        <TextWithPhones text={section.text} />
      </p>
      {section.keyPoints && section.keyPoints.length > 0 ? (
        <ul className="mt-4 flex flex-wrap gap-2">
          {section.keyPoints.map((point, i) => (
            <li
              key={i}
              className="inline-flex items-center rounded-full bg-nhs-light-blue px-3 py-1 text-sm font-medium text-nhs-dark-blue"
            >
              <TextWithPhones text={point} />
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}

function CalloutSection({ section }: { section: SectionOf<'callout'> }) {
  const theme = themeOf(CALLOUT_TONE_THEMES[section.tone])
  const icon = section.tone === 'success' ? 'check' : section.tone === 'info' ? 'info' : 'alert'
  return (
    <section
      role={section.tone === 'urgent' ? 'alert' : undefined}
      className={`rounded-xl border-l-4 ${theme.border} ${theme.surface} p-5 shadow-sm`}
    >
      <div className="flex items-start gap-3">
        <span className={`mt-0.5 shrink-0 ${theme.icon}`}>
          <SmartVisualIconGlyph icon={icon} className="h-6 w-6" />
        </span>
        <div>
          {section.title ? (
            <p className={`font-semibold ${theme.heading}`}>
              <TextWithPhones text={section.title} />
            </p>
          ) : null}
          <p className={`${section.title ? 'mt-1 ' : ''}text-sm leading-relaxed text-gray-800`}>
            <TextWithPhones text={section.body} />
          </p>
        </div>
      </div>
    </section>
  )
}

/**
 * Escalation criteria, always in the "stop" palette with the required action
 * stated once and prominently. Given its own section type (rather than being
 * left to bullets) so red flags can never be styled as ordinary content.
 */
function RedFlagsSection({ section }: { section: SectionOf<'redFlags'> }) {
  const theme = themeOf('red')
  return (
    <section role="alert" className={`rounded-xl border-2 ${theme.border} ${theme.surface} p-5 shadow-sm`}>
      <h2 className={`flex items-center gap-2 text-lg font-bold ${theme.heading}`}>
        <span className={theme.icon}>
          <SmartVisualIconGlyph icon="alert" className="h-6 w-6" />
        </span>
        <TextWithPhones text={section.title ?? 'Red flags'} />
      </h2>
      <ul className="mt-4 grid gap-2 sm:grid-cols-2">
        {section.flags.map((flag, i) => (
          <li
            key={i}
            className="flex items-start gap-2 rounded-lg border border-red-200 bg-white px-3 py-2 text-sm text-gray-900"
          >
            <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${theme.accent}`} aria-hidden="true" />
            <span>
              <TextWithPhones text={flag} />
            </span>
          </li>
        ))}
      </ul>
      <p className={`mt-4 rounded-lg ${theme.chip} px-4 py-3 text-base font-bold`}>
        <span className="mr-1 font-semibold uppercase tracking-wide opacity-90 text-xs">
          If any apply
        </span>
        <br />
        <TextWithPhones text={section.action} />
      </p>
    </section>
  )
}

const URGENCY_LABELS: Record<SymptomRoutingUrgency, string> = {
  emergency: 'Emergency',
  sameDay: 'Same day',
  urgent: 'Urgent',
  routine: 'Routine',
}

const URGENCY_THEMES: Record<SymptomRoutingUrgency, SmartVisualTheme> = {
  emergency: 'red',
  sameDay: 'amber',
  urgent: 'amber',
  routine: 'green',
}

/**
 * The core signposting shape: "when this is true, do that". Rendered as
 * condition → action rows so a receptionist can scan down the left column to
 * find their patient, then read across to the booking.
 */
function RoutingSection({ section }: { section: SectionOf<'routing'> }) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <SectionTitle title={section.title ?? 'Where to send the patient'} />
      <ul className="space-y-2">
        {section.options.map((option, i) => {
          const urgencyTheme = option.urgency ? themeOf(URGENCY_THEMES[option.urgency]) : null
          return (
            <li
              key={i}
              className={`rounded-lg border ${
                urgencyTheme ? `${urgencyTheme.border} ${urgencyTheme.surface}` : 'border-gray-200 bg-nhs-light-grey/60'
              } px-4 py-3`}
            >
              <div className="grid gap-2 sm:grid-cols-[1fr_auto_1fr] sm:items-center sm:gap-3">
                <span className="font-medium text-gray-900">
                  <TextWithPhones text={option.when} />
                </span>
                <svg
                  className="hidden h-5 w-5 text-nhs-blue sm:block"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.8}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                </svg>
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-gray-900">
                    <TextWithPhones text={option.action} />
                  </span>
                  {option.urgency && urgencyTheme ? (
                    <span
                      className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-semibold ${urgencyTheme.chip}`}
                    >
                      {URGENCY_LABELS[option.urgency]}
                    </span>
                  ) : null}
                </span>
              </div>
              {option.note ? (
                <p className="mt-1 text-sm text-gray-600">
                  <TextWithPhones text={option.note} />
                </p>
              ) : null}
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function StepsSection({ section }: { section: SectionOf<'steps'> }) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <SectionTitle title={section.title} />
      <ol className="space-y-4">
        {section.steps.map((step, i) => (
          <li key={i} className="flex items-start gap-4">
            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-nhs-blue to-nhs-dark-blue text-sm font-bold text-white"
              aria-hidden="true"
            >
              {i + 1}
            </span>
            <div className="min-w-0 pt-1">
              <p className="font-medium text-gray-900">
                <TextWithPhones text={step.title} />
              </p>
              {step.detail ? (
                <p className="mt-0.5 text-sm leading-relaxed text-gray-600">
                  <TextWithPhones text={step.detail} />
                </p>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}

function ChecklistSection({ section }: { section: SectionOf<'checklist'> }) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <SectionTitle title={section.title} />
      <ul className="space-y-3">
        {section.items.map((item, i) => (
          <li key={i} className="flex items-start gap-3">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-nhs-green-tint text-nhs-green-dark">
              <SmartVisualIconGlyph icon="check" className="h-3.5 w-3.5" />
            </span>
            <div className="min-w-0">
              <p className="text-gray-900">
                <TextWithPhones text={item.text} />
              </p>
              {item.detail ? (
                <p className="mt-0.5 text-sm text-gray-600">
                  <TextWithPhones text={item.detail} />
                </p>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}

function PairsSection({ section }: { section: SectionOf<'pairs'> }) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <SectionTitle title={section.title} />
      {section.leftLabel || section.rightLabel ? (
        <div className="mb-2 grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 text-xs font-semibold uppercase tracking-wide text-nhs-grey">
          <span>{section.leftLabel ?? ''}</span>
          <span aria-hidden="true" className="w-5" />
          <span>{section.rightLabel ?? ''}</span>
        </div>
      ) : null}
      <ul className="space-y-2">
        {section.pairs.map((pair, i) => (
          <li key={i} className="rounded-lg border border-gray-200 bg-nhs-light-grey/60 px-4 py-3">
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
              <span className="font-medium text-gray-900">
                <TextWithPhones text={pair.left} />
              </span>
              <svg
                className="h-5 w-5 text-nhs-blue"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.8}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
              </svg>
              <span className="font-medium text-gray-900">
                <TextWithPhones text={pair.right} />
              </span>
            </div>
            {pair.note ? (
              <p className="mt-1 text-sm text-gray-600">
                <TextWithPhones text={pair.note} />
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  )
}

function FactsSection({ section }: { section: SectionOf<'facts'> }) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <SectionTitle title={section.title} />
      <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {section.facts.map((fact, i) => {
          const theme = themeOf(fact.theme)
          return (
            <div key={i} className={`rounded-lg border ${theme.border} ${theme.surface} p-4`}>
              <dt className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-nhs-grey">
                {fact.icon ? (
                  <span className={theme.icon}>
                    <SmartVisualIconGlyph icon={fact.icon} className="h-4 w-4" />
                  </span>
                ) : null}
                <TextWithPhones text={fact.label} />
              </dt>
              <dd className={`mt-1.5 text-lg font-bold leading-snug ${theme.heading}`}>
                <TextWithPhones text={fact.value} />
              </dd>
            </div>
          )
        })}
      </dl>
    </section>
  )
}

function BulletsSection({ section }: { section: SectionOf<'bullets'> }) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="grid gap-4 sm:grid-cols-2">
        {section.groups.map((group, i) => {
          const theme = themeOf(group.theme)
          return (
            <div key={i} className={`rounded-lg border ${theme.border} ${theme.surface} p-4`}>
              <h3 className={`flex items-center gap-2 font-semibold ${theme.heading}`}>
                {group.icon ? (
                  <span className={theme.icon}>
                    <SmartVisualIconGlyph icon={group.icon} className="h-5 w-5" />
                  </span>
                ) : null}
                <TextWithPhones text={group.title} />
              </h3>
              <ul className="mt-3 space-y-1.5">
                {group.items.map((item, j) => (
                  <li key={j} className="flex items-start gap-2 text-sm text-gray-800">
                    <span
                      className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${theme.accent}`}
                      aria-hidden="true"
                    />
                    <span>
                      <TextWithPhones text={item} />
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function TableSection({ section }: { section: SectionOf<'table'> }) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <SectionTitle title={section.title} />
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead>
            <tr>
              {section.headers.map((header, i) => (
                <th
                  key={i}
                  scope="col"
                  className="bg-nhs-light-grey px-4 py-2.5 text-left font-semibold text-nhs-dark-blue first:rounded-l-lg last:rounded-r-lg"
                >
                  <TextWithPhones text={header} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {section.rows.map((row, i) => (
              <tr key={i}>
                {row.map((cell, j) => (
                  <td key={j} className="px-4 py-2.5 align-top text-gray-800">
                    <TextWithPhones text={cell} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function renderSection(section: SymptomSmartVisualSection, index: number) {
  switch (section.type) {
    case 'summary':
      return <SummarySection key={index} section={section} />
    case 'callout':
      return <CalloutSection key={index} section={section} />
    case 'redFlags':
      return <RedFlagsSection key={index} section={section} />
    case 'routing':
      return <RoutingSection key={index} section={section} />
    case 'steps':
      return <StepsSection key={index} section={section} />
    case 'checklist':
      return <ChecklistSection key={index} section={section} />
    case 'pairs':
      return <PairsSection key={index} section={section} />
    case 'facts':
      return <FactsSection key={index} section={section} />
    case 'bullets':
      return <BulletsSection key={index} section={section} />
    case 'table':
      return <TableSection key={index} section={section} />
    default:
      // Only reachable under client/server version skew (a section type this
      // bundle doesn't know about). Fail visibly rather than rendering nothing.
      return (
        <section
          key={index}
          className="rounded-xl border border-gray-200 bg-gray-50 p-5 text-sm text-gray-600"
        >
          Part of this visual can&apos;t be displayed by this version of the app. Refresh the page and
          try again.
        </section>
      )
  }
}

export default function SymptomSmartVisualRenderer({
  layout,
  highlightRules,
  enableBuiltInHighlights = true,
}: {
  layout: SymptomSmartVisualLayout
  /**
   * The practice's highlight rules, so a smart visual colours the same phrases
   * the standard instruction view does. Omit to render without highlighting.
   */
  highlightRules?: HighlightRule[]
  enableBuiltInHighlights?: boolean
}) {
  const highlights = useMemo<SmartVisualHighlights>(
    () => ({ rules: highlightRules ?? [], enableBuiltInHighlights }),
    [highlightRules, enableBuiltInHighlights]
  )
  return (
    <HighlightsContext.Provider value={highlights}>
      <div className="space-y-5">
        {layout.sections.map((section, i) => renderSection(section, i))}
      </div>
    </HighlightsContext.Provider>
  )
}
