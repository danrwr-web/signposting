'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Card, Dialog, EmptyState, Input } from '@/components/ui'

const DOCS_BASE_URL = 'https://docs.signpostingtool.co.uk'
export const HELP_PANEL_ID = 'help-panel'

type HelpLink = {
  id: string
  title: string
  url: string
  description?: string
  keywords: string[]
  section: 'quick' | 'docs'
}

const HELP_LINKS: HelpLink[] = [
  {
    id: 'getting-started',
    title: 'Getting Started',
    url: `${DOCS_BASE_URL}/getting-started`,
    description: 'Set up your surgery and get the team ready.',
    keywords: ['onboarding', 'setup', 'surgery', 'new practice'],
    section: 'quick',
  },
  {
    id: 'user-guide',
    title: 'User Guide',
    url: `${DOCS_BASE_URL}/getting-started/user-guide`,
    description: 'Everyday guidance for reception teams.',
    keywords: ['day to day', 'reception', 'how to use', 'signposting'],
    section: 'quick',
  },
  {
    id: 'day-to-day-use',
    title: 'Day-to-Day Use',
    url: `${DOCS_BASE_URL}/getting-started/day-to-day-use`,
    description: 'Practical tips for busy reception shifts.',
    keywords: ['daily', 'reception', 'front desk', 'routine', 'shift'],
    section: 'quick',
  },
  {
    id: 'after-go-live',
    title: 'After Go-Live',
    url: `${DOCS_BASE_URL}/getting-started/after-go-live`,
    description: 'Keep content current once you are up and running.',
    keywords: ['maintenance', 'review', 'embed', 'adoption', 'go live'],
    section: 'quick',
  },
  {
    id: 'symptom-library',
    title: 'Symptom Library',
    url: `${DOCS_BASE_URL}/features/symptom-library`,
    description: 'Find and manage symptoms safely.',
    keywords: ['symptoms', 'search', 'review', 'highlighting'],
    section: 'quick',
  },
  {
    id: 'high-risk-and-highlighting',
    title: 'High-Risk & Highlighting',
    url: `${DOCS_BASE_URL}/features/high-risk-and-highlighting`,
    description: 'Flag urgent symptoms and highlight key text.',
    keywords: ['high risk', 'red flag', 'highlight', 'urgent', 'safety'],
    section: 'quick',
  },
  {
    id: 'practice-handbook',
    title: 'Practice Handbook',
    url: `${DOCS_BASE_URL}/features/practice-handbook`,
    description: 'Local guidance pages for your practice.',
    keywords: ['admin toolkit', 'handbook', 'local guidance', 'rota'],
    section: 'quick',
  },
  {
    id: 'workflow-guidance',
    title: 'Workflow Guidance',
    url: `${DOCS_BASE_URL}/features/workflow-guidance`,
    description: 'Standardise workflows and approvals.',
    keywords: ['workflow', 'templates', 'approvals', 'diagrams'],
    section: 'quick',
  },
  {
    id: 'appointment-directory',
    title: 'Appointment Directory',
    url: `${DOCS_BASE_URL}/features/appointment-directory`,
    description: 'Manage appointment types and filtering.',
    keywords: ['appointments', 'directory', 'filters', 'services'],
    section: 'quick',
  },
  {
    id: 'analytics',
    title: 'Analytics',
    url: `${DOCS_BASE_URL}/features/analytics`,
    description: 'See how the toolkit is being used.',
    keywords: ['analytics', 'usage', 'reporting', 'insights', 'stats'],
    section: 'quick',
  },
  {
    id: 'ai-features',
    title: 'AI Features',
    url: `${DOCS_BASE_URL}/features/ai-features`,
    description: 'Optional AI tools with safe controls.',
    keywords: ['ai', 'questions', 'instructions', 'review'],
    section: 'quick',
  },
  {
    id: 'clinical-governance',
    title: 'Clinical Governance',
    url: `${DOCS_BASE_URL}/governance/clinical-governance`,
    description: 'Clinical review, approvals, and safety.',
    keywords: ['review', 'approval', 'audit', 'safety'],
    section: 'docs',
  },
  {
    id: 'admin-guide',
    title: 'Admin Guide',
    url: `${DOCS_BASE_URL}/governance/admin-guide`,
    description: 'Admin controls, permissions, and settings.',
    keywords: ['admin', 'permissions', 'settings', 'roles'],
    section: 'docs',
  },
  {
    id: 'multi-surgery-and-rbac',
    title: 'Multi-Surgery & Access',
    url: `${DOCS_BASE_URL}/governance/multi-surgery-and-rbac`,
    description: 'Roles and access across multiple surgeries.',
    keywords: ['rbac', 'roles', 'access', 'multi surgery', 'permissions'],
    section: 'docs',
  },
  {
    id: 'developer-guide',
    title: 'Developer Guide',
    url: `${DOCS_BASE_URL}/technical/developer-guide`,
    description: 'Technical overview for developers.',
    keywords: ['developer', 'architecture', 'api', 'prisma'],
    section: 'docs',
  },
  {
    id: 'release-notes',
    title: 'Release Notes',
    url: `${DOCS_BASE_URL}/release-notes`,
    description: 'Latest updates and improvements.',
    keywords: ['changes', 'updates', 'changelog', 'whats new'],
    section: 'docs',
  },
]

