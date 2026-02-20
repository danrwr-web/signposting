# Signposting Toolkit – Project Summary

## Overview
The Signposting Toolkit is a modular, web-based platform designed to support UK GP practices with safe, efficient care navigation, workflow guidance, and internal knowledge sharing.

The platform is clinically led, designed for real-world use by busy practice teams, and built to scale across multiple surgeries with role-based access control and feature flagging.

---

## Core Modules
The toolkit currently includes the following first-class modules:

- **Signposting Toolkit** – Patient-facing and admin-facing symptom signposting and care navigation
- **Workflow Guidance** – Visual and structured guidance for internal practice workflows
- **Practice Handbook** (formerly “Admin Toolkit”) – A curated internal knowledge base for practice policies, advice, and procedures

Future modules (e.g. *Daily Dose* micro-learning) will integrate into the same platform and navigation structure.

---

## Navigation & App Shell (Foundational)
The application uses a **single, shared app shell** across all in-app routes.

### Key principles
- All routes under `/s/[id]/…` render inside the shared app shell
- The **universal slide-out navigation panel** is the *primary* navigation mechanism
- A **standard header** (logo, surgery context, menu trigger) is always present
- Modules are accessed via the navigation panel, not via bespoke page-level navigation

### Rule (non-negotiable)
> **Any page under `/s/[id]/…` must render inside the shared app shell (standard header + universal navigation panel).**  
> Exceptions must be explicitly justified (e.g. true full-screen editors).

This ensures:
- consistent orientation for users
- predictable navigation
- minimal cognitive load
- future modules integrate cleanly without UX drift

---

## Access Control & Feature Flags
- Access is controlled via role-based permissions (Standard user, Practice admin, System admin)
- Modules and features may be enabled or disabled per surgery
- Disabled modules remain visible in navigation with explanatory messaging

---

## Design Philosophy
- Calm, NHS-appropriate UI
- Consistency over cleverness
- Minimise duplicated navigation patterns
- Make the “right thing” the default for both users and developers
