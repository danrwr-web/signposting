# Signposting Toolkit – Current App State (Draft Deployment)

This document describes the **Signposting Toolkit** codebase as deployed today. **Daily Dose** is a module within this platform (not a separate app). The intended design for Daily Dose is documented in `docs/wiki/Daily-Dose.md`; this file records how the current build works and where it differs from that spec.

---

## 1. Snapshot

- **Date documented:** 30 January 2026
- **Repo branch / commit:** `cursor/editorial-automatic-debug` @ `e9dbc10` (as of last run; update when documenting a different build)
- **Preview deployment URL:** Unknown / needs confirmation. No `vercel.json` or deployment URL found in repo. `src/middleware.ts` references `app.signpostingtool.co.uk` and `www.signpostingtool.co.uk` for production host routing. Check Vercel project settings or CI output for preview URL.
- **Tech stack summary:** Next.js 15 (App Router), TypeScript, Prisma (PostgreSQL), NextAuth (credentials), Tailwind CSS. Optional: Azure OpenAI (editorial AI), nodemailer (demo request). Database: PostgreSQL in production; `env.example` shows SQLite optional for local (`file:./dev.db` comment) but schema is PostgreSQL-only.

---

## 2. What currently works (user-visible)

1. **Landing and auth** – Public landing at `/`; login at `/login` (credentials). Surgery login and superuser login at `/admin-login`, `/super-login`. Host-based routing: marketing hosts serve `/` and `/demo-request` without auth; app host redirects `/` to default surgery or login.
2. **Surgery context** – After login, users select or are sent to a surgery at `/s/select` or `/s/[id]`. All in-app routes under `/s/[id]/…` use the shared app shell (header + universal navigation panel). See `src/navigation/modules.ts` and `docs/PROJECT_SUMMARY.md`.
3. **Signposting (symptom library)** – Symptom list and detail at `/s/[id]`, `/symptom/[id]`. Base + overrides + custom symptoms; highlights, high-risk buttons, clinical review workflow.
4. **Workflow Guidance** – Workflow templates, diagram editor, instances, start/run flow. Routes under `/s/[id]/workflow/*`. Feature-flagged via `workflow_guidance`.
5. **Practice Handbook (Admin Toolkit)** – Categories, items, attachments, quick access. Routes under `/s/[id]/admin-toolkit/*`. Feature-flagged via `admin_toolkit`.
6. **Appointment Directory** – Appointment types and staff types; API at `/api/appointments`, `/api/admin/appointments/*`. UI at `/s/[id]/appointments`.
7. **Daily Dose** – Entry at `/daily-dose` (standalone) and `/s/[id]/daily-dose` (in shell). Onboarding, session start → core card + interactions → quiz → complete; history and insights; admin (topics, cards, flags). Feature-flagged via `daily_dose`. Editorial: generate batch, batch review (card list + editor), approve/publish/archive, section regeneration, variations. HIGH-risk cards require clinician sign-off before publish.
8. **Admin / superuser** – `/admin` (dashboard, surgeries, users, system: features, defaults, changes, AI usage). Surgery admin: `/s/[id]/admin/*` (users, onboarding, setup checklist, AI setup).
9. **Editorial (Daily Dose cards)** – `/editorial` (generator, library, batches). Batch editor at `/editorial/batches/[batchId]` with card list, form editor, approve/publish/archive, regenerate section, variations.

---

## 3. Current routes and screens

### 3.1 Public

| Route | Purpose | Notes |
|-------|--------|--------|
| `/` | Landing | Served without auth on marketing hosts; otherwise may redirect (middleware). |
| `/login` | Sign-in | Credentials (email/password). |
| `/demo-request` | Demo request form | Public on marketing hosts; submits to API, email via SMTP. |
| `/privacy`, `/faqs`, `/help`, `/why-signposting-toolkit`, `/inside-the-platform` | Static/marketing | No auth required when not under app host. |
| `/anaphylaxis`, `/stroke-triage` | Legacy/landing | Present in app structure. |
| `/robots.txt`, `/sitemap.xml` | SEO | Route handlers in `src/app`. |

### 3.2 Authenticated

All routes below require a valid NextAuth session (middleware: `src/middleware.ts`). Unauthenticated users are redirected to `/login`.

