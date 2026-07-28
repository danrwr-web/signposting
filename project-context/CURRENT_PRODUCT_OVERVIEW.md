# Signposting Toolkit — Current Product Overview

**Baseline date:** 28 July 2026  
**Current documented release:** v1.7

## Purpose

The Signposting Toolkit is a multi-tenant web platform for UK general practice teams. It supports safe care navigation, consistent operational processes, practice-specific knowledge, clinical governance, onboarding, usage insight, and system administration.

It is clinically led and designed for routine use by reception, care-navigation, administrative, clinical-support, practice-management, and system-administration teams.

## User-facing modules

### Signposting Toolkit

- Shared library of 200+ symptoms
- Practice-specific overrides and custom symptoms
- Age-group variants, including practice-level customisation or suppression
- Optional all-ages mode
- High-risk buttons and phrase highlighting
- Important notices and local terminology
- Search, filtering, quick-scan and card-display preferences
- Symptom previews and clinical-review visibility

### Appointment Directory

- Searchable practice-specific appointment types and services
- Configurable local service information
- CSV-backed administration and validation
- Used alongside symptom guidance to support correct routing

### Workflow Guidance

- Visual workflows for administrative and document-processing tasks
- Shared templates with practice-specific instances and customisation
- React Flow canvas with instruction, question, outcome, panel and reference nodes
- Governed editing and persistent layout

### Practice Handbook

The canonical user-facing name is **Practice Handbook**. Some route, database and code identifiers still use `admin-toolkit` for backwards compatibility.

- Practice-specific operational guidance
- Pages and structured list content
- Categories and subcategories
- Quick Access buttons
- Operational information panel
- On-take GP rota
- Role cards and structured content blocks
- Per-item editing permissions and category visibility
- Engagement and audit views

### Feedback and suggestions

- Users choose whether a message is for the Signposting Toolkit team, practice toolkit administrators, or their own management/clinical team
- App-level feedback is centrally triaged
- Local symptom-content and handbook suggestions are routed to practice administrators
- Users can track submissions and see unread responses in-app

## Governance and safety

- Draft and approved lifecycle for symptom content
- Clinical-review workflow and review metadata
- Manual content edits return affected symptoms to Pending review
- AI-generated changes require clinical review
- Age-group variants are included in previews and review comparisons
- Disabled symptoms can be filtered from review without affecting counts or bulk actions
- Role-based access and surgery-level data isolation

## Practice administration

- Surgery dashboard and health indicators
- Setup checklist with essential and recommended steps
- User and role management
- Feature configuration
- Signposting preferences and local terminology
- Clinical Review
- Practice Handbook settings
- Workflow management
- Engagement analytics and CSV export
- AI customisation and setup tools

## System administration

- Multi-surgery management
- Global user management
- Surgery Setup Tracker
- LIVE and TEST surgery classification
- Base symptom and workflow content
- Feature flags and defaults
- AI usage and configuration visibility
- Central feedback triage
- Sales pipeline, communication templates and practice provisioning
- Trial, contract and invoice cues
- NHS ODS practice lookup and monthly list-size data

## AI-assisted features

- AI Instruction Editor
- AI Suggested Questions
- Surgery-wide instruction customisation using local terminology and clinician archetypes
- Safeguards to preserve deliberately blank notices and avoid overwriting locally edited content
- AI is an assistance layer; it does not bypass clinical review or role-based permissions

## Capabilities not assumed to be live

The following should not be described as released unless verified in the repository and production deployment:

- Daily Dose micro-learning
- Training Mode 2.0 / AI scenarios
- Predictive suggestions
- External clinical-system integrations
- Background synchronisation of content libraries
- Public API integrations

## Terminology

| Preferred term | Legacy/internal term |
|---|---|
| Practice Handbook | Admin Toolkit, `admin-toolkit` |
| System administrator | Superuser |
| Practice administrator | Surgery Admin / ADMIN |
| Standard user | STANDARD |
| Surgery | Tenant / practice |

Use current user-facing terminology in documentation and product copy. Preserve legacy identifiers only when referring to routes, database models or code.