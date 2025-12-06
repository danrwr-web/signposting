# Signposting Toolkit

A modern, NHS-aligned web application that helps reception and care-navigation teams route patients safely and consistently.  
Built with **Next.js**, **TypeScript**, **Prisma**, and **Neon Postgres**.

The toolkit includes a structured symptom library, per-surgery customisation, AI tools, an appointment directory, clinical review governance, and optional central updates.

---

## 🚀 Features at a Glance

- 200+ base symptoms with local overrides  
- Age filters, high-risk quick buttons, alphabet navigation  
- Appointment Directory with CSV import  
- AI Instruction Editor  
- AI Suggested Question Prompts  
- Multi-surgery tenancy with data isolation  
- Role-based access (Superuser / Admin / Standard)  
- Clinical review audit trail  
- Highlight rules (green/orange/red/pink/purple)  
- Icons on symptom cards and instruction pages  
- User suggestions and engagement analytics  
- Smart preferences panel: appearance, quick-scan mode, header layout  
- Fully responsive UI using the NHS palette  

Screenshots (placeholders):

---

## 🛠️ Installation

### 1. Clone the repository

```bash
git clone <repo-url>
cd signposting-toolkit
2. Install dependencies
bash
Copy code
npm install
3. Environment Variables
Create a .env.local:

env
Copy code
DATABASE_URL="postgresql://user:password@host:5432/db"
NEXTAUTH_SECRET="your-secret"
NEXTAUTH_URL="http://localhost:3000"

AZURE_OPENAI_ENDPOINT=""
AZURE_OPENAI_API_KEY=""
AZURE_OPENAI_DEPLOYMENT_NAME=""

NEXT_PUBLIC_APP_VERSION="v1.1"
4. Database Setup
bash
Copy code
npm run db:generate
npm run db:push
npm run db:seed
5. Start Development Server
bash
Copy code
npm run dev
🧪 Testing
bash
Copy code
npm test
🔐 Authentication & RBAC
Authentication uses NextAuth (Credentials Provider) with secure JWT sessions.
User roles:

Superuser

Surgery Admin

Standard User

Protected routes validated server-side.

🚀 Deployment (Vercel)
Works natively with serverless functions.

Prisma migrations run via postinstall.

Ensure DATABASE_URL is set in Vercel environment settings.

⚠️ Troubleshooting
NHS network blocking
If a trust firewall blocks the domain, IT may need to allowlist it.
Errors often originate from National Cyber Security Centre (NCSC) filtering, not local firewalls.

CORS
Avoid direct API calls from other domains — use server actions.

Login loop
Check NEXTAUTH_URL matches deployed domain.

Missing symptoms or highlights
Ensure clinical review is complete; pending symptoms hide features.

🤝 Contributing
Fork the repo

Create a feature branch

Submit PR

📄 License
MIT.

Developed by Dr Daniel Webber-Rookes, Ide Lane Surgery, Exeter
© 2025 Signposting Toolkit