| Route | Purpose | Access | Main components / API |
|-------|--------|--------|------------------------|
| `/s/select` | Choose surgery | Any authenticated user | `src/app/s/select/page.tsx` |
| `/s/[id]` | Surgery dashboard | User must be member of surgery or SUPERUSER | `SurgeryDashboardClient`, effective symptoms |
| `/s/[id]/signposting/*`, `/symptom/[id]` | Symptom library | Surgery member | Symptom list/detail, API: `effectiveSymptoms`, symptoms CRUD |
| `/s/[id]/workflow/*` | Workflow templates, instances, start | Surgery member + feature `workflow_guidance` | `WorkflowLandingClient`, `TemplateEditClient`, `WorkflowRunnerClient`; API: workflow create/delete, engagement |
| `/s/[id]/admin-toolkit/*` | Practice handbook | Surgery member + feature `admin_toolkit` | `AdminToolkitLibraryClient`, item edit; API: admin-toolkit audit, changes, record-view |
| `/s/[id]/appointments` | Appointment directory | Surgery member | `AppointmentsPageClient`; API: `/api/appointments`, staff-types |
| `/s/[id]/daily-dose` | Daily Dose (in shell) | Surgery member + feature `daily_dose` | `DailyDoseHomeClient`; links to session, history, insights |
| `/s/[id]/daily-dose/history`, `/s/[id]/daily-dose/insights` | History, insights | Surgery member | `DailyDoseHistoryClient`, `DailyDoseInsightsClient`; API: `/api/daily-dose/history`, `/api/daily-dose/insights` |
| `/daily-dose` | Daily Dose standalone home | Authenticated | Redirects to default surgery or shows “not linked”; `DailyDoseHomeClient` |
| `/daily-dose/onboarding` | Daily Dose role onboarding | Authenticated | `DailyDoseOnboardingClient`; API: `/api/daily-dose/profile` |
| `/daily-dose/session` | Learning session | Authenticated, onboarding completed | `DailyDoseSessionClient`; API: session start, submit-answer, complete |
| `/daily-dose/history`, `/daily-dose/insights` | History, insights (standalone) | Authenticated | Same as `/s/[id]/daily-dose/*` |
| `/user/profile`, `/user/change-password` | Profile / password | Authenticated | API: `/api/user/profile`, change-password |

### 3.3 Editor/Admin

| Route | Purpose | Access | Main components / API |
|-------|--------|--------|------------------------|
| `/admin` | Superuser dashboard | `globalRole === 'SUPERUSER'` | `AdminDashboardClient` |
| `/admin/surgeries`, `/admin/users`, `/admin/practice/*`, `/admin/system/*` | Surgeries, users, practice modules, system | Superuser or surgery ADMIN | Various admin clients; API under `/api/admin/*` |
| `/s/[id]/admin/*` | Surgery admin (users, onboarding, setup, AI) | Surgery ADMIN or SUPERUSER for that surgery | `SurgeryUsersClient`, `OnboardingWizardClient`, `SetupChecklistClient`, `AISetupClient` |
| `/daily-dose/admin` | Daily Dose admin (topics, cards, flags) | Surgery ADMIN or SUPERUSER | `DailyDoseAdminClient`; API: `/api/daily-dose/admin/*` |
| `/daily-dose/insights` | Daily Dose insights | Surgery ADMIN or SUPERUSER | `DailyDoseInsightsClient`; API: `/api/daily-dose/insights` |
| `/editorial` | Editorial generator + library | Surgery ADMIN or SUPERUSER | `EditorialGeneratorClient`, `EditorialLibraryClient`; API: `/api/editorial/generate`, library, batches |
| `/editorial/batches/[batchId]` | Batch review (cards + quiz editor) | Surgery ADMIN or SUPERUSER | `EditorialBatchClient`; API: `/api/editorial/batches/[batchId]`, cards approve/publish/archive, regenerate-section, variations |

Access control for `/admin`, `/daily-dose/admin`, `/daily-dose/insights`, `/editorial` is enforced in `src/middleware.ts`: user must have `globalRole === 'SUPERUSER'` or at least one membership with `role === 'ADMIN'`.

---

## 4. Auth and roles

