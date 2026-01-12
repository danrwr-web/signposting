# Signposting Toolkit — Project Summary

A multi-surgery GP signposting and care-navigation web application used by primary care teams to route patients safely and consistently.  
Built by **Dr Daniel Webber-Rookes**, Ide Lane Surgery, Exeter.

The toolkit provides a structured, standardised symptom library, local customisation, AI-assisted clarity tools, an appointment directory, and a full governance workflow for clinical review — all delivered through a clean, modern, NHS-aligned interface.

---

## 1. Purpose

The Signposting Toolkit supports reception and care-navigation teams to:

- send patients to the right service first time,  
- follow clear and clinically-approved guidance,  
- reduce variation and inappropriate bookings,  
- identify high-risk symptoms quickly,  
- and maintain a robust clinical audit trail.

Each GP surgery has a fully independent configuration, symptom library, governance workflow, and appointment directory.

---

## 2. Key Features

### 🔹 Symptom Library (Base + Local Overrides)
- 200+ standardised symptoms included by default.
- Each surgery can override any field (title, wording, instructions, ages, icons).
- Local-only symptoms can be added.
- Clear badge indicating *base* or *locally modified*.
- Alphabet filter, age-group filters, search, and high-risk quick buttons.
- Optional **Quick Access** buttons can be configured by admins to give staff faster access to the most common problems (up to 6).

### 🔹 Symptom Detail Page
- Clean NHS-styled layout.
- Highlight engine automatically formats:
  - **orange slot**, **red slot**, **pink**, **purple**, **green**, etc.
- Embedded icons (per symptom) displayed consistently.
- AI tools available directly inside the symptom page:
  - “Customise instructions”  
  - “Get Questions to Ask” (panel titled “Suggested wording for questions to ask” with safety wording beneath the heading)
- Buttons for suggestion feedback, hiding symptoms, and navigation back.

### 🔹 AI-Assisted Features
- **AI Instruction Editor:** rewrites instructions for clarity; admin reviews before publishing.
- **AI Suggested Questions:** generates grouped triage-style questions:
  - red flags  
  - urgency/timing  
  - pathway suitability  
- All AI text must pass through clinical review before going live.
- Smart symptom updates available when base content changes centrally.

### 🔹 Appointment Directory
- Fully integrated top-level navigation.
- Simple searchable catalogue of appointment types.
- Colour-coded by staff team.
- CSV import for rapid updates.
- Built for reception staff: plain language, simple filtering, clear rules.

### 🔹 Workflow Guidance

The Workflow Guidance module provides structured, visual guidance for handling common administrative and clinical document workflows (e.g. discharge summaries, test requests, GP review).

Unlike signposting, which focuses on directing patients to the correct service, Workflow Guidance supports internal staff workflows by presenting step-by-step logic, decision points, and outcomes in a visual flow-diagram format.

Workflows are:
- Clinically governed
- Versioned
- Auditable
- Customisable per surgery

A Global Default set of workflows can be maintained centrally, with individual surgeries able to override and adapt workflows locally where required.

### 🔹 Preferences System (per browser)
- **Appearance:** Modern white or Classic blue cards.
- **Header layout:** Classic toolbar vs Split layout.
- **Quick-scan mode:** minimal card display.
- **High-risk button style:** pill or tile.

### 🔹 Clinical Review Workflow
- Every surgery must clinically approve all symptoms.
- Pending symptoms trigger a banner warning to all users.
- Approval recorded with reviewer identity and date.
- Re-review can be requested at any time (e.g. annually).
- All AI-generated content enters PENDING state.

### 🔹 Engagement Tracking and Suggestions
- Logs which symptoms are viewed and by whom.
- Tracks high-risk vs low-risk usage.
- Suggestions tab shows staff-submitted improvement ideas.

### 🔹 User Management & RBAC
Three-level access hierarchy:

1. **Superuser** (global)
2. **Surgery Admin**
3. **Standard User**

