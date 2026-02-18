# Documentation vs Application Audit Report

**Date:** 2026-02-18
**Scope:** All pages in `docs-site/pages/` compared against actual application code

---

## Summary Table

| # | Page / Feature | Status | Issue |
|---|---|---|---|
| 1 | `index.mdx` — Landing page | 🟢 OK | Complete. Version v1.3, Jan 2026. |
| 2 | `features/symptom-library.mdx` | 🟢 OK | Accurately describes base/override/custom model, age filters, search, cards. |
| 3 | `features/appointment-directory.mdx` | 🟢 OK | Covers core features, CSV import, staff teams, filtering. |
| 4 | `features/high-risk-and-highlighting.mdx` | 🟢 OK | Thorough coverage of highlight engine, high-risk buttons, WCAG compliance. |
| 5 | `features/ai-features.mdx` | 🟡 INCOMPLETE | Documents `ai_instructions`, `ai_questions`, `smart_symptom_updates` well. **Missing:** `ai_surgery_customisation` feature flag and the entire AI Setup page (`/s/[id]/admin/ai-setup`). Also missing `ai_training` flag (which is what `ai_questions` actually uses in code). |
| 6 | `features/workflow-guidance.mdx` | 🟡 INCOMPLETE | Only 58 lines. Missing: how to create workflows, node type reference (INSTRUCTION/QUESTION/END/PANEL/REFERENCE), canvas controls, action keys (FORWARD_TO_GP, etc.), workflow instances, example workflows, engagement tracking. |
| 7 | `getting-started/index.mdx` | 🟡 INCOMPLETE | Good 10-step setup guide. References "Setup & onboarding section in Practice settings" but never explains that UI. The onboarding wizard (`/s/[id]/admin/onboarding`) with its 7-step profile is not documented. |
| 8 | `getting-started/user-guide.mdx` | 🟢 OK | Practical reception staff reference. |
| 9 | `getting-started/day-to-day-use.mdx` | 🟢 OK | Task-oriented quick reference. |
| 10 | `governance/clinical-governance.mdx` | 🟢 OK | Thorough governance framework. |
| 11 | `governance/multi-surgery-and-rbac.mdx` | 🟡 INCOMPLETE | Documents roles and feature flags well. **Missing:** `ai_surgery_customisation` and `ai_training` flags. |
| 12 | `governance/admin-guide.mdx` | 🟡 INCOMPLETE | Only 88 lines. Covers Practice Handbook admin and brief Workflow Guidance/Quick Access sections. **Missing 12 major admin topics** (see details below). |
| 13 | `technical/developer-guide.mdx` | 🟢 OK | Comprehensive developer reference with architecture, setup, conventions. |

---

## Missing Features — No Documentation At All

| # | Feature | App Location | What It Does | Priority |
|---|---|---|---|---|
| 14 | **Analytics Dashboard** | `/s/[id]/analytics` | Surgery-level usage analytics: 7/30-day view counts per module, top symptoms/pages/workflows, staff usage. Admin+superuser only. | 🔴 HIGH |
| 15 | **AI Surgery Customisation** | `/s/[id]/admin/ai-setup` | Batch AI rewriting of symptom instructions based on surgery's onboarding profile. Three scopes: all/core/manual. Progress tracking. Requires onboarding completion. | 🔴 HIGH |
| 16 | **Onboarding Wizard** | `/s/[id]/admin/onboarding` | 7-step setup wizard: practice overview, appointment types, team structure, safety & escalation, local services, communication preferences, final settings. Saves to `SurgeryOnboardingProfile`. | 🔴 HIGH |
| 17 | **What's Changed (Symptoms)** | `/s/[id]/signposting/changes` | Recently modified symptoms with configurable time window, filters by new vs updated, shows age group and source. | 🔴 HIGH |
| 18 | **What's Changed (Handbook)** | `/s/[id]/admin-toolkit/changes` | Recently modified handbook items. Same pattern as symptom changes. | 🔴 MEDIUM |
| 19 | **User Suggestions** | `SuggestionModal` + admin analytics | Staff submit improvement suggestions on symptoms. Admins view, action, discard. Status tracking (pending/actioned/discarded). Audit trail. | 🔴 MEDIUM |
| 20 | **Image Icons** | Admin settings + `ImageIcon` model | Phrase-triggered visual icons on symptom cards. Superuser creates, surgery admin toggles. Configurable sizes for cards vs instruction pages. | 🔴 MEDIUM |
| 21 | **Setup Checklist** | `/s/[id]/admin/setup-checklist` | Onboarding progress tracker: completion status, appointment model config, AI customisation status, pending reviews. | 🟡 LOW |
| 22 | **System Management (Superuser)** | `/admin/system/*` | AI usage monitoring, system-wide changes, global defaults, feature rollouts. | 🟡 LOW (superuser-only) |
| 23 | **Practice Settings UI** | `/admin/practice/*` | Module access control, feature toggles, logo config. | 🟡 LOW |