- **Provider:** NextAuth.js v4, credentials only. Config: `src/lib/auth.ts`; route: `src/app/api/auth/[...nextauth]/route.ts`.
- **Sign-in:** Email + password; password checked against `User.password` (bcrypt) in `authorize()`. No sign-up UI in repo; users are created by admins or seed.
- **Roles:**
  - **Global:** `User.globalRole`: `USER` \| `SUPERUSER`. Stored in DB and mirrored in JWT/session.
  - **Per-surgery:** `UserSurgery.role`: `STANDARD` \| `ADMIN`. Stored in DB; session includes `memberships: { surgeryId, role, adminToolkitWrite }`.
- **Where role is stored:** Database: `User.globalRole`, `UserSurgery.role`. Session (JWT) includes `globalRole`, `defaultSurgeryId`, `memberships`. See `authOptions.callbacks.session` in `src/lib/auth.ts`.
- **How gating is enforced:** Middleware (`src/middleware.ts`) runs `withAuth`; for `/admin`, `/daily-dose/admin`, `/daily-dose/insights`, `/editorial` it requires SUPERUSER or any ADMIN membership; for `/s/[id]/admin*` it requires SUPERUSER or ADMIN for that surgery; for `/s/[id]` it requires membership in that surgery. Server-side: `getSessionUser()` from `src/lib/rbac.ts`; Daily Dose admin check: `isDailyDoseAdmin()` in `src/lib/daily-dose/access.ts`.

---

## 5. Database schema (current)

ORM: Prisma. Schema: `prisma/schema.prisma`. Migrations: `prisma/migrations/` (many dated migrations; latest include Daily Dose, editorial batches, generation attempts).

### 5.1 Tables (key only)

- **Auth:** `User`, `Account`, `Session`, `VerificationToken`, `UserSurgery`.
- **Tenancy:** `Surgery`; feature flags: `Feature`, `SurgeryFeatureFlag`, `UserFeatureFlag`.
- **Signposting:** `BaseSymptom`, `SurgerySymptomOverride`, `SurgeryCustomSymptom`, `SurgerySymptomStatus`, `HighlightRule`, `HighRiskLink`, `DefaultHighRiskButtonConfig`, `SymptomReviewStatus`, `SymptomHistory`, `EngagementEvent`, `Suggestion`.
- **Daily Dose:** `DailyDoseProfile`, `DailyDoseTopic`, `DailyDoseCard`, `DailyDoseCardVersion`, `DailyDoseSession`, `DailyDoseUserCardState`, `DailyDoseGenerationBatch`, `DailyDoseGenerationAttempt`, `DailyDoseQuiz`, `DailyDoseFlaggedContent`.
- **Admin Toolkit:** `AdminCategory`, `AdminItem`, `AdminItemEditor`, `AdminItemEditGrant`, `AdminListColumn`, `AdminListRow`, `AdminItemAttachment`, `AdminHistory`, `AdminPinnedPanel`, `AdminDutyRotaEntry`, `AdminOnTakeWeek`, `AdminCategoryVisibleUser`, `AdminToolkitEngagementEvent`.
- **Workflows:** `WorkflowTemplate`, `WorkflowNodeTemplate`, `WorkflowAnswerOptionTemplate`, `WorkflowNodeLink`, `WorkflowInstance`, `WorkflowAnswerRecord`, `WorkflowNodeStyleDefault`, `WorkflowNodeStyleDefaultSurgery`.
- **Other:** `AppointmentType`, `AppointmentStaffType`, `SurgeryOnboardingProfile`, `ImageIcon`, `TokenUsageLog`, etc.

### 5.2 Relationships (Daily Dose)

- `User` ↔ `DailyDoseProfile`, `DailyDoseSession`, `DailyDoseUserCardState`; creator/approver/publisher/clinician approver on `DailyDoseCard`; creator on `DailyDoseGenerationBatch`, `DailyDoseGenerationAttempt`, `DailyDoseCardVersion`; flagger/resolver on `DailyDoseFlaggedContent`.
- `Surgery` ↔ Daily Dose profile, topic, card, session, user card state, batch, quiz, attempt, flag. `DailyDoseCard` → `DailyDoseTopic`, optional `DailyDoseGenerationBatch`. `DailyDoseGenerationBatch` → `DailyDoseQuiz` (1:1), `DailyDoseGenerationAttempt` (many). `DailyDoseCard` → `DailyDoseCardVersion` (many), `DailyDoseUserCardState` (many), `DailyDoseFlaggedContent` (many).

### 5.3 Migrations / ORM notes

