import {
  SMART_VISUAL_DAYS,
  type SmartVisualDay,
  type SmartVisualLayout,
  type SmartVisualSection,
  type SmartVisualTheme,
} from '@/lib/adminToolkitSmartVisualShared'
import { SECTION_THEMES, DEFAULT_THEME, CALLOUT_TONE_THEMES, GROUP_THEME_CYCLE } from './smartVisualTheme'
import { SmartVisualIconGlyph } from './smartVisualIcons'

/**
 * Renders a validated smart visual layout using the approved section
 * components. Deliberately hook-free and server-safe: all AI-provided text is
 * emitted as React text nodes only — never as HTML.
 */

type SectionOf<T extends SmartVisualSection['type']> = Extract<SmartVisualSection, { type: T }>

function themeOf(theme: SmartVisualTheme | undefined) {
  return SECTION_THEMES[theme ?? DEFAULT_THEME]
}

function SectionTitle({ title, className }: { title?: string; className?: string }) {
  if (!title) return null
  return <h2 className={`text-lg font-semibold ${className ?? 'text-nhs-dark-blue'} mb-4`}>{title}</h2>
}

function SummarySection({ section }: { section: SectionOf<'summary'> }) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="h-1 -mt-5 -mx-5 mb-4 rounded-t-xl bg-gradient-to-r from-nhs-blue via-nhs-blue/80 to-nhs-green" />
      <p className="text-base leading-relaxed text-gray-800">{section.text}</p>
      {section.keyPoints && section.keyPoints.length > 0 ? (
        <ul className="mt-4 flex flex-wrap gap-2">
          {section.keyPoints.map((point, i) => (
            <li
              key={i}
              className="inline-flex items-center rounded-full bg-nhs-light-blue px-3 py-1 text-sm font-medium text-nhs-dark-blue"
            >
              {point}
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
          {section.title ? <p className={`font-semibold ${theme.heading}`}>{section.title}</p> : null}
          <p className={`${section.title ? 'mt-1 ' : ''}text-sm leading-relaxed text-gray-800`}>{section.body}</p>
        </div>
      </div>
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
              <p className="font-medium text-gray-900">{step.title}</p>
              {step.detail ? <p className="mt-0.5 text-sm leading-relaxed text-gray-600">{step.detail}</p> : null}
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
              <p className="text-gray-900">{item.text}</p>
              {item.detail ? <p className="mt-0.5 text-sm text-gray-600">{item.detail}</p> : null}
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}

function ContactsSection({ section }: { section: SectionOf<'contacts'> }) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <SectionTitle title={section.title} />
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {section.contacts.map((contact, i) => (
          <li key={i} className="rounded-lg border border-gray-200 bg-nhs-light-grey/60 p-4">
            <p className="font-semibold text-gray-900">{contact.name}</p>
            {contact.role ? <p className="text-sm text-nhs-grey">{contact.role}</p> : null}
            <div className="mt-2 space-y-1 text-sm">
              {contact.phone ? (
                <p className="flex items-center gap-2 text-gray-800">
                  <span className="text-nhs-blue">
                    <SmartVisualIconGlyph icon="phone" className="h-4 w-4" />
                  </span>
                  <a href={`tel:${contact.phone.replace(/\s+/g, '')}`} className="hover:underline">
                    {contact.phone}
                  </a>
                  {contact.extension ? <span className="text-gray-500">ext. {contact.extension}</span> : null}
                </p>
              ) : contact.extension ? (
                <p className="flex items-center gap-2 text-gray-800">
                  <span className="text-nhs-blue">
                    <SmartVisualIconGlyph icon="phone" className="h-4 w-4" />
                  </span>
                  <span>ext. {contact.extension}</span>
                </p>
              ) : null}
              {contact.email ? (
                <p className="flex items-center gap-2 text-gray-800">
                  <span className="text-nhs-blue">
                    <SmartVisualIconGlyph icon="email" className="h-4 w-4" />
                  </span>
                  <a href={`mailto:${contact.email}`} className="break-all hover:underline">
                    {contact.email}
                  </a>
                </p>
              ) : null}
              {contact.note ? <p className="pt-1 text-gray-600">{contact.note}</p> : null}
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
              <span className="font-medium text-gray-900">{pair.left}</span>
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
              <span className="font-medium text-gray-900">{pair.right}</span>
            </div>
            {pair.note ? <p className="mt-1 text-sm text-gray-600">{pair.note}</p> : null}
          </li>
        ))}
      </ul>
    </section>
  )
}

function DayStrip({ days, chipClass }: { days: SmartVisualDay[]; chipClass: string }) {
  const showWeekend = days.includes('Sat') || days.includes('Sun')
  const strip = showWeekend ? SMART_VISUAL_DAYS : SMART_VISUAL_DAYS.slice(0, 5)
  return (
    <ul className="flex flex-wrap gap-1" aria-label={`Working days: ${days.join(', ')}`}>
      {strip.map((day) => {
        const active = days.includes(day)
        return (
          <li
            key={day}
            className={`flex h-6 w-10 items-center justify-center rounded-md text-xs font-semibold ${
              active ? chipClass : 'border border-gray-200 bg-white text-gray-300'
            }`}
            aria-hidden={active ? undefined : true}
          >
            {day}
          </li>
        )
      })}
    </ul>
  )
}

function PeopleSection({ section }: { section: SectionOf<'people'> }) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <SectionTitle title={section.title} />
      <div className="grid items-start gap-4 lg:grid-cols-2">
        {section.groups.map((group, i) => {
          const theme = themeOf(group.theme ?? GROUP_THEME_CYCLE[i % GROUP_THEME_CYCLE.length])
          return (
            <div key={i} className={`overflow-hidden rounded-lg border ${theme.border} ${theme.surface}`}>
              <div className={`h-1 ${theme.accent}`} aria-hidden="true" />
              <div className="p-4">
                <h3 className={`flex items-center gap-2 font-semibold ${theme.heading}`}>
                  <span className={theme.icon}>
                    <SmartVisualIconGlyph icon="people" className="h-5 w-5" />
                  </span>
                  {group.title}
                </h3>
                {group.note ? <p className="mt-1 text-sm text-gray-600">{group.note}</p> : null}
                <ul className="mt-3 divide-y divide-gray-200/70">
                  {group.members.map((member, j) => (
                    <li key={j} className="py-3 first:pt-0 last:pb-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-gray-900">{member.name}</span>
                        {member.tag ? (
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${theme.chip}`}>
                            {member.tag}
                          </span>
                        ) : null}
                      </div>
                      {member.days && member.days.length > 0 ? (
                        <div className="mt-2">
                          <DayStrip days={member.days} chipClass={theme.chip} />
                        </div>
                      ) : null}
                      {member.facts && member.facts.length > 0 ? (
                        <dl className="mt-2 space-y-0.5 text-sm">
                          {member.facts.map((fact, k) => (
                            <div key={k} className="flex flex-wrap gap-x-1.5">
                              <dt className="shrink-0 font-medium text-nhs-grey">{fact.label}:</dt>
                              <dd className="text-gray-800">{fact.value}</dd>
                            </div>
                          ))}
                        </dl>
                      ) : null}
                      {member.note ? <p className="mt-1.5 text-sm text-gray-600">{member.note}</p> : null}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function RolesSection({ section }: { section: SectionOf<'roles'> }) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <SectionTitle title={section.title} />
      <ul className="grid gap-4 sm:grid-cols-2">
        {section.roles.map((role, i) => {
          const theme = themeOf(role.theme)
          return (
            <li key={i} className={`overflow-hidden rounded-lg border ${theme.border} ${theme.surface}`}>
              <div className={`h-1 ${theme.accent}`} aria-hidden="true" />
              <div className="p-4">
                <p className={`font-semibold ${theme.heading}`}>{role.role}</p>
                {role.person ? <p className="text-sm text-nhs-grey">{role.person}</p> : null}
                <ul className="mt-3 space-y-1.5">
                  {role.responsibilities.map((resp, j) => (
                    <li key={j} className="flex items-start gap-2 text-sm text-gray-800">
                      <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${theme.accent}`} aria-hidden="true" />
                      <span>{resp}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </li>
          )
        })}
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
                {fact.label}
              </dt>
              <dd className={`mt-1.5 text-lg font-bold leading-snug ${theme.heading}`}>{fact.value}</dd>
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
                {group.title}
              </h3>
              <ul className="mt-3 space-y-1.5">
                {group.items.map((item, j) => (
                  <li key={j} className="flex items-start gap-2 text-sm text-gray-800">
                    <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${theme.accent}`} aria-hidden="true" />
                    <span>{item}</span>
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
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {section.rows.map((row, i) => (
              <tr key={i}>
                {row.map((cell, j) => (
                  <td key={j} className="px-4 py-2.5 align-top text-gray-800">
                    {cell}
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

function renderSection(section: SmartVisualSection, index: number) {
  switch (section.type) {
    case 'summary':
      return <SummarySection key={index} section={section} />
    case 'callout':
      return <CalloutSection key={index} section={section} />
    case 'steps':
      return <StepsSection key={index} section={section} />
    case 'checklist':
      return <ChecklistSection key={index} section={section} />
    case 'contacts':
      return <ContactsSection key={index} section={section} />
    case 'pairs':
      return <PairsSection key={index} section={section} />
    case 'people':
      return <PeopleSection key={index} section={section} />
    case 'roles':
      return <RolesSection key={index} section={section} />
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
        <section key={index} className="rounded-xl border border-gray-200 bg-gray-50 p-5 text-sm text-gray-600">
          Part of this visual can&apos;t be displayed by this version of the app. Refresh the page and try again.
        </section>
      )
  }
}

export default function SmartVisualRenderer({ layout }: { layout: SmartVisualLayout }) {
  return <div className="space-y-5">{layout.sections.map((section, i) => renderSection(section, i))}</div>
}