---

## Detailed Issues by Page

### `features/ai-features.mdx` — 🟡 INCOMPLETE

The page is well-written for the features it covers, but has two gaps:

1. **Missing `ai_surgery_customisation` flag.** The app has a full AI Setup page at `/s/[id]/admin/ai-setup` where admins batch-rewrite symptoms using their onboarding profile. This is a significant feature with its own route, progress UI, and scope controls — completely absent from docs.

2. **Feature flag naming mismatch.** The docs list `ai_questions` as a flag, but in code the actual flag key is `ai_training` (see `src/lib/ensureFeatures.ts:17`). The `ai_training` flag controls "AI question prompts". This could confuse developers or admins checking feature flags in the database.

---

### `features/workflow-guidance.mdx` — 🟡 INCOMPLETE

At 58 lines, this is the thinnest feature page. Missing:

- **Node types**: The schema defines INSTRUCTION, QUESTION, END, PANEL, REFERENCE node types — none are explained
- **Action keys**: FORWARD_TO_GP, FORWARD_TO_PRESCRIBING_TEAM, FORWARD_TO_PHARMACY_TEAM, FILE_WITHOUT_FORWARDING, ADD_TO_YELLOW_SLOT, SEND_STANDARD_LETTER, CODE_AND_FILE, OTHER — these are workflow outcomes users select
- **Workflow instances**: How staff actually run a workflow (`/s/[id]/workflow/start`, `/s/[id]/workflow/instances/[id]`)
- **Canvas controls**: How admins build workflows on the React Flow canvas
- **Engagement analytics**: `/s/[id]/workflow/admin/engagement`
- **Node styling**: `/s/[id]/workflow/admin/styles` — surgery-wide defaults
- **Creating/editing workflows step-by-step**
- **Example workflow walkthrough**

---

### `governance/admin-guide.mdx` — 🟡 INCOMPLETE

This page has the biggest gap. It's titled "Admin Guide" but only covers Practice Handbook admin + brief Workflow/Quick Access notes (88 lines). **Missing entire admin topics:**

1. **Symptom management** — creating custom symptoms, editing overrides, hiding base symptoms
2. **Clinical review workflow** — how admins submit, approve, reject symptoms
3. **User management** — creating users, assigning roles, multi-surgery memberships, password resets
4. **Appointment directory management** — creating/editing appointment types, managing staff teams, CSV import
5. **Highlight rules configuration** — creating custom highlight rules, enabling/disabling built-in slots
6. **High-risk button configuration** — configuring the quick-access buttons (max 6, ordering, custom labels)
7. **Feature flag management** — enabling/disabling features for the surgery via Practice Settings
8. **AI setup & customisation** — the onboarding profile + AI batch rewriting flow
9. **Analytics dashboard** — interpreting usage data
10. **Setup checklist** — tracking onboarding progress
11. **Surgery settings** — `requiresClinicalReview` toggle, `enableDefaultHighRisk`, `enableBuiltInHighlights`, `enableImageIcons`, UI config
12. **Suggestion management** — reviewing and actioning staff suggestions