- Provider is PostgreSQL only in schema; `env.example` mentions SQLite for local but schema does not support it. Vercel build uses `prisma migrate deploy` via `scripts/prisma-migrate-deploy.js` and `vercel-build` in `package.json`.
- Daily Dose tables added in `20260116090000_add_daily_dose`, batches/quiz in `20260116113000_add_editorial_batches`, generation attempts in `20260118090000_add_generation_attempts`. Later migrations add card fields (e.g. riskLevel, clinicianApproved, batchId, interactions, slotLanguage, safetyNetting).

---

## 6. Learning content model (current)

- **Learning unit / topic:** `DailyDoseTopic`: id, surgeryId, name, roleScope (JSON), ordering, isActive. Cards belong to a topic via `DailyDoseCard.topicId`.
- **Card:** `DailyDoseCard`: id, batchId, surgeryId, targetRole (ADMIN|GP|NURSE), title, roleScope (JSON), topicId, contentBlocks (JSON), interactions (JSON), slotLanguage (JSON), safetyNetting (JSON), sources (JSON), estimatedTimeMinutes, version, status (DRAFT|IN_REVIEW|APPROVED|PUBLISHED|ARCHIVED|RETIRED), riskLevel (LOW|MED|HIGH), needsSourcing, reviewByDate, createdBy, approvedBy, publishedBy, clinicianApproved, clinicianApprovedBy, clinicianApprovedAt, tags, generatedFrom. Types: `src/lib/daily-dose/types.ts`; validation: `src/lib/daily-dose/schemas.ts`, `src/lib/schemas/editorial.ts`.
- **Quiz:** `DailyDoseQuiz`: id, batchId, surgeryId, title, questions (JSON). One quiz per batch. Quiz questions built for session in `src/lib/daily-dose/questions.ts`.
- **Source metadata:** On card: `sources` JSON array (title, url, publisher, accessedDate, etc.). Spec requires UK sources and review-by date; `needsSourcing` and `reviewByDate` on card; validation in `src/lib/editorial/guards.ts`, `adminValidator.ts`.
- **Status flow:** DRAFT → IN_REVIEW → APPROVED → PUBLISHED (with optional ARCHIVED/RETIRED). Publish is blocked until approved; HIGH risk requires clinician sign-off (see `src/server/updateRequiresClinicalReview.ts`, editorial guards).

---

## 7. AI generation (current)

- **Status:** Implemented for Daily Dose editorial batch generation (cards + quiz).
- **Provider + config:** Azure OpenAI. Env: `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_API_KEY`, `AZURE_OPENAI_DEPLOYMENT`, `AZURE_OPENAI_API_VERSION`. Call site: `src/server/editorialAi.ts` (`callAzureOpenAi`). API route: `src/app/api/editorial/generate/route.ts` (POST, validates body with zod, resolves surgery and role, rate limit 5 generations/hour per user, calls `generateEditorialBatch`).
- **Prompt construction:** System prompt built from role profile (`src/lib/editorial/roleProfiles.ts`), admin/content/source rules, and optional toolkit context (e.g. `content/toolkit/admin-mental-health.md`). User prompt includes prompt text, count, tags, interactive-first, toolkit section, and schema. Schema is embedded in prompts; see `GENERATION_SCHEMA` and `buildUserPrompt` in `src/server/editorialAi.ts`.
- **Schema validation + repair:** Output parsed and validated in `src/lib/editorial/generationParsing.ts` (`parseAndValidateGeneration`). On schema mismatch, a single retry is performed with a correction prompt (`buildSchemaCorrectionPrompt`). Result (including `repaired`) and attempts stored in `DailyDoseGenerationAttempt`. Admin/safety validation via `src/lib/editorial/adminValidator.ts` (`validateAdminCards`); on failure, one retry with validation errors in the prompt. HIGH-risk and sourcing checks in `src/lib/editorial/guards.ts`.
- **Common errors:** Handled as `EditorialAiError` (e.g. CONFIG_MISSING, SCHEMA_MISMATCH, SAFETY_VALIDATION_FAILED). Debug info (including requestId) returned when debug enabled (non-production for admins). Rate limit: 429 after 5 generations per hour per user.

---

## 8. Editorial workflow (current)

