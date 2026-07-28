# Signposting Toolkit — Resource Register

**Baseline date:** 28 July 2026

This register classifies the older project resources used during the context refresh. It does not delete historical material; it prevents outdated documents being treated as current truth.

| Resource | Classification | Current use |
|---|---|---|
| `PRODUCT_OVERVIEW.md` | Superseded | Replace with `CURRENT_PRODUCT_OVERVIEW.md`; retain only as historical marketing copy |
| `RELEASE_NOTES.md` describing v1.1 as current | Superseded | Use `docs-site/pages/release-notes.mdx` |
| `INFRASTRUCTURE_NOTES.md` describing GitHub Pages `/docs` hosting | Obsolete and potentially hazardous | Do not follow; documentation is now Nextra in `docs-site/` on Vercel |
| `admin_toolkit_design_build_brief.md` | Historical design brief | Useful for original intent, but not current Practice Handbook behaviour |
| `Daily_Dose_Learning_Card_Generator_Spec...md` | Approved specification; implementation status unverified | Use for future Daily Dose work, not as evidence the module is live |
| `WORKFLOW_ENGINE_KNOWLEDGE.md` | Current specialist architecture reference, subject to code verification | Preserve hard-learned React Flow constraints |
| `PROJECT_SUMMARY.md` | Superseded | Replace with current overview and architecture files |
| Old documentation `README.md` referring to GitHub Pages/wiki layout | Superseded | Use root README and `docs-site/` content |
| `Admin Toolkit – Architecture & Behaviour Overview.md` | Partially superseded | Useful historical reference; verify against current Practice Handbook code and release notes |
| `ROADMAP.md` from early 2026 | Superseded as current roadmap | Retain as historical planning record only |

## Labels to use for retained documents

Where historical files remain accessible, add one of these statuses near the top:

- `CURRENT REFERENCE`
- `CURRENT, VERIFY AGAINST CODE`
- `APPROVED SPECIFICATION — NOT YET CONFIRMED LIVE`
- `HISTORICAL DESIGN BRIEF`
- `SUPERSEDED`
- `OBSOLETE — DO NOT FOLLOW`

## Highest-priority retirement

The old infrastructure note must never be used for operational changes. Its GitHub Pages, `/docs`, CNAME and Cloudflare instructions describe a previous deployment model and conflict with the current Vercel-hosted Nextra documentation site.
