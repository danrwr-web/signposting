# 🧑‍💻 Developer Guide

*A practical guide for developers working on the Signposting Toolkit.*

## Navigation

- [Home](Home)

- [Getting Started](Getting-Started)

- [Symptom Library](Symptom-Library)

- [Clinical Governance](Clinical-Governance)

- [AI Features](AI-Features)

- [Appointment Directory](Appointment-Directory)

- [High-Risk & Highlighting](High-Risk-&-Highlighting)

- [Multi-Surgery & RBAC](Multi-Surgery-&-RBAC)

- [Developer Guide](Developer-Guide)

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

## 12. Local Testing Accounts

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
