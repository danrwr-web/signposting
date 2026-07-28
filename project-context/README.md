# Project Context

This directory contains concise, current cross-cutting context for maintainers and AI assistants.

## Start here

1. [Current Product Overview](CURRENT_PRODUCT_OVERVIEW.md)
2. [Current Architecture](CURRENT_ARCHITECTURE.md)
3. [Module Status](MODULE_STATUS.md)
4. [Sources of Truth](SOURCE_OF_TRUTH.md)
5. [Resource Register](RESOURCE_REGISTER.md)

## Scope

These files summarise current state and help resolve conflicts between old briefs, current documentation and implementation.

They do not replace:

- The public Nextra documentation in `docs-site/`
- Release notes in `docs-site/pages/release-notes.mdx`
- Root `CLAUDE.md` engineering conventions
- Tests and production code
- Module-specific architecture references

## Maintenance

Update the relevant context file in the same pull request when a change materially affects:

- Product modules or terminology
- Deployment or repository architecture
- Feature status
- Source-of-truth rules
- Classification of an older project resource

Avoid turning this directory into a duplicate documentation site. Keep it concise, dated and cross-cutting.