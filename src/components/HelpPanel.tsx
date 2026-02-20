'use client'

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

const DOCS_BASE_URL = 'https://docs.signpostingtool.co.uk'
export const HELP_PANEL_ID = 'help-panel'

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea, input:not([disabled]), select, [tabindex]:not([tabindex="-1"])'

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
    id: 'symptom-library',
    title: 'Symptom Library',
    url: `${DOCS_BASE_URL}/features/symptom-library`,
    description: 'Find and manage symptoms safely.',
    keywords: ['symptoms', 'search', 'review', 'highlighting'],
    section: 'quick',
  },
  {
    id: 'practice-handbook',
    title: 'Practice Handbook',
    url: `${DOCS_BASE_URL}/governance/admin-guide#practice-handbook`,
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
    id: 'clinical-governance',
    title: 'Clinical Governance',
    url: `${DOCS_BASE_URL}/governance/clinical-governance`,
    description: 'Clinical review, approvals, and safety.',
    keywords: ['review', 'approval', 'audit', 'safety'],
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
    id: 'ai-features',
    title: 'AI Features',
    url: `${DOCS_BASE_URL}/features/ai-features`,
    description: 'Optional AI tools with safe controls.',
    keywords: ['ai', 'questions', 'instructions', 'review'],
    section: 'quick',
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
    url: `${DOCS_BASE_URL}/RELEASE_NOTES`,
    description: 'Latest updates and improvements.',
    keywords: ['changes', 'updates', 'changelog', 'whats new'],
    section: 'docs',
  },
]

interface HelpPanelProps {
  isOpen: boolean
  onClose: () => void
}

