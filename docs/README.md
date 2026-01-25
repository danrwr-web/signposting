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

## Start here

Looking for help using the app? Use the links below.

<div class="callout">
  <ul>
    <li><a href="wiki/Getting-Started">Getting Started</a></li>
    <li><a href="wiki/User-Guide">User Guide</a></li>
    <li><a href="wiki/Symptom-Library">Symptom Library</a></li>
    <li><a href="wiki/Clinical-Governance">Clinical Governance</a></li>
    <li><a href="wiki/Appointment-Directory">Appointment Directory</a></li>
    <li><a href="wiki/Workflow-Guidance">Workflow Guidance</a></li>
    <li><a href="wiki/Admin-Guide#practice-handbook">Practice Handbook</a></li>
    <li><a href="wiki/AI-Features">AI Features</a></li>
    <li><a href="wiki/High-Risk-&amp;-Highlighting">High-Risk &amp; Highlighting</a></li>
    <li><a href="wiki/Multi-Surgery-&amp;-RBAC">Multi-Surgery &amp; RBAC</a></li>
    <li><a href="wiki/Admin-Guide">Admin Guide</a></li>
    <li><a href="wiki/Developer-Guide">Developer Guide</a></li>
  </ul>
</div>

---

## What's New

Recent highlights from the latest release. For complete details, see the [Release Notes](RELEASE_NOTES).

- **Unreleased — Jan 2026**: In-app Help panel with quick links and search
- **v1.3 — Jan 2026**: Practice Handbook improvements, Workflow Guidance refinements, and routing updates
- **v1.2 — Jan 2026**: Added Workflow Guidance module and redesigned marketing site

---

### Recently Shipped

- Navigation: **Help & Documentation** now opens an in-app help panel with quick links and search
- Practice Handbook: operational info panel is now collapsible and remembers your preference
- Practice Handbook: added category visibility controls and per-item editing permissions
- Practice Handbook: PAGE items support optional Intro text and Additional notes around Role Cards
- Practice Handbook: added LIST items for storing structured information
- Workflow Guidance: diagram details panel can be collapsed for more diagram space
- Improved routing: logo click keeps you within your current surgery using `/s` entry route
- Marketing and app domains separated for clearer navigation

---

## About this documentation

This site contains documentation for the **Signposting Toolkit** – a clinically led, web-based platform designed to support GP reception, care-navigation, and wider practice teams with safe, consistent processes.

Use this site if you are:

- A **practice / PCN** evaluating the toolkit
- A **clinical lead** responsible for review and governance
- A **developer** running or contributing to the project

This documentation describes a live, actively maintained system used in real NHS practice. The toolkit is developed within a working GP surgery and serves multiple practices with ongoing support and updates.

Core platform behaviour is stable and documented under the "Baseline Platform" section in the [Release Notes](RELEASE_NOTES). Newer changes are incremental improvements logged transparently in versioned releases. All AI features are optional, controlled via feature flags, and subject to mandatory clinical review before publication. For details on the safety model, see [Clinical Governance](wiki/Clinical-Governance).

### Application Structure & Navigation

<!-- NEW: developer-facing guardrail -->

#### Shared App Shell (Foundational)

All in-app pages use a **single shared application shell**, providing:

- a standard header (logo, surgery context, menu trigger)
- a **universal slide-out navigation panel**
- consistent layout and spacing across modules

This shell applies to **all routes under**:

/s/[id]/…

The navigation panel is the **primary navigation mechanism** for switching between modules.

#### Core Modules

The toolkit currently includes:

- **Signposting Toolkit** – symptom signposting and care navigation
- **Workflow Guidance** – visual workflows for internal processes
- **Practice Handbook** (formerly “Admin Toolkit”) – internal guidance, advice, and policies

Future modules (e.g. *Daily Dose* micro-learning) will integrate into the same navigation and app shell.

#### Navigation Rule (Important)

> **Any page under `/s/[id]/…` must render inside the shared app shell (standard header + universal navigation panel).**  
> Exceptions must be explicitly justified (e.g. true full-screen editors).

This rule prevents UX drift and ensures new features integrate cleanly.

For maintainers: [Docs Maintenance](wiki/Docs-Maintenance).

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