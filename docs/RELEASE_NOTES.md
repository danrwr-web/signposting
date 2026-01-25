# Signposting Toolkit — Release Notes

A high-level history of major changes.

---

## Unreleased

### 🧹 Updated

- Navigation: **Help & Documentation** now opens an in-app help panel with quick links and search; the full docs site still opens in a new tab.

---

## Baseline Platform (as of January 2026)

The following core capabilities are established and available to all surgeries:

- **Signposting Toolkit** — Symptom library with 200+ base symptoms, local overrides, and custom symptom creation
- **Appointment Directory** — Searchable catalogue of local services and appointment types
- **Clinical Review Workflow** — Mandatory draft/approved lifecycle with audit metadata for all symptom changes
- **Multi-surgery Tenancy** — Complete data isolation between practices with independent configurations
- **Role-based Access Control** — Three-level hierarchy: Superuser / Surgery Admin / Standard user
- **Feature Flags System** — Per-surgery and per-user feature enablement
- **Universal Navigation** — Shared app shell with slide-out navigation panel across all modules
- **Preferences System** — User preferences for card styles, quick-scan mode, header layouts, and high-risk button selection
- **High-risk Flags and Highlighting** — Automatic colour-coding for urgent phrases and high-risk symptoms
- **AI Instruction Editor** — AI-powered tools to improve instruction clarity (feature-flagged, requires clinical review)
- **AI Suggested Questions** — Generates grouped triage-style questions (feature-flagged, requires clinical review)
- **Engagement Tracking** — Usage analytics for symptoms and features

---

## v1.3 — Current Release (January 2026)

### ✨ New

- Practice Handbook: added **Engagement** tab showing most viewed items and most active users, filterable by time period (7d / 30d / 90d / all time) — helps admins understand what content is being used.
- Practice Handbook: added **Audit** tab showing a chronological feed of recent changes (who changed what, when), filterable by time period and change type — supports governance and troubleshooting.
- Practice Handbook (formerly Admin Toolkit): operational info panel at the bottom of the staff front page is now collapsible (defaults to collapsed). The panel automatically expands when the on-take GP changes, and remembers your preference.
- Practice Handbook: added category visibility controls and per-item editing permissions, so you can safely share sensitive guidance with the right people and let standard users edit specific items without access to the admin dashboard.
- Practice Handbook: PAGE items now support optional Intro text above Role Cards and Additional notes below.
- Practice Handbook: added LIST items (simple editable tables) for storing structured information.

### 🧹 Updated

- Practice Handbook: updated Quick Access settings to make it simpler to choose up to 6 buttons for the staff home screen.
- Practice Handbook: admin page reorganised into Items / Structure & Settings tabs for clarity.
- Practice Handbook: settings cog moved to page header (consistent with main signposting tool) and opens the shared preferences dialog; blue cards mode now only affects individual item cards, not the surrounding container.
- Practice Handbook: improved the Items picker with search, type filters, and grouped (collapsible) sections by category.
- Practice Handbook: the editor now opens ready to create a new item by default (no previous item auto-selected).
- Practice Handbook: "Structure & Settings" is now laid out as a cleaner settings dashboard with section navigation.
- Practice Handbook: categories are searchable with clearer hierarchy and controls; pinned panel includes a preview; rota "upcoming weeks" is now collapsible.
- Practice Handbook: restored sticky categories sidebar and pinned bottom panel on the front page (with natural page scrolling).
- Practice Handbook: improved Quick access buttons with a scalable searchable picker and optional labels (defaults to the target item title).
- Practice Handbook: Quick access buttons now auto-save changes to avoid an extra "Save" step.
- Practice Handbook: Role cards now respect blue-cards mode and the editor auto-expands when populated.
- Workflow Guidance: workflow diagram viewer restores connector lines, arrowheads, and labels for saved and newly created edges.
- Workflow Guidance: workflow diagram details panel can be collapsed to give more space for the diagram.
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

### ❌ Fixed

- Practice Handbook: fixed Role cards auto-expand when opening via "Edit", and fixed Quick access button reordering persistence.

---

## Foundation Releases (Historical)

### v1.2 — Workflow Guidance Module (January 2026)

- **Workflow Guidance Module** — Visual workflow guidance engine with global default workflows, per-surgery customisation, draft/approved governance lifecycle, and feature-flag controlled rollout
- Added a public FAQs page covering setup, governance, and optional AI tools (linked from the marketing navigation)
- Redesigned marketing landing page with clearer hero, benefits strip, and 3-step "How it works" section
- Added trust section highlighting GP-built origins and local clinical control
- User Guide link restored in marketing site navigation alongside Docs link

### v1.1 — Current Release (December 2025)

- **AI Suggested Questions** panel added
- New symptom detail page layout
- Appointment Directory promoted to top navigation
- Preferences system added: Modern vs Classic cards, Quick-scan mode, Header layouts, High-risk button selection
- Highlight engine improved (orange/red/pink/purple/green)
- Symptom library list UI: improved table, new badges, cleaner actions
- Admin dashboard reorganised
- Improved age filters and high-risk filters
- Revised user roles display
- Added clear links from the main app to the documentation site
- Removed old AI Training Mode / quiz module

### v1.0 — Web Release (October–November 2025)

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
