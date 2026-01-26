# Signposting Toolkit — Development Roadmap

This roadmap outlines the planned evolution of the Signposting Toolkit as a
clinically led, multi-module platform for UK GP practices.

It reflects the current state of the product (early 2026), balancing:
- usability and confidence for practice teams
- governance and safety
- scalability across multiple surgeries
- optional future modules

---

## ✅ Recently Delivered / In Progress (Context)

These foundations are now in place and inform all future work:

- Shared application shell and universal navigation
- Multi-surgery tenancy with RBAC
- Clinical Review workflow and approval states
- Engagement tracking (symptom views, user activity)
- Practice Handbook as a first-class module
- Workflow Guidance (visual, governed workflows)
- Preferences system (card styles, layouts, quick-scan mode)
- AI Instruction Editor and Suggested Questions (with safeguards)

Future roadmap items build on — not replace — these capabilities.

---

## 🚦 Phase 1 — Consolidation & Confidence (Q1–Q2)

**Goal:** Make the platform feel calm, predictable, and trustworthy for daily use.

### ⭐ Surgery Profile & Configuration Panel
Single, clear entry point for:
- practice-level configuration
- enabled modules
- preferences and defaults  
**Effort:** Medium

---

### ⭐ UX & Platform Guardrails
Prevent UX drift as modules expand:
- enforce shared app shell rules
- consistent navigation patterns
- predictable page layouts across modules  
**Effort:** Low–Medium

---

### ⭐ Analytics & Engagement (v2)
Build on existing engagement tracking to improve visibility, confidence, and governance across the platform.

**Phase 1 foundations**
- Surface last login timestamps on the Users & Access Management page
- Add an engagement panel to Workflow Guidance, consistent with Signposting Toolkit and Practice Handbook

**Phase 2 evolution**
- Introduce a unified Analytics page covering all enabled modules:
  - Signposting Toolkit
  - Workflow Guidance
  - Practice Handbook
- Provide aggregated, practice-level usage insights by default
- Allow optional, admin-only drill-down to individual users for support and onboarding purposes

**Design principles**
- Visibility over surveillance
- Aggregated insights by default
- No performance ranking or league tables
- Analytics must support governance, confidence, and training — not monitoring

**Effort:** Medium

---

### ⭐ Highlight & Safety Engine Tweaks
- smarter phrase detection
- optional custom phrases
- consistent semantic colouring  
**Effort:** Low

---

### ⭐ Appointment Directory Enhancements
- improved CSV validation
- optional quick-book rules
- clearer service metadata  
**Effort:** Medium

---

## 🧱 Phase 2 — Scaling & Adoption (Q3)

**Goal:** Make onboarding, rollout, and multi-practice use frictionless.

### ⭐ Multi-Surgery Templates
- base symptom libraries
- default handbook content
- optional PCN-level packs  
**Effort:** Medium–High

---

### ⭐ Export / Import Tools
- export symptom libraries
- safely import overrides
- preview before apply  
**Effort:** Medium

---

### ⭐ Setup Checklist 2.0
- dynamic completion tracking
- dependency awareness
- clearer “what’s left to do”  
**Effort:** Medium

---

### ⭐ Practice Handbook Maturity
- review reminders
- visibility of recent changes
- basic usage insights (most viewed pages)  
**Effort:** Medium

---

### ⭐ Clinical Review Bulk Actions
- batch approvals
- re-review workflows  
**Effort:** Medium

---

## 🚀 Phase 3 — Optional / Premium Modules

**Goal:** Add value without increasing risk or cognitive load.

### ⭐ Daily Dose — Micro-Learning Module
Optional learning cards for practice teams:
- role-appropriate
- governed editorial workflow
- AI-assisted generation (locked spec)  
**Effort:** High

---

### ⭐ AI Scenarios (Training Mode 2.0)
Scenario-based receptionist training:
- optional
- non-clinical
- confidence-building  
**Effort:** High

---

### ⭐ Predictive Suggestions
AI surfaces:
- common pitfalls
- checklists
- escalation prompts  
**Effort:** Medium–High

---

## 🌍 Phase 4 — Platform-Level Maturity

**Goal:** Long-term robustness and integration readiness.

### ⭐ Full Audit Log (UI)
Expose existing history as:
- readable timelines
- change attribution
- governance reassurance  
**Effort:** Medium–High

---

### ⭐ Background Content Updates
- synchronise base libraries
- preserve local overrides  
**Effort:** Medium

---

### ⭐ Admin Notifications
In-app notifications for:
- review requests
- updates
- release notes  
**Effort:** Medium

---

### ⭐ API Integrations (Future)
Exploratory, optional:
- Pharmacy First
- eConsult metadata syncing  
**Effort:** Medium–High

---

## Summary

| Phase | Focus | Risk Profile |
|------|------|--------------|
| 1 | Confidence & consistency | Low |
| 2 | Scaling & adoption | Medium |
| 3 | Optional value-add | Medium–High |
| 4 | Platform maturity | Medium |

---

**Guiding principle:**  
> Build trust first. Scale second. Add intelligence last — and only where it helps.