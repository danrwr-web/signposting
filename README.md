# NHS Signposting Toolkit (Web App)

A multi-tenant NHS-style web application for managing symptom signposting and reception triage instructions across GP surgeries.

Built with Next.js 15, TypeScript, Prisma (Postgres/Neon), and Tailwind CSS.

Designed by Dr Daniel Webber-Rookes (Ide Lane Surgery, Exeter).

The toolkit replaces the PowerApps version and includes 200+ pre-loaded symptoms. It now provides a comprehensive symptom library with enable/disable functionality, AI-powered tools, and enhanced administration capabilities.

---

## Features

### 🔹 Core Functionality

- **Role-based access**: Three-tier system (Superuser / Admin / Standard)
- **Multi-surgery data isolation**: Each surgery maintains independent symptom configurations
- **Symptom Library**: Intuitive file-explorer layout for enabling, disabling, and previewing symptoms
- **Appointments Directory**: Reception-friendly appointment catalogue with search, filtering by staff team, CSV import, and customisable entry cards
- **Base + override data model**: Shared base symptoms with per-surgery customisations
- **Clinical Review workflow**: Governance audit trail with reviewer tracking and sign-off
- **Engagement tracking**: Monitor symptom views and user suggestions
- **User suggestions**: Feedback mechanism for continuous improvement

### 🔹 AI Features

- **Generate Explanation**: Produces patient-friendly text from clinical instructions
- **Training Mode**: Short quiz-style scenarios for staff practice and reinforcement
- **Controlled via Feature Flags**: Hierarchical control (Superuser → Surgery → User)
- **Secure processing**: All requests handled securely via Azure OpenAI API
- **Usage tracking**: Visibility for superusers on AI feature usage

### 🔹 Administration

- **Redesigned dashboards**: Clean, modern interfaces for Users, Surgeries, Symptom Library, and Features
- **Add/Edit/Delete symptoms**: Full CRUD operations with confirmation dialogs
- **Feature-flag tab**: Control AI and future modules per surgery and user
- **Modernised layout**: Row-card design with badges and hover states
- **Rich Text Editor**: TipTap + ProseMirror integration with highlight preview
- **Image icon management**: Upload and configure icons that appear on symptom cards
- **Appointment staff teams**: Create surgery-specific staff teams, manage colour defaults, and sync with directory filters

### 🔹 UI and Accessibility

- **NHS-compliant palette and typography**: Follows NHS Design System guidelines
- **Fully responsive**: Optimised for desktop, tablet, and mobile devices
- **Dynamic highlighting**: Automatic highlighting for "Green / Orange / Red / Pink-Purple slots"
- **Optional image icons**: Visual indicators on symptom cards and instruction pages
- **Search and filtering**: By symptom name and age group (Under-5, Over-5, Adult)
- **WCAG 2.1 AA compliance**: Keyboard navigation, screen reader support, and proper focus management

### 🔹 Technical

- **Next.js App Router**: Modern routing with Server Actions
- **Prisma ORM**: Type-safe database access with Neon Postgres (production)
- **Authentication**: NextAuth (Credentials provider + JWT)
- **Testing**: Jest + React Testing Library
- **Deployment**: Vercel + Neon
- **Linting**: ESLint v9, TypeScript 5.5+
- **Performance**: API response caching, optimised database queries

---

## Setup

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

1. **Clone the repository:**

```bash
git clone <repository-url>
cd nhs-signposting
```

2. **Install dependencies:**

```bash
npm install
```

3. **Set up environment variables:**

```bash
cp .env.example .env.local
```

Edit `.env.local` with your configuration:

```env
# Database
DATABASE_URL="file:./dev.db"

# NextAuth Configuration
NEXTAUTH_SECRET="your-secret-here-change-this-in-production"
NEXTAUTH_URL="http://localhost:3000"

# App Configuration
NEXT_PUBLIC_APP_VERSION="v1.0 (Web Release)"

# Feature Flags
DONATIONS_ENABLED="false"

# Azure OpenAI (if using AI features)
AZURE_OPENAI_ENDPOINT=""
AZURE_OPENAI_API_KEY=""
AZURE_OPENAI_DEPLOYMENT_NAME=""
```

4. **Set up the database:**

```bash
# Generate Prisma client
npm run db:generate

# Push database schema
npm run db:push

# Seed with sample data
npm run db:seed
```

5. **Start the development server:**

```bash
npm run dev
```

The application will be available at `http://localhost:3000`.

**Note**: Prisma migrations run automatically on Vercel deployments via the `postinstall` script.

---

## Feature Flags

Feature control is hierarchical:

- **Superuser** → enables features per surgery
- **Admin** → can enable/disable per user (if surgery-level flag is ON)

Current seeded features:

- `ai_instructions` — Generate Explanation tool
- `ai_training` — Training Mode quizzes

Feature flags are managed via the Features tab in the admin dashboard.

---

## Screenshots

Screenshots of the application are available in `/docs/screenshots` or can be added to demonstrate key workflows.

---

## Clinical Governance

Each surgery must review and approve its own symptom guidance to ensure clinical governance and medico-legal clarity.

### Clinical Review Workflow

1. **Initial State**: When a surgery is created or after a re-review is requested, all symptoms start with a "PENDING" status, and a warning banner appears for all staff.

2. **Review Process**: Admins (or superusers) access the clinical review dashboard. For each symptom, they can mark it as:
   - **APPROVED**: Content is clinically appropriate
   - **CHANGES_REQUIRED**: Content needs modification

