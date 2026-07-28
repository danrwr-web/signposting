# Signposting Toolkit — Module Status Register

**Baseline date:** 28 July 2026

This register distinguishes released capabilities from planned or historical work. It should be updated whenever a module changes status.

| Module / capability | Status | Notes |
|---|---|---|
| Signposting symptom library | Live | Shared base library, practice overrides, custom symptoms, age-group variants and all-ages option |
| High-risk and highlighting engine | Live | Configurable visual highlighting and high-risk access |
| Appointment Directory | Live | Practice-specific searchable service and appointment catalogue |
| Clinical Review | Live | Approval workflow, previews, base wording comparison and pending-review safeguards |
| Practice Handbook | Live | User-facing canonical name; internal routes/models may still use Admin Toolkit |
| Workflow Guidance | Live | Visual workflows with shared defaults and practice-specific customisation |
| Engagement analytics | Live | Practice-level use data, trends, insights and export; exact views depend on role/module |
| Feedback and suggestions | Live | Audience-aware routing, central and practice triage, response tracking |
| Setup checklist and surgery health | Live | Essential/recommended setup, health indicators and contextual navigation |
| Surgery Setup Tracker | Live | System-level onboarding and usage status across surgeries |
| User and access management | Live | Practice and global user views, filtering, activity and permission management |
| Sales pipeline | Live | Enquiries through provisioning, trials, contracts, invoices and exports |
| NHS practice lookup | Live | ODS lookup plus cached monthly list-size data |
| AI Instruction Editor | Live, feature-flagged | Requires clinical review |
| AI Suggested Questions | Live, feature-flagged | Requires clinical review and role/safety safeguards |
| Surgery-wide AI customisation | Live, system-controlled | Uses local terminology and preserves manually edited content |
| Daily Dose micro-learning | Approved concept / not assumed live | Specification exists, but release status must be verified before describing as available |
| Training Mode 2.0 / AI scenarios | Planned | Do not confuse with the removed legacy training mode |
| Predictive suggestions | Planned | Not assumed present in production |
| Full platform audit-log UI | Partial | Practice Handbook audit exists; do not describe a universal audit UI without verification |
| Background content updates | Planned | Preserve local overrides if implemented |
| Admin notifications centre | Planned | Selected badges and email notifications exist, but not a general notification centre |
| External clinical-system integrations | Exploratory | No integration should be presented as current without repository and production verification |

## Status definitions

- **Live** — documented in the current release and represented in the repository.
- **Live, feature-flagged** — released but not necessarily enabled for every surgery or user.
- **Partial** — some related behaviour exists, but the broader roadmap item is incomplete.
- **Approved concept / not assumed live** — a detailed design or build specification exists, but availability has not been established.
- **Planned** — present in roadmap or product thinking but not released.
- **Exploratory** — possible future direction without a committed release.

## Maintenance rule

When a capability moves between states, update this register, the public release notes where appropriate, and any affected product overview or roadmap material in the same pull request.