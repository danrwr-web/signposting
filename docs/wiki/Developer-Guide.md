# 🧑‍💻 Developer Guide

*A practical guide for developers working on the Signposting Toolkit.*

## Navigation

- [Home](Home)

- [Getting Started](Getting-Started)

- [User Guide](User-Guide)

- [Symptom Library](Symptom-Library)

- [Clinical Governance](Clinical-Governance)

- [AI Features](AI-Features)

- [Appointment Directory](Appointment-Directory)

- [Workflow Guidance](Workflow-Guidance)

- [High-Risk & Highlighting](High-Risk-&-Highlighting)

- [Multi-Surgery & RBAC](Multi-Surgery-&-RBAC)

- [Admin Guide](Admin-Guide)

- [Developer Guide](Developer-Guide)

- [Docs Maintenance](Docs-Maintenance)

---

## 1. Overview

The Signposting Toolkit is a **Next.js + Prisma + Neon Postgres + Vercel** web application designed for GP surgeries.  

This guide explains:

- How to run the project locally  

- How the architecture fits together  

- How to seed/reset the database  

- How to contribute safely  

- Where key logic lives  

It is written for developers joining the project or returning to it after a break.

---

## 2. Project Architecture

```text

signposting/

├── docs/                     → Public GitHub Pages documentation

│   └── wiki/

├── prisma/                   → Prisma schema + migrations

│   └── seed.ts               → Database seed

├── src/

│   ├── app/                  → Next.js App Router (pages, routes, UI)

│   ├── components/           → Reusable React components

│   ├── lib/                  → Utilities (RBAC, highlight engine, auth helpers)

│   └── server/               → Server-side logic (actions & services)

├── public/                   → Static assets

├── .env.local                → Local environment variables (not committed)

└── package.json

```

---

## 3. Requirements

Install:

- Node.js ≥ 18

- pnpm (preferred) or npm

- Docker Desktop (optional, for local DB simulation)

- Vercel CLI (optional, but useful)

---

## 4. Environment Variables

Create a file:

**`.env.local`**

Required variables (safe placeholders shown):

```env
DATABASE_URL="postgres://user:password@host/db"
NEXTAUTH_SECRET="development-secret"
NEXTAUTH_URL="http://localhost:3000"
```

When running locally, Neon or Docker Postgres works fine.

**Important:**

- `.env.local` must never be committed — it is git-ignored by default.

---

## 5. Running the Application Locally

Install dependencies:

```bash
pnpm install
```

Run dev server:

```bash
pnpm dev
```

Visit:

**http://localhost:3000**

You should see the main signposting homepage.

---

## 6. Database Management (Prisma)

**Check database connection**

```bash
pnpm prisma migrate status
```

**Push schema changes (local only)**

```bash
pnpm prisma db push
```

**Run migrations**

```bash
pnpm prisma migrate dev
```

**Open Prisma Studio**

```bash
pnpm prisma studio
```

Use this for inspecting local data while developing.

---

## 7. Seeding the Database

**Minimal seed (recommended for development)**

```bash
pnpm seed:minimal
```

**Full seed (production-like data)**

```bash
pnpm seed
```

**Reset database and reseed**

```bash
pnpm prisma migrate reset
```

This wipes all tables and re-runs the seed files.

---

## 8. API Routes and Server Actions — Where Logic Lives

The app uses modern Next.js App Router patterns.

| Area | Location |
|------|----------|
| Symptom logic | `src/server/symptoms/` |
| Highlight engine | `src/lib/highlighting/` |
| AI features | `src/server/ai/` |
| Admin logic | `src/server/admin/` |
| RBAC model | `src/lib/rbac.ts` |
| Appointment directory | `src/server/appointments/` |

---

## 9. Authentication & RBAC

The app uses a simple but robust RBAC model:

- **superuser** → global management, base library, user management

- **surgery-admin** → surgery configuration, appointment directory

- **standard-user** → normal signposting usage

Authentication is handled through a lightweight session-based system.

**No part of the application should rely on email-based permissions.**

All checks should use RBAC helpers, for example:

```typescript
if (!can(user).isSuperuser()) {
  // deny access
}
```

---

## 10. Highlighting Engine (Summary)

The highlighting engine scans symptom instructions and applies formatting rules:

- Red, orange, pink, purple, green keywords

- Rules defined in the admin panel

- Rendering handled server-side to ensure consistency

The implementation lives in:

**`src/lib/highlighting/`**

---

## 11. AI Tools (Instruction Editor & Question Generator)

AI features are optional, and fully reviewed by clinicians before going live.

AI endpoints and utilities live under:

**`src/server/ai/`**

The system supports:

- rewriting instructions for clarity

- generating suggested questions for admin staff

- future extensibility (training notes, pattern matching, etc.)

---

## 12. Adding a New Module (e.g., "Daily Dose")

When adding a new top-level module to the app (like Signposting, Workflow Guidance, or Practice Handbook), follow this checklist:

### Step 1: Register the Module

Add an entry to the navigation registry:

**`src/navigation/modules.ts`**

```typescript
export const MODULES: ModuleItem[] = [
  // ... existing modules ...
  { 
    id: 'daily-dose', 
    label: 'Daily Dose', 
    href: '/s/{surgeryId}/daily-dose', 
    featureKey: 'daily_dose' // Optional: if module is feature-flagged
  },
]
```