/* ------------------------------------------------------------------ */
/*  External-link arrow icon                                           */
/* ------------------------------------------------------------------ */

function ExternalArrow({ className = 'ml-1 h-3.5 w-3.5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="M7 13l6-6M8 7h5v5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/* ------------------------------------------------------------------ */
/*  A single doc link rendered as a consistent card                    */
/* ------------------------------------------------------------------ */

function LinkCard({ link, onNavigate }: { link: HelpLink; onNavigate: () => void }) {
  return (
    <Card elevation="flat" hoverable padding="none" className="h-full">
      <a
        href={link.url}
        target="_blank"
        rel="noreferrer noopener"
        onClick={onNavigate}
        className="group flex h-full flex-col justify-between rounded-lg p-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-nhs-blue"
      >
        <div>
          <p className="text-sm font-semibold text-nhs-dark-blue group-hover:text-nhs-blue">
            {link.title}
          </p>
          {link.description ? (
            <p className="mt-1 text-xs text-nhs-grey">{link.description}</p>
          ) : null}
        </div>
        <span className="mt-3 inline-flex items-center text-xs font-medium text-nhs-blue">
          Open guide
          <ExternalArrow />
        </span>
      </a>
    </Card>
  )
}

interface HelpPanelProps {
  isOpen: boolean
  onClose: () => void
}

export default function HelpPanel({ isOpen, onClose }: HelpPanelProps) {
  const searchInputRef = useRef<HTMLInputElement>(null)
  const [search, setSearch] = useState('')

  // Reset the search box whenever the panel is closed.
  useEffect(() => {
    if (!isOpen) {
      setSearch('')
    }
  }, [isOpen])

  const query = search.trim().toLowerCase()

  const matchesQuery = useCallback(
    (link: HelpLink) => {
      if (!query) return true
      const haystack = [link.title, link.description, ...link.keywords]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return haystack.includes(query)
    },
    [query]
  )

  const filteredQuickLinks = useMemo(
    () => HELP_LINKS.filter((link) => link.section === 'quick' && matchesQuery(link)),
    [matchesQuery]
  )
  const filteredDocsLinks = useMemo(
    () => HELP_LINKS.filter((link) => link.section === 'docs' && matchesQuery(link)),
    [matchesQuery]
  )

  const totalResults = filteredQuickLinks.length + filteredDocsLinks.length

  const handleLinkClick = () => {
    onClose()
  }

  return (
    <Dialog
      open={isOpen}
      onClose={onClose}
      title="Help & Documentation"
      description="Quick links to guides and common tasks."
      width="3xl"
      initialFocusRef={searchInputRef}
      footer={
        <a
          href={DOCS_BASE_URL}
          target="_blank"
          rel="noreferrer noopener"
          onClick={handleLinkClick}
          className="inline-flex items-center text-sm font-semibold text-nhs-blue hover:text-nhs-dark-blue focus:outline-none focus-visible:ring-2 focus-visible:ring-nhs-blue focus-visible:ring-offset-2 rounded"
        >
          Open full documentation site
          <ExternalArrow className="ml-1 h-4 w-4" />
        </a>
      }
    >
      <div id={HELP_PANEL_ID} className="space-y-8">
        <div>
          <label htmlFor="help-search" className="sr-only">
            Search help links
          </label>
          <div className="relative">
            <Input
              ref={searchInputRef}
              id="help-search"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by topic, task, or keyword"
              className="pr-16"
            />
            {search ? (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-nhs-grey hover:text-nhs-dark-grey underline focus:outline-none focus-visible:ring-2 focus-visible:ring-nhs-blue focus-visible:ring-offset-2 rounded"
              >
                Clear
              </button>
            ) : null}
          </div>
          {query ? (
            <p className="mt-2 text-xs text-nhs-grey" aria-live="polite">
              Showing {totalResults} {totalResults === 1 ? 'result' : 'results'}.
            </p>
          ) : null}
        </div>

        {totalResults === 0 ? (
          <EmptyState
            illustration="search"
            title="No matches found"
            description="Try a different keyword."
          />
        ) : null}

        {filteredQuickLinks.length > 0 ? (
          <section aria-label="Quick links">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-nhs-grey">
              Quick links
            </h3>
            <ul className="mt-3 grid gap-3 sm:grid-cols-2">
              {filteredQuickLinks.map((link) => (
                <li key={link.id} className="h-full">
                  <LinkCard link={link} onNavigate={handleLinkClick} />
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {filteredDocsLinks.length > 0 ? (
          <section aria-label="Documentation sections">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-nhs-grey">
              Documentation sections
            </h3>
            <ul className="mt-3 grid gap-3 sm:grid-cols-2">
              {filteredDocsLinks.map((link) => (
                <li key={link.id} className="h-full">
                  <LinkCard link={link} onNavigate={handleLinkClick} />
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </Dialog>
  )
}
