# Daily Dose — Learning Pathway MVP Specification

**Signposting Toolkit Ltd · Version 1.0 Draft · February 2026**

---

## 1. Purpose & Context

This document specifies the MVP design for the Daily Dose Learning Pathway — a structured curriculum layer that sits on top of the existing Daily Dose micro-learning engine.

It is intended as a shared reference for design, development, and clinical review. It captures agreed design decisions, the data model, UX behaviour, and implementation scope.

---

## 2. Product Identity Shift

This design changes Daily Dose from a daily random micro-learning card tool into a structured safety curriculum with adaptive reinforcement.

| Before | After |
|--------|-------|
| Daily random micro-learning cards | Structured safety curriculum with adaptive reinforcement |
| Progress invisible to user | Competence visible at theme and unit level |
| No recommended learning order | Guided pathway with free exploration |
| XP and streak as sole motivation | Mastery states and visible progression ladder |

This shift is core MVP positioning, not a future enhancement.

---

## 3. Core Goal

The Learning Pathway gives admin and reception staff:

- Visibility of their own competence across clinical topics
- A clear, recommended direction of travel through learning
- The autonomy to explore freely without hard locks
- Psychological safety — no comparisons, no judgement, no leaderboards

Success is measured by staff feeling confident and competent in their role, not by completion metrics alone.

---

## 4. Navigation Model

### Two-Layer Structure

**Layer 1 — Theme Map (overview)**
- All themes displayed as tiles on load
- Unstarted themes shown greyed out
- Tile colour reflects overall mastery (RAG)
- Tiles are clickable to drill into theme detail

**Layer 2 — Theme Detail**
- List of learning units within the theme
- Each unit shows its individual mastery state
- Sequence order displayed
- Recommended next unit highlighted

### Theme Visibility — Agreed Design Decision

Show all themes on first load, with unstarted themes greyed out. This:
- Sets expectations about the full scope of learning
- Reduces anxiety about unknown content
- Keeps exploration always available — nothing hidden or locked

### Curriculum Structure

Each theme contains units organised into three levels:

| Level | Description | Purpose |
|-------|-------------|---------|
| Intro | Foundational units covering essential knowledge | Safe baseline for all staff |
| Core | Primary competency units for the theme | Day-to-day role confidence |
| Stretch | Advanced or less common scenarios | Deeper expertise for keen learners |

---

## 5. Mastery Model

### Unit States

| State | Definition |
|-------|------------|
| Not started | No sessions completed for this unit |
| In progress | At least one session completed, but Secure criteria not yet met |
| Secure | Completed + ≥80% accuracy + reinforced at least once via spaced repetition |

### Theme Colour (RAG)

| Colour | Threshold |
|--------|-----------|
| 🔴 Red | Fewer than 40% of units in the theme are Secure |
| 🟠 Amber | 40–79% of units are Secure |
| 🟢 Green | 80% or more of units are Secure |

### Privacy Principle

- Mastery colours are **private to the individual user**
- No comparison with colleagues at MVP
- No leaderboards at MVP
- Supportive language throughout — competence building, not judgement

---

## 6. Recommended-Next Logic

A deterministic rule-based system. No AI or complex weighting required at MVP.

| # | Condition | Recommended next |
|---|-----------|-----------------|
| 1 | Incomplete intro unit exists | Next intro unit in sequence |
| 2 | All intro units Secure | Weakest core unit (lowest accuracy) |
| 3 | All core units Secure | First incomplete stretch unit |
| 4 | All units Secure | Maintenance — revisit lowest accuracy unit |

---

## 7. Architectural Impact

This is a **structured expansion** of Daily Dose, not a rewrite.

| Area | Change required | Unchanged |
|------|----------------|-----------|
| Learning engine | Theme + unit progress states | Leitner scheduler |
| Database schema | Themes, units, user progress tables | Card and session schema |
| Editorial workflow | Theme + sequence assignment on cards | AI generation pipeline |
| UX / navigation | Learning map + theme detail screens | Session and quiz UI |
| Recommendation logic | New deterministic rule engine | Governance workflow |
| AI generation | No change | — |
| Clinical governance | No change | — |

### Why Implement Now

- Cards created without theme and sequence metadata will require messy retrofitting later
- The recommendation logic depends on unit structure being present from the start
- Product identity is clearer with the pathway in place before external pilots
- Early implementation is low risk — it is additive, not disruptive

---

## 8. MVP Scope

### Included

- Theme definition and assignment in editorial workflow
- Unit levels (Intro / Core / Stretch) on cards
- Mastery states (Not started / In progress / Secure)
- Theme RAG colour based on unit mastery
- Recommended-next logic (deterministic rule-based)
- Two-layer navigation: theme map + theme detail
- All themes visible on load, unstarted greyed
- Private mastery — no team visibility at MVP

### Excluded from MVP

- Decay modelling (mastery degrading over time without reinforcement)
- Complex weighting or AI-driven recommendations
- Practice manager dashboards
- Team or cohort comparison views
- Behaviour experiments or A/B testing

---

## 9. Outstanding Questions

| Question | Status |
|----------|--------|
| Should there be a practice mode for users who want to continue after their daily session, without affecting Leitner progress? | Open — awaiting clinical lead decision |
| Should the 'Secure' threshold (80% accuracy) be configurable per theme or fixed globally? | Open |
| How should the pathway handle a user assigned to a new surgery mid-progress? | Open |

---

## 10. Suggested Next Steps

1. Review and agree this spec between Daniel and Sam
2. Resolve outstanding questions (especially practice mode)
3. Translate into UX wireframe for the theme map and detail screens
4. Define the database schema changes for themes, units, and user progress
5. Build Cursor implementation prompt from agreed spec
