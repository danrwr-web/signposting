# Documentation Maintenance Checklist

## Navigation

- [Home](Home)

- [Getting Started](Getting-Started)

- [User Guide](User-Guide)

- [Day-to-day use](Day-to-day-use)

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

Documentation is now externally visible and used by practices for evaluation, governance, and onboarding. Keeping it accurate and current prevents confusion and maintains trust.

Use this checklist when shipping or modifying user-facing features:

1. **Update Release Notes** — Add user-visible changes to `/docs/RELEASE_NOTES.md` under the appropriate version section (New, Updated, or Fixed).

2. **Update README "Recently shipped"** — Add 1–2 short bullets to the "Recently shipped" section in `/docs/README.md` for the most visible improvements.

3. **Update affected wiki pages** — Review and update relevant pages in `/docs/wiki` to reflect new features, removed capabilities, or changed workflows.

4. **Verify marketing claims** — Ensure any claims in marketing copy, landing pages, or feature descriptions match actual behaviour in the codebase.

5. **Avoid listing baseline features as "new"** — Features listed in the "Baseline Platform" section of Release Notes should not appear as new items in later releases.

6. **Check links after routing changes** — When routes or navigation change, verify all internal documentation links still work and point to the correct locations.

7. **Mark AI features as optional** — Always indicate when AI features are feature-flagged or optional, and emphasise that clinical review is mandatory.

8. **Keep terminology consistent** — Use consistent naming throughout (e.g., "Practice Handbook" not "Admin Toolkit" in user-facing docs, though code may still reference the old name).

9. **Update screenshots when UI changes** — Replace outdated screenshots in wiki pages and README when the interface changes significantly.

10. **Sync "What's New" sections** — After updating Release Notes, ensure the "What's New" sections in `/docs/README.md` and `/docs/wiki/Home.md` are aligned and point to Release Notes.

11. **Verify cross-references** — Check that related pages link to each other correctly and that the navigation blocks in all wiki pages are complete.

12. **Test GitHub Pages compatibility** — Ensure all image paths use relative links compatible with GitHub Pages (e.g., `images/logo.png` not `../public/images/logo.png`).

---

## Quick Reference

- **Release Notes**: `/docs/RELEASE_NOTES.md`
- **Docs homepage**: `/docs/README.md`
- **Wiki pages**: `/docs/wiki/`
- **Cursor rule**: `.cursor/rules/wiki-updates.mdc`

For detailed guidance on documentation structure and conventions, see the [Developer Guide](Developer-Guide).

---

## Audit Reports

Periodic documentation audits verify link integrity, content accuracy, and coverage.

- [Docs Audit Report (January 2026)](Docs-Audit-Report) — Latest audit findings and recommendations
