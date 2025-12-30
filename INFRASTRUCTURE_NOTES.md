Internal reference for ChatGPT, Cursor, and future maintainers

🏗️ Infrastructure Overview

This project uses a hybrid hosting setup:

Frontend documentation (Wiki-style docs) is served via GitHub Pages, from:

Branch: main
Folder: /docs
URL: https://docs.signpostingtool.co.uk


DNS hosting is managed via Cloudflare, not Fasthosts.

Application hosting (production app) is deployed on Vercel.

Database is hosted on Neon Postgres.

Any future configuration changes must respect this architecture unless explicitly revised.

🌐 DNS Configuration (Cloudflare)

Important: This project uses Cloudflare DNS.
Do not instruct the user to modify DNS at Fasthosts — those records are no longer authoritative.

Current key DNS records
Type: CNAME
Name: docs
Content: danrwr-web.github.io
Proxy status: DNS only (must NOT be proxied)


Notes:

The Cloudflare “orange cloud” must remain OFF for GitHub Pages.

Trailing dots MUST NOT be used (Cloudflare treats them differently than some DNS providers).

DNS-only mode is required for GitHub Pages to issue SSL certificates.

📄 GitHub Pages Configuration

The site is served from:

Repository → Settings → Pages
Source: Deploy from a branch
Branch: main
Folder: /docs
Custom domain: docs.signpostingtool.co.uk
Enforce HTTPS: enabled

Required file

A file named:

docs/CNAME


containing exactly:

docs.signpostingtool.co.uk


This file must always exist.
GitHub relies on it for domain validation and SSL renewal.

🔒 SSL / HTTPS Notes

GitHub provisions TLS certificates automatically.
Common certificate states:

Authorization created

Certificate issued

Certificate active

If DNS is ever changed, GitHub may need to revalidate the domain.
If validation fails, the SSL box will become disabled temporarily.

🧰 Deployment Pipeline Notes
App Hosting (Vercel)

Production deployments come from the main branch.

Preview deployments come from PR branches.

Do not rely on GitHub Pages for hosting the main application — only docs.

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

📚 Documentation & Wiki Automation

Documentation resides entirely in:

/docs
/docs/wiki


Navigation blocks must remain consistent across all wiki pages.
Cursor rule responsible:

.cursor/rules/wiki-updates.mdc


This rule enforces:

consistent navigation blocks

screenshot sections

cross-linking

updates to Project Summary, Roadmap, Release Notes

When features are added/changed, the rule prompts updating docs.

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

Add Cloudflare “proxying” to any GitHub Pages-related DNS record

Place the CNAME file anywhere except /docs/CNAME

Remove or rename /docs as the GitHub Pages source folder

Add environment variables or credentials to the repo

Reintroduce personal emails into authorization logic

Create duplicate documentation outside /docs/wiki

✔ DO:

Update documentation when any user-facing feature changes

Keep screenshots in docs/wiki/images/

Maintain stable navigation blocks for all wiki pages

Keep the contact email consistent

Ensure Cursor rules remain aligned with the project structure

📝 Revision Log

Use this section to track changes if needed.

2025-02-XX — Initial creation (ChatGPT)

Add entries as future infrastructure changes are made.