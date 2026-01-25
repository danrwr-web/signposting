# Signposting Toolkit

📚 Documentation: https://danrwr-web.github.io/signposting/

A web-based signposting and care-navigation toolkit for GP reception and care navigation teams. Built within an NHS practice, this toolkit provides structured, clinically-approved guidance to help teams route patients safely and consistently.

<!-- BUMP: 2026-01-20T12:00:00Z -->

---

## Overview

The Signposting Toolkit helps primary care teams send patients to the right service first time. It replaces guesswork with clarity, ensuring teams make the same safe decisions even on the busiest days.

The toolkit provides a structured symptom library, local customisation, AI-assisted clarity tools, an appointment directory, and a full governance workflow for clinical review — all delivered through a clean, modern, NHS-aligned interface.

---

## Key Features

- **Symptom Library** — 200+ base symptoms with local overrides and custom symptom creation
- **High-risk Flags and Highlighting** — Automatic colour-coding highlights urgent phrases and high-risk symptoms
- **AI Instruction Editor** — AI-powered tools to improve instruction clarity (with mandatory clinical review)
- **AI Suggested Questions** — Generates grouped triage-style questions to help staff gather information safely
- **Appointment Directory** — Simple, searchable catalogue of local services and appointment types
- **Admin Toolkit** — Surgery-specific guidance pages with Items and Structure & Settings admin tabs
- **Workflow Guidance** — Step-by-step workflows for processing common documents (with global defaults and per-surgery customisation)
- **Clinical Review Workflow** — Every symptom must be clinically approved before going live
- **Multi-surgery / Tenancy Model** — Complete data isolation between practices with independent configurations
- **Role-based Access Control** — Three-level hierarchy: Superuser / Surgery Admin / Standard user

---

## Screenshots

_Screenshots coming soon. See [documentation](docs/wiki/Home.md) for more information._

<!-- When screenshots are available, uncomment and update paths:
![Symptom Detail](docs/wiki/images/symptom-detail.png)
![Dashboard](docs/wiki/images/dashboard.png)
![Appointment Directory](docs/wiki/images/appointment-directory.png)
-->

---

## Documentation

Comprehensive documentation is available in the repository:

- **[Main Documentation](docs/wiki/Home.md)** — Complete user and administrator guide

**Documentation Topics:**
- [Symptom Library](docs/wiki/Symptom-Library.md) — Symptom system details
- [Clinical Governance](docs/wiki/Clinical-Governance.md) — Review workflow and safety
- [AI Features](docs/wiki/AI-Features.md) — AI tools and safety checks
- [Appointment Directory](docs/wiki/Appointment-Directory.md) — Appointment types and filtering
- [High-Risk & Highlighting](docs/wiki/High-Risk-&-Highlighting.md) — Visual indicators and rules
- [Multi-Surgery & RBAC](docs/wiki/Multi-Surgery-&-RBAC.md) — Multi-tenancy and permissions
- [Developer Guide](docs/wiki/Developer-Guide.md) — Architecture and development

**Hosted Documentation:** _(to be added once GitHub Pages is enabled)_

---

## Installation

### Prerequisites

- Node.js 18+ and npm
- PostgreSQL database (Neon Postgres recommended)
- Azure OpenAI account (optional, for AI features)

### Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/danrwr-web/signposting.git
   cd signposting
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   
   Create a `.env.local` file:
   ```env
   DATABASE_URL="postgresql://user:password@host:5432/db"
   NEXTAUTH_SECRET="your-secret-here"
   NEXTAUTH_URL="http://localhost:3000"
   
   AZURE_OPENAI_ENDPOINT=""
   AZURE_OPENAI_API_KEY=""
   AZURE_OPENAI_DEPLOYMENT_NAME=""
   
   NEXT_PUBLIC_APP_VERSION="v1.1"
   ```

4. **Database setup**
   ```bash
   npm run db:generate
   npm run db:push
   npm run db:seed
   ```

5. **Start development server**
   ```bash
   npm run dev
   ```

Visit `http://localhost:3000` to view the application.

---

## Testing

```bash
npm test
```

---

## Authentication & RBAC

Authentication uses NextAuth (Credentials Provider) with secure JWT sessions.

**User Roles:**
- **Superuser** — System-wide access, manages base symptom library
- **Surgery Admin** — Manages their practice's configuration and users
- **Standard User** — Views approved symptoms and uses the directory

All protected routes are validated server-side.

---

## Deployment

The application is designed to work natively with Vercel serverless functions.

- Prisma migrations run via `postinstall` hook
- Ensure `DATABASE_URL` is set in Vercel environment settings
- See [Developer Guide](docs/wiki/Developer-Guide.md) for deployment details

---

## Troubleshooting

**NHS Network Blocking**  
If a trust firewall blocks the domain, IT may need to allowlist it. Errors often originate from National Cyber Security Centre (NCSC) filtering, not local firewalls.

**CORS**  
Avoid direct API calls from other domains — use server actions.

**Login Loop**  
Check `NEXTAUTH_URL` matches deployed domain.

**Missing Symptoms or Highlights**  
Ensure clinical review is complete; pending symptoms hide features.

---

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

---

## Contact

For questions, support, or enquiries about commercial licensing:

**contact@signpostingtool.co.uk**

---

## License

This project is released under the **Business Source License 1.1 (BUSL-1.1)**.

This license makes the source code available for viewing and non-production use, but restricts unauthorised commercial use. For commercial licensing, please contact us at **contact@signpostingtool.co.uk**.

See [LICENSE](LICENSE) for full terms. The Change Date is 2029-01-01, after which the license will convert to MIT or Apache 2.0.

---

© 2025 Signposting Toolkit