---

### `getting-started/index.mdx` — 🟡 INCOMPLETE

Step 1 mentions "If your surgery has the onboarding features enabled, you can track your progress using the Setup & onboarding section in Practice settings" but never explains:

- What the onboarding wizard looks like
- What each of the 7 steps collects (practice overview, appointment types, team structure, safety & escalation, local services, communication preferences, final settings)
- How the onboarding profile feeds into AI customisation
- The setup checklist dashboard

---

### `governance/multi-surgery-and-rbac.mdx` — 🟡 INCOMPLETE

Feature flag list is incomplete. Currently documents:

- `ai_instructions`, `ai_questions`, `workflow_guidance`, `admin_toolkit`

Missing:

- `ai_training` (the actual key for AI question prompts)
- `ai_surgery_customisation` (AI batch customisation)

---

## Cross-Reference: Navigation vs Docs

Items that appear in app navigation (from `src/navigation/modules.ts` and HelpPanel) vs docs:

| Nav Item | In Docs? |
|---|---|
| Signposting | ✅ |
| Workflow Guidance | ✅ (thin) |
| Practice Handbook | ✅ |
| Appointments Directory | ✅ |
| Help & Documentation | ✅ (links to docs site) |
| Clinical Review (admin) | ✅ (in governance) |
| Analytics (admin) | ❌ |
| Surgery Admin / Settings | ❌ |
| Setup Checklist | ❌ |
| AI Setup | ❌ |
| User Management | ❌ |

---

## Cross-Reference: HelpPanel Links vs Actual Pages

The HelpPanel component links to these docs sections:

| HelpPanel Link | Page Exists? |
|---|---|
| Getting Started | ✅ |
| User Guide | ✅ |
| Symptom Library | ✅ |
| Practice Handbook | ✅ |
| Workflow Guidance | ✅ (exists but thin) |
| Clinical Governance | ✅ |
| Appointment Directory | ✅ |
| AI Features | ✅ (incomplete) |
| Admin Guide | ✅ (very incomplete) |
| Developer Guide | ✅ |
| Release Notes | ❌ **No release notes page exists in docs-site** |

---

## Recommended Updates (Priority Order)

### 🔴 High Priority

1. **Expand `admin-guide.mdx`** — Add the 12 missing admin topics (symptom management, clinical review, user management, appointments, highlight rules, high-risk buttons, feature flags, AI setup, analytics, settings, suggestions). This is the single biggest gap.

2. **Add analytics documentation** — New section or page covering the analytics dashboard at `/s/[id]/analytics`.

3. **Document AI Surgery Customisation** — Add to `ai-features.mdx`: the `ai_surgery_customisation` flag, the AI Setup page, how it uses the onboarding profile, the three scope options, and progress tracking.

4. **Document the Onboarding Wizard** — Either expand `getting-started/index.mdx` or create a new page explaining the 7-step wizard, what each step collects, and how it feeds the rest of the system.

5. **Expand `workflow-guidance.mdx`** — Add node types, action keys, creating workflows, running instances, engagement analytics, canvas controls.

6. **Document "What's Changed" pages** — Add to `symptom-library.mdx` and admin-guide/handbook section.

### 🟡 Medium Priority

7. **Fix feature flag listing** — Update `ai-features.mdx` and `multi-surgery-and-rbac.mdx` to include `ai_training` and `ai_surgery_customisation`. Clarify that `ai_training` is the key for "AI Suggested Questions" (the docs call it `ai_questions`).

8. **Document User Suggestions feature** — Add to admin guide or create a new governance page.

9. **Document Image Icons** — Brief section in admin guide or features section.

10. **Add Release Notes page** — The HelpPanel links to it but it doesn't exist in `docs-site/pages/`.

### 🟢 Low Priority

11. **Document System Management** (superuser-only — may be intentionally undocumented).
12. **Document Practice Settings UI** detail.
13. **Document Setup Checklist** page.
14. **Standardize "Last updated" dates** across all pages.