export default function HelpPanel({ isOpen, onClose }: HelpPanelProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)
  const [search, setSearch] = useState('')
  const titleId = useId()
  const descriptionId = useId()

  useEffect(() => {
    if (!isOpen) {
      setSearch('')
      return
    }

    previousFocusRef.current = document.activeElement as HTMLElement | null
    searchInputRef.current?.focus()

    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }

      if (event.key !== 'Tab') {
        return
      }

      const dialog = dialogRef.current
      if (!dialog) {
        return
      }

      const focusableNodes = Array.from(
        dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      ).filter((node) => node.tabIndex !== -1 && !node.hasAttribute('disabled'))

      if (focusableNodes.length === 0) {
        event.preventDefault()
        return
      }

      const first = focusableNodes[0]
      const last = focusableNodes[focusableNodes.length - 1]
      const isShiftPressed = event.shiftKey
      const activeElement = document.activeElement as HTMLElement | null

      if (!activeElement) {
        return
      }

      if (!isShiftPressed && activeElement === last) {
        event.preventDefault()
        first.focus()
        return
      }

      if (isShiftPressed && activeElement === first) {
        event.preventDefault()
        last.focus()
      }
    }

    document.addEventListener('keydown', handleKeydown)
    return () => {
      document.removeEventListener('keydown', handleKeydown)
      if (previousFocusRef.current) {
        previousFocusRef.current.focus()
      }
    }
  }, [isOpen, onClose])

  const query = search.trim().toLowerCase()
  const quickLinks = useMemo(
    () => HELP_LINKS.filter((link) => link.section === 'quick'),
    []
  )
  const docsLinks = useMemo(
    () => HELP_LINKS.filter((link) => link.section === 'docs'),
    []
  )

  const matchesQuery = useCallback((link: HelpLink) => {
    if (!query) return true
    const haystack = [
      link.title,
      link.description,
      ...link.keywords,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
    return haystack.includes(query)
  }, [query])

  const filteredQuickLinks = useMemo(
    () => quickLinks.filter(matchesQuery),
    [quickLinks, matchesQuery]
  )
  const filteredDocsLinks = useMemo(
    () => docsLinks.filter(matchesQuery),
    [docsLinks, matchesQuery]
  )

  const totalResults = filteredQuickLinks.length + filteredDocsLinks.length

  const handleLinkClick = () => {
    onClose()
  }

  if (!isOpen) {
    return null
  }

  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-start justify-center p-4 sm:p-6">
      <div
        className="absolute inset-0 bg-slate-900/40"
        aria-hidden="true"
        onClick={onClose}
      />
      <div
        ref={dialogRef}
        id={HELP_PANEL_ID}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="relative w-full max-w-3xl max-h-[90vh] overflow-hidden rounded-2xl bg-white shadow-xl focus:outline-none"
        onClick={(event) => event.stopPropagation()}
        tabIndex={-1}
      >
        <div className="flex items-start justify-between gap-4 border-b border-gray-200 px-6 py-4">
          <div className="flex-1">
            <h2 id={titleId} className="text-lg font-semibold text-nhs-dark-blue">
              Help & Documentation
            </h2>
            <p id={descriptionId} className="mt-2 text-sm text-nhs-grey">
              Quick links to guides and common tasks.
            </p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-nhs-grey hover:text-nhs-dark-grey focus:outline-none focus:ring-2 focus:ring-nhs-blue"
            aria-label="Close help panel"
          >
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path
                d="M5 5l10 10M15 5 5 15"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>

        <div className="max-h-[calc(90vh-4.5rem)] overflow-y-auto px-6 py-6">
          <div className="space-y-8">
            <div>
              <label htmlFor="help-search" className="sr-only">
                Search help links
              </label>
              <div className="relative">
                <input
                  ref={searchInputRef}
                  id="help-search"
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search by topic, task, or keyword"
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-nhs-grey focus:outline-none focus:ring-2 focus:ring-nhs-blue focus:border-transparent"
                />
                {search ? (
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-nhs-grey hover:text-nhs-dark-grey underline focus:outline-none focus:ring-2 focus:ring-nhs-blue focus:ring-offset-2 rounded"
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
              <div className="rounded-lg border border-dashed border-gray-300 px-4 py-6 text-center text-sm text-nhs-grey">
                No matches found. Try a different keyword.
              </div>
            ) : null}

            {filteredQuickLinks.length > 0 ? (
              <section aria-label="Quick links">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-nhs-grey">
                  Quick links
                </h3>
                <ul className="mt-3 grid gap-3 sm:grid-cols-2">
                  {filteredQuickLinks.map((link) => (
                    <li key={link.id} className="h-full">
                      <a
                        href={link.url}
                        target="_blank"
                        rel="noreferrer noopener"
                        onClick={handleLinkClick}
                        className="group flex h-full flex-col justify-between rounded-lg border border-gray-200 bg-white p-4 text-left transition hover:border-nhs-blue hover:bg-nhs-light-grey focus:outline-none focus:ring-2 focus:ring-nhs-blue"
                      >
                        <div>
                          <p className="text-sm font-semibold text-nhs-dark-blue group-hover:text-nhs-blue">
                            {link.title}
                          </p>
                          {link.description ? (
                            <p className="mt-1 text-xs text-nhs-grey">
                              {link.description}
                            </p>
                          ) : null}
                        </div>
                        <span className="mt-3 inline-flex items-center text-xs font-medium text-nhs-blue">
                          Open guide
                          <svg
                            className="ml-1 h-3.5 w-3.5"
                            viewBox="0 0 20 20"
                            fill="none"
                            aria-hidden="true"
                          >
                            <path
                              d="M7 13l6-6M8 7h5v5"
                              stroke="currentColor"
                              strokeWidth="1.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </span>
                      </a>
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
                <ul className="mt-3 space-y-3">
                  {filteredDocsLinks.map((link) => (
                    <li key={link.id} className="rounded-lg border border-gray-200 p-3">
                      <a
                        href={link.url}
                        target="_blank"
                        rel="noreferrer noopener"
                        onClick={handleLinkClick}
                        className="text-sm font-semibold text-nhs-blue hover:text-nhs-dark-blue underline focus:outline-none focus:ring-2 focus:ring-nhs-blue focus:ring-offset-2 rounded"
                      >
                        {link.title}
                      </a>
                      {link.description ? (
                        <p className="mt-1 text-xs text-nhs-grey">
                          {link.description}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            <div className="rounded-lg border border-nhs-light-blue bg-nhs-light-blue/30 p-4">
              <p className="text-sm text-nhs-grey">
                Need the full documentation library?
              </p>
              <a
                href={DOCS_BASE_URL}
                target="_blank"
                rel="noreferrer noopener"
                onClick={handleLinkClick}
                className="mt-2 inline-flex items-center text-sm font-semibold text-nhs-blue hover:text-nhs-dark-blue underline focus:outline-none focus:ring-2 focus:ring-nhs-blue focus:ring-offset-2 rounded"
              >
                Open full documentation site
                <svg
                  className="ml-1 h-4 w-4"
                  viewBox="0 0 20 20"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M7 13l6-6M8 7h5v5"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
