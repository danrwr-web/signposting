Internal reference for ChatGPT, Cursor, and future maintainers

🏗️ Infrastructure Overview

This project uses the following hosting setup:

Documentation site (Nextra) is deployed on Vercel from the `docs-site/`
project, at:

URL: https://docs.signpostingtool.co.uk


DNS hosting is managed via Cloudflare, not Fasthosts.

Application hosting (production app) is deployed on Vercel.

Database is hosted on Neon Postgres.

Any future configuration changes must respect this architecture unless explicitly revised.

Note: the docs previously ran as a Jekyll/GitHub Pages site served from a
`/docs` folder. That has been retired — the docs are now the Nextra `docs-site/`
project on Vercel. See the revision log at the bottom.

🌐 DNS Configuration (Cloudflare)

Important: This project uses Cloudflare DNS.
Do not instruct the user to modify DNS at Fasthosts — those records are no longer authoritative.

The `docs` record points at the Vercel deployment for `docs-site/`. (It previously
pointed at `danrwr-web.github.io` for GitHub Pages; that is no longer the case.)

Trailing dots MUST NOT be used (Cloudflare treats them differently than some DNS providers).

🧰 Deployment Pipeline Notes
App & Docs Hosting (Vercel)

Production deployments come from the main branch.

Preview deployments come from PR branches.

The docs site (`docs-site/`) is a separate Vercel project deployed the same way.

Database (Neon Postgres)

Prisma migrations apply automatically via Vercel build or by running the seed scripts.

No secrets appear in the repository.

## One-off migration: move workflows to Global Default (GitHub Actions)

This repo includes a one-off workflow migration script (`scripts/migrateWorkflowsToGlobalDefault.ts`) and a manual GitHub Actions workflow to run it.

### Prerequisites

- Ensure the repository has an Actions secret named **`DATABASE_URL`** pointing at the correct Neon Postgres database.

### Run (DRY RUN first)

1. GitHub → **Actions**
2. Select **“Migrate workflows to Global Default (one-off)”**
3. Click **Run workflow**
4. Leave **`dry_run` = true** and run it
5. Review the logs (it prints the templates it would move)

### Run (real migration)

1. Run the workflow again with **`dry_run` = false**
2. Set **`confirm`** to exactly:

MOVE_WORKFLOWS_TO_GLOBAL_DEFAULT

If `confirm` does not match exactly, the workflow will fail early and do nothing.

### After running

- Check Global Default templates list shows the moved workflows
- Check Ide Lane no longer owns those workflows (unless it has overrides)
- Open a migrated workflow diagram and confirm nodes/links are intact

## Workflow Guidance Governance Model

Workflow Guidance follows the same governance principles as the Signposting Toolkit.

Global Default workflows
	•	Stored under the global-default-buttons surgery
	•	Maintained centrally by superusers
	•	Act as the base template for all surgeries

Surgery-specific overrides
	•	Created by copying a Global Default workflow
	•	Linked via sourceTemplateId
	•	Allow local adaptation without affecting the global template

Approval lifecycle
	•	All workflows start in DRAFT
	•	Only APPROVED workflows are visible to staff
	•	Editing an approved workflow automatically reverts it to DRAFT

Audit metadata
	•	Approved by
	•	Approved at
	•	Last edited by
	•	Last edited at

Feature gating
	•	Workflow Guidance is enabled per surgery using existing feature flags
	•	If disabled, workflows are not visible to staff or linked from signposting

📚 Documentation

Documentation resides entirely in the Nextra docs site:

docs-site/pages/          (MDX pages, file-based routing)
docs-site/pages/release-notes.mdx


Sidebar structure is defined by `_meta.ts` files in each folder. See
`docs-site/CLAUDE.md` for the conventions.

When user-facing features are added/changed, update the relevant page(s) under
`docs-site/pages/`, add an entry to `docs-site/pages/release-notes.mdx`, and bump
the version banner on `docs-site/pages/index.mdx`. The `docs-reminder.yml`
GitHub Action nudges PRs that change user-facing code without touching
`docs-site/`.

✉️ Public Contact Email

The public-facing project contact is:

contact@signpostingtool.co.uk


This email forwards to the NHS account,
and should be used in:

README

documentation

landing pages

No personal email addresses should appear in the codebase.

🔑 RBAC Notes

No authentication logic must reference personal emails.
All admin privileges are determined exclusively through RBAC:

superuser

surgery-admin

standard-user

Cursor has already replaced all hard-coded email-based permission checks.

❗ Things to avoid in future changes

These points prevent common breakages when making updates:

❌ Do NOT:

Add environment variables or credentials to the repo

Reintroduce personal emails into authorization logic

Create documentation outside the `docs-site/` project

✔ DO:

Update documentation when any user-facing feature changes

Keep docs images in `docs-site/public/images/`

Keep the contact email consistent

Ensure Cursor rules remain aligned with the project structure

📝 Revision Log

Use this section to track changes if needed.

2025-02-XX — Initial creation (ChatGPT)

2026-07-23 — Retired the legacy Jekyll/GitHub-Pages `/docs` site. The docs are
now the Nextra `docs-site/` project deployed on Vercel; the `/docs` tree and its
CNAME were removed. Updated the infrastructure, DNS, deployment, and
documentation sections accordingly.

Add entries as future infrastructure changes are made.