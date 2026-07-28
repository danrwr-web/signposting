# Signposting Toolkit — Sources of Truth

**Baseline date:** 28 July 2026

## Purpose

The project has accumulated design briefs, implementation notes, release histories and AI context files from different stages of development. This document defines which source should win when they disagree.

## Authority order

Use this order for questions about current behaviour:

1. **Verified production behaviour**
2. **Code on the current production branch**
3. **Current public Nextra documentation**
4. **Current release notes**
5. **Current files in `project-context/`**
6. **Approved implementation specifications**
7. **Historical design briefs, roadmaps and archived project uploads**

A lower-ranked source must not silently override a higher-ranked source.

## Different questions have different primary sources

| Question | Primary source |
|---|---|
| What does the live app currently do? | Production behaviour, then production-branch code |
| What changed in a release? | `docs-site/pages/release-notes.mdx` and merged PR history |
| How should developers implement something? | Current code, root `CLAUDE.md`, tests and module architecture notes |
| How is the product deployed? | Vercel project configuration and current repository structure |
| What should users be told? | Current public documentation and verified app behaviour |
| Is a future feature committed? | Current roadmap or approved specification, clearly labelled as planned |
| Why was an unusual technical decision made? | Current module-specific architecture/behaviour notes |

## Required verification

Before making material statements about the present application, verify at least one current source when the information could have changed, especially for:

- Current release number
- Module availability
- Feature flags
- Routes and navigation
- Authentication and permissions
- Deployment architecture
- External services
- Clinical-review behaviour
- Notification and email routing
- Pricing, trials or sales-pipeline behaviour

## Documentation rules

- Public user and administrator guidance belongs in `docs-site/`.
- Developer-wide conventions belong in the root `CLAUDE.md` or an appropriately scoped code-adjacent document.
- Concise cross-cutting current context belongs in `project-context/`.
- Historical design documents should remain available only when their status is explicit.
- Do not duplicate full public documentation inside project context files.

## Terminology conflicts

When user-facing and internal names differ:

- Use the current user-facing name in prose.
- Mention the legacy/internal identifier only when technically relevant.

Example: **Practice Handbook** is the current product name; `admin-toolkit` remains in routes and code.

## Handling uncertainty

When sources conflict and production cannot be checked:

1. State the conflict.
2. Prefer the highest-ranked current source.
3. Mark the conclusion as provisional.
4. Create a verification task or issue rather than presenting an assumption as fact.

## AI assistant instruction

AI assistants must not use an old uploaded brief as proof that a feature is currently live. They should use old specifications to understand design intent, edge cases and historical constraints, while checking current code or documentation for implementation status.