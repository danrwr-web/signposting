# Signposting Toolkit — Documentation Site

Built with [Nextra](https://nextra.site) (Next.js-based docs framework).

## Setup

```bash
npm install
npm run dev
```

Visit `http://localhost:3000` to preview the docs locally.

## Build & Deploy

```bash
npm run build
```

This produces a static export in the `out/` directory.

### Deploying to Vercel

The live site (`docs.signpostingtool.co.uk`) is deployed on **Vercel** from this
`docs-site/` project — automatically on git push.

1. Push this project to a Git repository
2. Import it in Vercel (vercel.com/new)
3. Vercel auto-detects Next.js and builds it
4. Point the `docs.signpostingtool.co.uk` domain at the Vercel deployment

The `out/` static export can also be hosted on any static provider if needed.

## Project Structure

```
pages/
├── index.mdx                          # Home page
├── release-notes.mdx                  # Release notes
├── _meta.ts                           # Root sidebar config
├── _app.tsx                           # Global styles
├── getting-started/
│   ├── _meta.ts                       # "Getting Started" sidebar group
│   ├── index.mdx                      # Getting Started
│   ├── user-guide.mdx                 # User Guide
│   ├── day-to-day-use.mdx             # Day-to-Day Use
│   └── after-go-live.mdx              # After Go-Live
├── features/
│   ├── _meta.ts                       # "Features" sidebar group
│   ├── symptom-library.mdx
│   ├── appointment-directory.mdx
│   ├── practice-handbook.mdx
│   ├── ai-features.mdx
│   ├── workflow-guidance.mdx
│   ├── high-risk-and-highlighting.mdx
│   └── analytics.mdx
├── governance/
│   ├── _meta.ts                       # "Governance & Admin" sidebar group
│   ├── clinical-governance.mdx
│   ├── multi-surgery-and-rbac.mdx
│   └── admin-guide.mdx
└── technical/
    ├── _meta.ts                       # "Technical" sidebar group
    └── developer-guide.mdx
```

## Customisation

- **Theme config**: `theme.config.tsx` — Logo, footer, navigation settings
- **Styles**: `globals.css` — NHS colour palette, custom components
- **Sidebar**: `_meta.ts` files in each folder control ordering and labels
- **Images**: Place in `public/images/`