3. **Sign-off**: Once all symptoms are reviewed (none remain PENDING), the admin can complete the review, which removes the warning banner and records the reviewer identity and timestamp.

4. **Re-review**: Admins can request a re-review at any time, which resets all symptoms to PENDING and reapplies the warning banner (supports annual review cycles).

**Important**: All AI-generated text must be reviewed by a clinician before inclusion in live symptom guidance.

---

## Role-Based Access Control (RBAC)

### User Roles

1. **Superuser (Global)**
   - Manage all surgeries and users
   - Access global admin dashboard (`/admin`) and superuser dashboard (`/super`)
   - Can switch between any surgery
   - Enable/disable features per surgery

2. **Admin (Per-Surgery)**
   - Manage users within assigned surgery
   - Access surgery admin dashboard (`/s/[surgeryId]/admin`)
   - Enable/disable features per user
   - Manage symptom library for their surgery

3. **Standard (Per-Surgery)**
   - Use the toolkit within assigned surgery
   - Access surgery dashboard (`/s/[surgeryId]`)
   - No admin privileges

### Protected Routes

| Route | Access Required | Description |
|-------|----------------|-------------|
| `/admin/*` | **SUPERUSER only** | Global administration |
| `/s/[surgeryId]/admin/*` | **SUPERUSER or ADMIN** | Surgery-specific administration |
| `/s/[surgeryId]/clinical-review` | **SUPERUSER or ADMIN** | Clinical review dashboard |
| `/super/*` | **SUPERUSER only** | Superuser utilities |

All routes and API endpoints verify authentication and permissions server-side using RBAC helpers in `src/lib/rbac.ts`.

---

## Database Schema

### Core Models

- **User**: User accounts with global roles and surgery memberships
- **Surgery**: Individual surgeries/practices
- **UserSurgery**: Junction table linking users to surgeries with per-surgery roles
- **BaseSymptom**: Base symptom data (shared across surgeries)
- **SurgerySymptomOverride**: Per-surgery customisations
- **SurgeryCustomSymptom**: Surgery-specific custom symptoms
- **Suggestion**: User feedback
- **EngagementEvent**: Tracks user interactions
- **FeatureFlag**: Controls feature availability per surgery and user

---

## API Endpoints

### Public APIs

- `GET /api/symptoms` — Get effective symptoms for current surgery
- `GET /api/symptoms/[id]` — Get specific symptom details
- `POST /api/suggestions` — Submit user suggestions
- `GET /api/highlights` — Get highlight rules for current surgery

### Admin APIs

- `GET/POST/DELETE /api/admin/symptoms` — Manage symptoms
- `GET/POST/DELETE /api/admin/overrides` — Manage symptom overrides
- `GET /api/engagement/top` — Get engagement analytics
- `POST /api/admin/ai/generate` — Generate explanation (AI feature)
- `POST /api/admin/ai/training` — Training mode questions (AI feature)

All admin endpoints require authentication and appropriate role permissions.

---

## Deployment

### Environment Variables

For production deployment:

```env
# Database (PostgreSQL for production)
DATABASE_URL="postgresql://user:password@host:5432/database"

# NextAuth Configuration
NEXTAUTH_SECRET="your-secret-key-change-this"
NEXTAUTH_URL="https://your-domain.com"

# App Configuration
NEXT_PUBLIC_APP_VERSION="v1.0 (Web Release)"

# Azure OpenAI (if using AI features)
AZURE_OPENAI_ENDPOINT="https://your-resource.openai.azure.com"
AZURE_OPENAI_API_KEY="your-api-key"
AZURE_OPENAI_DEPLOYMENT_NAME="your-deployment-name"

# Feature Flags
DONATIONS_ENABLED="false"
```

### Build and Deploy

1. **Build the application:**

```bash
npm run build
```

2. **Deploy to Vercel:**

Prisma migrations run automatically via the `postinstall` script. Ensure your `DATABASE_URL` environment variable is set correctly in Vercel.

---

## Testing

Run tests with:

```bash
npm test
```

The project uses Jest and React Testing Library for unit and integration tests.

---

## Development Commands

```bash
# Database operations
npm run db:push          # Push schema changes
npm run db:migrate       # Create migration
npm run db:generate      # Generate Prisma client
npm run db:seed          # Seed database

# Development
npm run dev              # Start dev server
npm run build            # Build for production
npm run start            # Start production server
npm run lint             # Run ESLint
```

---

## Security

- All authentication uses NextAuth.js with credentials provider
- Passwords are stored as bcrypt hashes (12 salt rounds)
- Sessions use JWT tokens stored in secure HTTP-only cookies
- All admin routes and APIs verify authentication and roles server-side
- No hardcoded credentials or environment variable fallbacks

---

## Version History

| Date | Version | Notes |
|------|---------|-------|
| Nov 2025 | 1.0 (Web Release) | Feature Flags + AI tools + Symptom Library UI overhaul |
| Oct 2025 | 0.9 (Beta) | First public web beta |
| 2024 | Legacy PowerApps | Internal prototype |

---

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

---

## License

This project is licensed under the MIT License.

---

## Support

For support and questions:

- Check the troubleshooting section
- Review the API documentation
- Open an issue in the repository

---

> Developed by **Dr Daniel Webber-Rookes** and the team at Ide Lane Surgery, Exeter  
> © 2025 Signposting Toolkit – All rights reserved
