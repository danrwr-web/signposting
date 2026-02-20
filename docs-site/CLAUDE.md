# Docs Site

This is a Nextra 3 docs site. Pages are .mdx files in pages/.

- Sidebar structure is defined by _meta.ts files in each folder
- When adding a new page, add an entry to the relevant _meta.ts
- Keep the NHS tone: clear, plain English, no jargon
- Always include cross-links to related pages
- Update the version banner on index.mdx when the app version changes
- Images go in public/images/ and are referenced as /images/filename.png
- Internal links use absolute paths e.g. /features/symptom-library
- Custom CSS classes for the home page are defined in globals.css