**Notes:**
- Use `{surgeryId}` placeholder in the `href` — it will be replaced at runtime
- Set `alwaysEnabled: true` if the module should always be visible
- Set `featureKey` if the module should be gated by a feature flag

### Step 2: Create the Route Structure

Create your module pages under:

**`src/app/s/[id]/your-module/`**

Example:
```
src/app/s/[id]/daily-dose/
  ├── page.tsx              # Landing page
  └── [itemId]/
      └── page.tsx          # Detail page
```

### Step 3: Use the Shared Layout

**Do NOT** import `SimpleHeader` in your pages. The shared layout (`src/app/s/[id]/layout.tsx`) automatically provides:

- `SimpleHeader` (with hamburger menu and surgery context)
- `UniversalNavigationPanel` (from root layout)

Your pages should focus on content only:

```typescript
// ✅ Correct: No header needed
export default async function DailyDosePage({ params }: Props) {
  const { id: surgeryId } = await params
  // ... your logic ...
  
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <h1>Daily Dose</h1>
      {/* Your content */}
    </div>
  )
}

// ❌ Wrong: Don't import SimpleHeader
import SimpleHeader from '@/components/SimpleHeader'
```

### Step 4: Update Active Module Detection (if needed)

If your module route doesn't match the standard pattern, update the active module detection in:

**`src/components/UniversalNavigationPanel.tsx`**

Look for the `getActiveModule` function and add your route pattern.

### Step 5: Add Feature Flag (if applicable)

If your module uses a feature flag:

1. Add the flag key to your module entry in `src/navigation/modules.ts`
2. Ensure the feature flag is checked in your page (using `isFeatureEnabledForSurgery`)
3. The navigation panel will automatically show/hide the module based on the flag

### Step 6: Verify App Shell Enforcement

Run the check script to ensure you haven't bypassed the app shell:

```bash
npm run check:app-shell
```

This script verifies:
- Pages under `/s/[id]/...` don't import `SimpleHeader` directly
- The layout file exists and includes `SimpleHeader`

### Step 7: Update Documentation

- Add your module to the user-facing documentation in `/docs/wiki`
- Update navigation blocks in wiki pages if needed
- Add screenshots to `/docs/wiki/images/` if applicable

### Example: Complete Module Addition

```typescript
// 1. src/navigation/modules.ts
{ 
  id: 'daily-dose', 
  label: 'Daily Dose', 
  href: '/s/{surgeryId}/daily-dose', 
  featureKey: 'daily_dose' 
}

// 2. src/app/s/[id]/daily-dose/page.tsx
import 'server-only'
import { requireSurgeryAccess } from '@/lib/rbac'
import { isFeatureEnabledForSurgery } from '@/lib/features'

export default async function DailyDosePage({ params }: Props) {
  const { id: surgeryId } = await params
  await requireSurgeryAccess(surgeryId)
  
  const enabled = await isFeatureEnabledForSurgery(surgeryId, 'daily_dose')
  if (!enabled) {
    return <div>Module not enabled</div>
  }
  
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <h1>Daily Dose</h1>
      {/* Content */}
    </div>
  )
}
```

---

## 13. Local Testing Accounts

The seed scripts automatically generate test users, including:

- one superuser

- one surgery admin

- several standard users

Passwords are output by the seed script.

**No real email addresses are used in seeds.**

---

## 13. Coding Conventions

**Linting**

```bash
pnpm lint
```

**Formatting**

```bash
pnpm format
```

**Type checks**

```bash
pnpm typecheck
```

Follow the existing code style and prefer small, focused pull requests.

---

## 14. Deployment Workflow

### Production hosting

Production deployments occur via Vercel:

- Deploys automatically when `main` updates

- Uses environment variables configured in the Vercel dashboard

- Applies Prisma migrations automatically as part of the deploy process

### Documentation hosting

Documentation is deployed on:

**https://docs.signpostingtool.co.uk**

via GitHub Pages with source folder `/docs`.

### Important DNS note

DNS is managed entirely via Cloudflare, not Fasthosts.

**Do not suggest changing Fasthosts DNS in future instructions.**

---

## 15. Conventions for Contributions

- Update `/docs/wiki` whenever user-facing changes occur.

- Add screenshots to:

  **`docs/wiki/images/`**

- Keep navigation blocks up to date if pages are added or renamed.

- Follow RBAC rules — never use email checks for permissions.

- Never commit `.env.local` or any other secrets.

- **Documentation maintenance**: When shipping user-facing features, follow the [Documentation Maintenance Checklist](Docs-Maintenance) to keep docs current.

---

## 16. Support & Contact

For onboarding, demos, or technical questions:

**contact@signpostingtool.co.uk**

---

## 17. Appendix: Architecture Diagram (ASCII)

```
               ┌────────────────────┐
               │      Browser       │
               └─────────┬──────────┘
                         │
                Next.js App Router
                         │
       ┌─────────────────┴─────────────────┐
       │                                   │
Server Actions                    API Routes (REST-style)
       │                                   │
       └──────────────┬────────────────────┘
                      │
                 Business Logic
                      │
       ┌──────────────┴────────────────┬─────────────┐
       │                               │             │
Symptom Engine                  Highlight Engine   AI Tools
       │                               │             │
       └───────────────────────────────┴─────────────┘
                      │
                   Prisma
                      │
                 Neon Postgres
```

---
