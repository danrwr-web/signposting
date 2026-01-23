# Signposting Toolkit Documentation

<p align="center">
  <a href="https://signpostingtool.co.uk" target="_blank" rel="noreferrer noopener">
    <img src="wiki/images/signposting_logo_head.png" alt="Signposting Toolkit logo" width="320" />
  </a>
</p>

<p align="center">
  <strong>Helping admin teams in primary care</strong><br/>
  Contact: <a href="mailto:contact@signpostingtool.co.uk">contact@signpostingtool.co.uk</a>
</p>

This site contains documentation for the **Signposting Toolkit** – a clinically led, web-based platform designed to support GP reception, care-navigation, and wider practice teams with safe, consistent processes.

Use this site if you are:

- A **practice / PCN** evaluating the toolkit
- A **clinical lead** responsible for review and governance
- A **developer** running or contributing to the project

---

## About this documentation

This documentation describes a live, actively maintained system used in real NHS practice. The toolkit is developed within a working GP surgery and serves multiple practices with ongoing support and updates.

Core platform behaviour is stable and documented under the "Baseline Platform" section in the [Release Notes](RELEASE_NOTES). Newer changes are incremental improvements logged transparently in versioned releases. All AI features are optional, controlled via feature flags, and subject to mandatory clinical review before publication. For details on the safety model, see [Clinical Governance](wiki/Clinical-Governance).

---

## What's New

Recent highlights from the latest release. For complete details, see the [Release Notes](RELEASE_NOTES).

- **v1.3 — Jan 2026**: Practice Handbook improvements, Workflow Guidance refinements, and routing updates
- **v1.2 — Jan 2026**: Added Workflow Guidance module and redesigned marketing site
- **v1.1 — Dec 2025**: Added AI Suggested Questions and introduced preferences system

---

## Recently Shipped

- Practice Handbook: operational info panel is now collapsible and remembers your preference
- Practice Handbook: added category visibility controls and per-item editing permissions
- Practice Handbook: PAGE items support optional Intro text and Additional notes around Role Cards
- Practice Handbook: added LIST items for storing structured information
- Workflow Guidance: diagram details panel can be collapsed for more diagram space
- Improved routing: logo click keeps you within your current surgery using `/s` entry route
- Marketing and app domains separated for clearer navigation

---

## Application Structure & Navigation  
<!-- NEW: developer-facing guardrail -->

### Shared App Shell (Foundational)

All in-app pages use a **single shared application shell**, providing:

- a standard header (logo, surgery context, menu trigger)
- a **universal slide-out navigation panel**
- consistent layout and spacing across modules

This shell applies to **all routes under**:

/s/[id]/…


The navigation panel is the **primary navigation mechanism** for switching between modules.

### Core Modules

The toolkit currently includes:

- **Signposting Toolkit** – symptom signposting and care navigation
- **Workflow Guidance** – visual workflows for internal processes
- **Practice Handbook** (formerly “Admin Toolkit”) – internal guidance, advice, and policies

Future modules (e.g. *Daily Dose* micro-learning) will integrate into the same navigation and app shell.

### Navigation Rule (Important)

> **Any page under `/s/[id]/…` must render inside the shared app shell (standard header + universal navigation panel).**  
> Exceptions must be explicitly justified (e.g. true full-screen editors).

This rule prevents UX drift and ensures new features integrate cleanly.

---

## Documentation

The full documentation is organised into the following sections:

- [Getting Started](wiki/Getting-Started) – Step-by-step onboarding guide for new surgeries
- [User Guide](wiki/User-Guide) – Practical guide for reception and care-navigation staff
- [Day-to-day use](wiki/Day-to-day-use) – Task-first guide for common situations
- [Symptom Library](wiki/Symptom-Library) – How symptoms, overrides, and custom symptoms work
- [Clinical Governance](wiki/Clinical-Governance) – Review workflow, approval states, and safety principles
- [Appointment Directory](wiki/Appointment-Directory) – Configuring appointment types and local services
- [Workflow Guidance](wiki/Workflow-Guidance) – Visual workflows for common document and admin processes
- [Practice Handbook](wiki/Admin-Guide#practice-handbook) – Surgery-specific internal guidance pages
- [AI Features](wiki/AI-Features) – Instruction Editor and Suggested Questions (with safeguards)
- [High-Risk & Highlighting](wiki/High-Risk-&-Highlighting) – Colour rules and high-risk behaviour
- [Multi-Surgery & RBAC](wiki/Multi-Surgery-&-RBAC) – Multi-site configuration and role-based access control
- [Admin Guide](wiki/Admin-Guide) – Managing surgery configuration and governance
- [Developer Guide](wiki/Developer-Guide) – Architecture, local setup, and contribution guidelines
- [Docs Maintenance](wiki/Docs-Maintenance) – Checklist for keeping documentation current

---

## Quick Links

- **Product overview** – what the toolkit does and who it is for  
  → [Product Overview](PRODUCT_OVERVIEW)

- **Technical summary** – stack, architecture, APIs, and database  
  → [Technical Summary](PROJECT_SUMMARY)

- **Release notes** – changes between versions  
  → [Release Notes](RELEASE_NOTES)

- **Roadmap** – planned and in-progress features  
  → [Roadmap](ROADMAP)

---

## Screenshots

### Main symptom search screen

![Main symptom search and high-risk buttons](wiki/images/main_page.png)

---

## Contact

For onboarding, demos, or questions, email:

contact@signpostingtool.co.uk