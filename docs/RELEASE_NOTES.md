# Signposting Toolkit — Release Notes

A high-level history of major changes.

---

## Unreleased

- Updated the Admin Dashboard **Quick Access** settings to make it simpler to choose up to 6 buttons for the staff home screen.
- Admin Toolkit admin page reorganised into Items / Structure & Settings tabs for clarity.
- Added **Admin Toolkit** (feature-flagged) for surgery-specific guidance pages, a pinned panel, and a simple “GP taking on” rota.
- Admin Toolkit: added seeding for the **global defaults** surgery so it can act as a starter-kit template source for new surgeries.
- Admin Toolkit: when enabled for an empty surgery, a starter kit is now added automatically (pinned panel and rota remain blank).
- Admin Toolkit: added **LIST** items (simple editable tables) for storing structured information.
- Admin Toolkit: removed the temporary global-defaults seeding button from the admin dashboard.
- Admin Toolkit: settings cog moved to page header (consistent with main signposting tool) and opens the shared preferences dialog; blue cards mode now only affects individual item cards, not the surrounding container.
- Admin Toolkit settings: improved the Items picker with search, type filters, and grouped (collapsible) sections by category.
- Admin Toolkit settings: the editor now opens ready to create a new item by default (no previous item auto-selected).

---

## v1.2 — Workflow Guidance Module (Jan 2026)

### ✨ New
- **Workflow Guidance Module (Initial Release)**
  - Visual workflow guidance engine
  - Global default workflows
  - Per-surgery customisation
  - Draft / Approved governance lifecycle
  - Feature-flag controlled rollout
- Added a public FAQs page covering setup, governance, and optional AI tools (linked from the marketing navigation).
- Redesigned marketing landing page with clearer hero, benefits strip, and 3-step "How it works" section.
- Added trust section highlighting GP-built origins and local clinical control.
- User Guide link restored in marketing site navigation alongside Docs link.
- Workflow Guidance Module (Initial Release)
  - Visual workflow guidance engine
  - Global Default workflows
  - Per-surgery customisation
  - Draft / Approved governance lifecycle
  - Feature-flag controlled rollout

### 🧹 Updated
- Workflow diagram viewer restores connector lines, arrowheads, and labels for saved and newly created edges.
- Workflow diagram details panel can be collapsed to give more space for the diagram.
- Landing page now frames AI as optional tools, adds onboarding and support copy, and links to the FAQs for common governance questions.
- AI questions panel now titled "Suggested wording for questions to ask" with supporting text to encourage safe, consistent phrasing.
- Clicking the Signposting Toolkit logo now keeps you within your current surgery, using `/s` as a safer signed-in entry route.
- Symptom page links now use the same surgery identifier as the main `/s/[id]` routes, with older links automatically redirected.
- Surgery admins can now apply AI wording suggestions within their own surgery (superusers remain supported).
- Admin forms no longer ask for symptom slugs — slugs are generated automatically, and high-risk buttons now link to symptoms via a searchable list.
- Symptom search and clinical review counts now refresh immediately after creating, approving, enabling, or deleting symptoms.
- Highlight rules in the Admin Dashboard can now be edited (instead of delete-and-recreate), with clearer guidance when a phrase already exists.
- Marketing and app domains separated: www.signpostingtool.co.uk shows the public site while app.signpostingtool.co.uk routes straight into the toolkit entry screen.
- Marketing site hero updated with new headline: "The GP Signposting Toolkit for safer, faster care navigation".
- "Why practices choose" section condensed and moved higher on the landing page.
- Docs site logo now links to www.signpostingtool.co.uk (marketing homepage).
- All marketing site CTAs verified to use app.signpostingtool.co.uk.
- Workflow diagram viewer restores connector lines, arrowheads, and labels for saved and newly created edges.
- Workflow diagram details panel can be collapsed to give more space for the diagram.

---

## v1.1 — Current Release (Dec 2025)

### ✨ New
- **AI Suggested Questions** panel added.
- New symptom detail page layout.
- Appointment Directory promoted to top navigation.
- Preferences system added:
  - Modern vs Classic cards
  - Quick-scan mode
  - Header layouts
  - High-risk button selection
- Highlight engine improved (orange/red/pink/purple/green).

### 🧹 Updated
- Symptom library list UI: improved table, new badges, cleaner actions.
- Admin dashboard reorganised.
- Improved age filters and high-risk filters.
- Revised user roles display.
- Added clear links from the main app to the documentation site.

### ❌ Removed
- Old AI Training Mode / quiz module.

---

## v1.0 — Web Release (Oct–Nov 2025)

### ✨ New
- First full web version
- Clinical Review workflow
- Multi-surgery tenancy
- Engagement tracking
- Feature flags
- AI Instruction Editor
- Improved admin dashboard
- User management redesign

---

## Pre-2025 — Beta and Prototypes

### PowerApps Version
Internal prototype used at Ide Lane Surgery.