- **Where it lives:** Routes: `/editorial` (generator + library), `/editorial/batches/[batchId]` (batch review). Components: `src/app/editorial/EditorialGeneratorClient.tsx`, `EditorialLibraryClient.tsx`, `src/app/editorial/batches/[batchId]/EditorialBatchClient.tsx`. API: `src/app/api/editorial/generate/route.ts`, `batches/[batchId]/route.ts`, `cards/[cardId]/route.ts`, `cards/[cardId]/approve/route.ts`, `cards/[cardId]/publish/route.ts`, `cards/[cardId]/archive/route.ts`, `regenerate-section/route.ts`, `variations/route.ts`.
- **Statuses supported:** DRAFT, IN_REVIEW, APPROVED, PUBLISHED, ARCHIVED, RETIRED (on `DailyDoseCard`). Batch status: DRAFT, READY, PUBLISHED (on `DailyDoseGenerationBatch`).
- **Buttons and effects:** Generate (POST `/api/editorial/generate`) → new batch + cards + quiz. In batch UI: save card, approve card, publish card (disabled until approved; HIGH requires clinician sign-off), archive card; regenerate section (single block type); create variation. Approve/publish/archive implemented via API routes above.
- **Validation rules:** Cards must pass `validateAdminCards` (admin scope, sourcing, slot language, etc.). HIGH-risk cards require clinician approval before publish. Sources and review-by date enforced in guards.
- **Reject:** No explicit “reject” action in the UI; cards can be left in DRAFT/IN_REVIEW or archived. Flagging exists for end users (`DailyDoseFlaggedContent`); admin resolve at `/api/daily-dose/admin/flags/[id]/resolve`.

---

## 9. Learning session experience (current)

- **Session flow:** User hits Daily Dose home → “Start session” → POST `/api/daily-dose/session/start` with surgeryId. If no profile or onboarding not completed, 409 “Daily Dose onboarding required”. Otherwise: pick core card (new or due) via `pickCoreCard` (`src/lib/daily-dose/selection.ts`), build quiz questions via `buildQuizQuestions` (`src/lib/daily-dose/questions.ts`), return sessionId, coreCard, quizQuestions. Client: `src/app/daily-dose/session/DailyDoseSessionClient.tsx` → core card (content blocks + embedded interactions) → user answers → quiz → submit answers → POST `/api/daily-dose/session/complete` with results. Session and card state updated; XP and correctness stored.
- **Interaction types:** Implemented in card payload and UI: MCQ, true_false, choose_action (types from `src/lib/daily-dose/types.ts`). Interactions have question, options, correctIndex, explanation.
- **Progress tracking:** `DailyDoseSession`: cardIds, cardResults, questionsAttempted, correctCount, xpEarned, completedAt. `DailyDoseUserCardState`: per user/card/surgery, box (Leitner), intervalDays, dueAt, lastReviewedAt, correctStreak, incorrectStreak. Scheduler: `src/lib/daily-dose/scheduler.ts` (e.g. `applyReviewOutcome`, intervals from `constants.ts`). Scoring: `src/lib/daily-dose/scoring.ts`.
- **Streaks / XP:** XP earned per session stored on `DailyDoseSession.xpEarned`. Streak data on `DailyDoseUserCardState` (correctStreak, incorrectStreak). Badges/streak display in UI not fully verified in this pass; see `DailyDoseSessionClient` and history/insights APIs.

---

## 10. Gaps vs intended spec

Reference docs: **Project summary** `docs/PROJECT_SUMMARY.md`; **Daily Dose spec** `docs/wiki/Daily-Dose.md`.

### 10.1 Implemented as intended

- Daily Dose as a module within the shared app shell and navigation; feature flag `daily_dose`; role-based tracks (ADMIN, GP, NURSE) in topic/card and profile.
- Session: core card → embedded questions → quiz → summary with XP/correctness; sources and review-by on cards.
- Editorial: AI-assisted draft batch, batch review (card list + editor), approve → publish (with clinician sign-off for HIGH), archive; section regeneration and variations; schema validation and one repair retry; admin scope and sourcing checks; toolkit context injection for ADMIN cards.
- Spaced repetition: Leitner-style boxes and due dates in `DailyDoseUserCardState`; selection uses due/new logic in `src/lib/daily-dose/selection.ts`.
- Insights: practice-level, privacy-safe (insights API and analytics guardrail `analyticsGuardrailMinN` on Surgery).

### 10.2 Partially implemented

