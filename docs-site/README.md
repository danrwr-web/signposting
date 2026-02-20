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

This produces a static export in the `out/` directory, which can be deployed to:

- **Vercel** (recommended — automatic from git push)
- **GitHub Pages** (deploy the `out/` folder)
- Any static hosting provider

### Deploying to Vercel

1. Push this project to a Git repository
2. Import it in Vercel (vercel.com/new)
3. Vercel will auto-detect Next.js and build it
4. Point your `docs.signpostingtool.co.uk` domain to the Vercel deployment

### Deploying to GitHub Pages

1. Run `npm run build`
2. Deploy the `out/` directory to your GitHub Pages branch
3. Ensure your custom domain is configured

## Project Structure

```
pages/
├── index.mdx                          # Home page
├── _meta.json                         # Root sidebar config
├── _app.tsx                           # Global styles
├── getting-started/
│   ├── _meta.json                     # "Getting Started" sidebar group
│   ├── index.mdx                      # Getting Started
│   ├── user-guide.mdx                 # User Guide
│   └── day-to-day-use.mdx             # Day-to-Day Use
├── features/
│   ├── _meta.json                     # "Features" sidebar group
│   ├── symptom-library.mdx
│   ├── appointment-directory.mdx
│   ├── ai-features.mdx
│   ├── workflow-guidance.mdx
│   └── high-risk-and-highlighting.mdx
├── governance/
│   ├── _meta.json                     # "Governance & Admin" sidebar group
│   ├── clinical-governance.mdx
│   ├── multi-surgery-and-rbac.mdx
│   └── admin-guide.mdx
└── technical/
    ├── _meta.json                     # "Technical" sidebar group
    └── developer-guide.mdx
```

## Customisation

- **Theme config**: `theme.config.tsx` — Logo, footer, navigation settings
- **Styles**: `globals.css` — NHS colour palette, custom components
- **Sidebar**: `_meta.json` files in each folder control ordering and labels
- **Images**: Place in `public/images/`

## Migrating Existing Content

Each `.mdx` page has a `{/* TODO */}` comment showing where to paste your existing markdown content. The pages include placeholder structure that matches your current docs — replace with your actual content.