Each user may belong to multiple surgeries with differing roles.

### 🔹 Multi-Surgery Tenancy
- Each surgery has its own overrides, symptoms, appointment directory, users, and setup status.
- Superusers can switch between surgeries.

### 🔹 Navigation & Documentation
- Marketing site (`www.signpostingtool.co.uk`) features updated landing page with clear hero, benefits strip, and 3-step "How it works" section.
- Marketing site navigation includes both User Guide and Docs links for easy access to documentation.
- Admins and superusers can open the public documentation from the top navigation (opens in a new tab).
- The Admin Dashboard includes a Documentation tab for the same site so admins can get guidance without leaving their workflow.
- Domain routing: the marketing site stays on `www.signpostingtool.co.uk` while the app runs at `app.signpostingtool.co.uk`, with `/` on the app host directing users into the toolkit entry screen.
- Docs site logo links back to the marketing homepage (`www.signpostingtool.co.uk`).

---

## 3. Technical Architecture

### 🔧 Stack
- **Next.js 15** (App Router)
- **TypeScript**
- **Tailwind CSS**
- **Prisma ORM — Neon Postgres**
- **NextAuth (Credentials Provider + JWT)**
- **Azure OpenAI** (secure server-side calls)

### 🔧 Server Actions
Used extensively for:
- symptom updates  
- override creation  
- appointment directory CRUD  
- AI generation endpoints  
- clinical review actions  

### 🔧 Rendering
- Mix of Server Components (data fetching) and Client Components (interactive UI).
- Caching layer for common public queries.

---

## 4. Data Model Overview

### Core Models
- **User**  
- **Surgery**
- **UserSurgery** (junction table)
- **BaseSymptom**
- **SurgerySymptomOverride**
- **SurgeryCustomSymptom**
- **AppointmentEntry**
- **StaffTeam**
- **Suggestion**
- **EngagementEvent**
- **FeatureFlag**
- **ImageIcon**

---

## 5. Feature Flags

Feature availability controlled via hierarchical flags:

- **Superuser → Surgery → User**

Current active flags include:

- `ai_instructions`
- `ai_questions`
- `smart_symptom_updates`
- (future flags can be added via admin panel)

---

## 6. Clinical Governance Model

### Principles
- Surgeries are responsible for their own final wording.
- Base library is centrally maintained but overrideable.
- AI output **must** be clinician-reviewed.

### States
- **PENDING** — awaiting local review  
- **APPROVED** — clinically signed-off  
- **CHANGES_REQUIRED** — flagged for updates  

The system maintains an audit trail for:
- reviewer identity  
- date of approval  
- which fields changed  

---

## 7. Application Flows

### 🟦 Staff Workflow
1. Search for symptom  
2. Check age-group filters  
3. Open symptom  
4. Follow instructions  
5. Book appointment or signpost service  
6. Use high-risk guidance if needed  

### 🟧 Admin Workflow
1. Select symptom  
2. Edit fields or override base  
3. Review highlight logic  
4. Approve via Clinical Review  
5. Monitor usage via Engagement tab  

### 🟩 AI Workflow
1. Admin clicks “Customise Instructions”  
2. AI generates suggestion → stored as DRAFT  
3. Draft enters Clinical Review  
4. Admin approves, modifies, or rejects  

### 🟨 Appointment Directory Workflow
1. Import CSV or add entries manually  
2. Assign staff teams & colours  
3. Receptionists browse by search or team  
4. Used as reference when interpreting instructions  

---

## 8. External Dependencies
- Azure OpenAI API  
- Neon managed Postgres  
- Vercel serverless platform  
- TailwindCSS + Heroicons  
- TipTap (for future rich text improvements)

---

## 9. Known Issues & Future Improvements (Short List)
- Need surgery profile module.
- Multi-line membership badges in Users table (UX).
- Analytics dashboard not yet surfaced for admins.
- Symptom linking pathways could be expanded.
- Setup checklist can be made more dynamic.

---