- **Streaks/badges:** Data model supports streaks; spec mentions “7-day streak” badges and “daily or weekdays only” – implementation detail of display and weekday-only option not confirmed in codebase.
- **Review queue in History:** History page and API exist; “review queue” wording in spec may imply a dedicated queue view – currently history/session flow.
- **Reject in editorial:** Spec implies clear “reject” path; current UI has archive and status flow but no explicit “Reject” button.

### 10.3 Not implemented yet

- **Neon Postgres:** Repo and docs say PostgreSQL (Neon recommended); schema is provider-agnostic. No Neon-specific config in repo – only `DATABASE_URL` in `env.example`.
- **Preview deployment URL:** Not recorded in repo; must be taken from Vercel or CI.

---

## 11. Known issues / TODOs found in code

1. **EngagementAnalytics.tsx** (line 427): `// TODO: Implement CSV export functionality`
2. **TemplateEditClient.tsx** (line 144): `colourHex` field hidden – “not used meaningfully in the diagram editor”
3. **workflow/actions.ts** (line 195): `// TODO(workflow-approval): Diagram edits (nodes/options/links) are saved by separate actions`
4. **api/symptoms/promote/route.ts** (line 54): `// TODO: Add audit logging for create/promote actions (SymptomHistory)`
5. **api/symptoms/create/route.ts** (lines 92–93, 171–172): TODO improve duplicate check with fuzzy matching; TODO audit logging for create/promote
6. **api/image-icons/route.ts** (line 175): `// TODO: Get actual dimensions from buffer or use a lightweight image library`
7. **Suggestion model:** Comment in schema: “TODO: Add these fields back when database schema is updated” (status, updatedAt) – suggestion status/actioning not fully wired.

Likely failure points: missing `AZURE_OPENAI_*` env disables editorial generation (CONFIG_MISSING); missing or wrong `DATABASE_URL` fails all DB access; session expiry and surgery membership checks can return 401/403 if not handled in UI.

---

## 12. Local dev: how to run

- **Prereqs:** Node.js 18+, npm, PostgreSQL (or use hosted Neon; schema is PostgreSQL).
- **Env vars:** Copy `env.example` to `.env`. Set at least: `DATABASE_URL` (e.g. `postgresql://…` or local Postgres), `NEXTAUTH_SECRET`, `NEXTAUTH_URL` (e.g. `http://localhost:3000`). Optional: `AZURE_OPENAI_*` for editorial AI; SMTP for demo request; `DONATIONS_ENABLED`, `SEED_SECRET`, `NEXT_PUBLIC_APP_VERSION`.
- **Commands:**  
  - `npm install`  
  - `npx prisma generate` (or `npm run db:generate`)  
  - `npx prisma migrate deploy` (or `npm run db:migrate:deploy`) for existing DB, or `npx prisma migrate dev` for local migration dev  
  - `npm run dev` (or `start-dev.ps1` / `start-dev.bat`) – dev server usually on port 3000.
- **Seeding:** `npm run db:seed` runs `prisma/seed.ts`. Seed creates default surgery, users, and can create Daily Dose topics and demo cards per surgery (see `ensureDailyDoseTopics`, `ensureDailyDoseCards` in seed). Admin toolkit global defaults: `npm run seed:admin-toolkit-global-defaults`.
- **DB locally:** Use a local PostgreSQL instance or a Neon (or other) Postgres URL in `DATABASE_URL`. No SQLite in current schema.

---

## Verification checklist

- [x] At least 10 concrete file paths referenced (e.g. `src/middleware.ts`, `src/lib/auth.ts`, `src/server/editorialAi.ts`, `src/app/api/editorial/generate/route.ts`, `src/app/daily-dose/session/DailyDoseSessionClient.tsx`, `prisma/schema.prisma`, `src/lib/daily-dose/selection.ts`, `src/lib/daily-dose/scheduler.ts`, `src/lib/editorial/generationParsing.ts`, `src/app/editorial/batches/[batchId]/EditorialBatchClient.tsx`, `docs/wiki/Daily-Dose.md`, `docs/PROJECT_SUMMARY.md`, `env.example`, `src/navigation/modules.ts`, `src/lib/daily-dose/access.ts`).
- [x] Route list in section 3 (public, authenticated, editor/admin).
- [x] Table list in section 5.1.
- [x] Gaps vs spec section 10 with 10.1–10.3.
- [x] No speculative claims; unknowns stated (e.g. preview URL, Neon-specific config).
