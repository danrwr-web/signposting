# Signposting Toolkit — Current Architecture

**Baseline date:** 28 July 2026

## Source repositories and deployments

The product and documentation live in the same GitHub repository:

- Repository: `danrwr-web/signposting`
- Default branch: `main`

There are two Vercel projects:

1. `signposting` — the main application
2. `signposting-docs` — the public documentation site

The documentation site is a Nextra application in `docs-site/`. It is not served from `/docs` by GitHub Pages.

## Main application

- Framework: Next.js 15 App Router
- Language: TypeScript
- UI: React 18 and Tailwind CSS
- Database: PostgreSQL on Neon via Prisma 6
- Authentication: NextAuth 4, credentials provider, JWT sessions
- Validation: Zod
- Rich text: TipTap / ProseMirror
- Workflow canvas: React Flow
- AI: Azure OpenAI integration
- Hosting: Vercel

## Application structure

The main surgery-scoped application lives beneath `/s/[id]/...` and uses a shared application shell.

Key route areas include:

- `/s/[id]/signposting`
- `/s/[id]/appointments`
- `/s/[id]/clinical-review`
- `/s/[id]/admin-toolkit`
- `/s/[id]/workflow`
- `/s/[id]/analytics`
- `/s/[id]/admin/...`
- `/s/[id]/dashboard`

System-level functionality lives principally beneath `/admin/system` and `/super`.

## Shared application shell

All ordinary surgery-scoped pages must preserve:

- Standard header
- Current-surgery context
- Universal slide-out navigation
- Shared spacing, interaction and UI primitives

True full-screen editors are the only likely exception and must be explicitly justified.

## Multi-tenancy and RBAC

Each surgery is an isolated tenant. Surgery-specific data is scoped using `surgeryId` in application queries.

Role hierarchy:

- `SUPERUSER` — system-wide administration
- `ADMIN` — practice-level administration
- `STANDARD` — routine staff use

Permissions are enforced server-side as well as in the interface. No authorisation logic should depend on personal email addresses.

## Content resolution

Symptoms and workflows follow a base-plus-override model:

- Shared base content
- Practice-specific override
- Practice-created content

For symptom instructions, `instructionsHtml` is the canonical editable format. Legacy plain-text or ProseMirror fields must not be mistaken for the primary source.

## Feature flags

Feature access is database driven:

- Surgery-level feature flag
- Optional user-level override, dependent on the surgery flag

Documentation must not assume that every released feature is enabled for every surgery.

## Documentation architecture

The public documentation is located in:

- `docs-site/pages/`
- `docs-site/public/images/`

Documentation conventions:

- Nextra 3
- Sidebar metadata in `_meta.ts`
- Absolute internal links
- Release notes at `docs-site/pages/release-notes.mdx`
- Version banner on the documentation home page
- Automatic git-derived update timestamps

Do not:

- Recreate a GitHub Pages pipeline
- Add a `/docs/CNAME` file
- Treat `/docs` as the live documentation source
- Add manually maintained “Last updated” footers

## Deployment and environments

- Production app deployments originate from the main application Vercel project
- Documentation deployments originate from the separate documentation Vercel project
- Pull-request branches produce preview deployments through Vercel’s Git integration
- Secrets and environment variables belong in deployment configuration, never in the repository

## External data and services

Current integrations visible in the product and repository include:

- Neon Postgres
- Azure OpenAI
- NHS ODS practice directory lookup
- NHS monthly practice list-size data
- Email notifications for selected app-level feedback workflows

Any additional integration should be verified in code before being described as current.

## Current architecture guardrails

1. Let React Flow own workflow-canvas geometry.
2. Use shared UI primitives rather than creating parallel modal, input or table systems.
3. Preserve tenant scoping on every surgery-specific query.
4. Treat Practice Handbook as the user-facing name while preserving legacy route/model identifiers where required.
5. Update the Nextra documentation and release notes when user-facing behaviour changes.
6. Do not place credentials, environment values or personal-email authorisation checks in source control.
