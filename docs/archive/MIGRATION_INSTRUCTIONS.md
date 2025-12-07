# Instructions Migration: Markdown to HTML

This document describes the one-time migration from Markdown/plain text instructions to HTML format.

## Overview

The migration converts all symptom instructions from the legacy `instructions` field to the new `instructionsHtml` field using proper Markdown-to-HTML conversion with unified.js.

## Backup and Safety

### Creating a Backup

Before running the migration, create a backup of affected rows:

```bash
# The migration script automatically creates a backup
npm run migrate:instructions
```

This creates `instructions-backup.json` with all affected rows before making changes.

### Manual Backup (Alternative)

```sql
-- Backup base symptoms
SELECT id, name, instructions, instructionsHtml 
FROM "BaseSymptom" 
WHERE "instructionsHtml" IS NULL OR "instructionsHtml" = '';

-- Backup surgery overrides  
SELECT "surgeryId", "baseSymptomId", instructions, "instructionsHtml"
FROM "SurgerySymptomOverride"
WHERE "instructionsHtml" IS NULL OR "instructionsHtml" = '';

-- Backup custom symptoms
SELECT id, name, instructions, "instructionsHtml"
FROM "SurgeryCustomSymptom" 
WHERE "instructionsHtml" IS NULL OR "instructionsHtml" = '';
```

## Running the Migration

### Local Development

```bash
# Run against local database
npm run migrate:instructions
```

### Production (Neon)

```bash
# Set production database URL
export DATABASE_URL="postgresql://..."

# Run migration
npm run migrate:instructions
```

## Rollback Procedure

If you need to rollback the migration:

### Using JSON Backup

```bash
# Restore from automatic backup
node -e "
const fs = require('fs');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function restore() {
  const backup = JSON.parse(fs.readFileSync('instructions-backup.json', 'utf8'));
  
  // Restore base symptoms
  for (const symptom of backup.baseSymptoms) {
    await prisma.baseSymptom.update({
      where: { id: symptom.id },
      data: { instructionsHtml: null }
    });
  }
  
  // Restore surgery overrides
  for (const override of backup.overrides) {
    await prisma.surgerySymptomOverride.update({
      where: {
        surgeryId_baseSymptomId: {
          surgeryId: override.surgeryId,
          baseSymptomId: override.baseSymptomId
        }
      },
      data: { instructionsHtml: null }
    });
  }
  
  // Restore custom symptoms
  for (const symptom of backup.customSymptoms) {
    await prisma.surgeryCustomSymptom.update({
      where: { id: symptom.id },
      data: { instructionsHtml: null }
    });
  }
  
  console.log('Rollback completed');
  await prisma.$disconnect();
}

restore().catch(console.error);
"
```

### Manual SQL Rollback

```sql
-- Clear instructionsHtml fields to force fallback to legacy field
UPDATE "BaseSymptom" SET "instructionsHtml" = NULL;
UPDATE "SurgerySymptomOverride" SET "instructionsHtml" = NULL;  
UPDATE "SurgeryCustomSymptom" SET "instructionsHtml" = NULL;
```

## Migration Details

### What Gets Converted

- **Markdown lists** → HTML `<ul>`/`<ol>` lists
- **Line breaks** → HTML `<br>` tags
- **Bold/italic** → HTML `<strong>`/`<em>` tags
- **Links** → HTML `<a>` tags
- **Tables** → HTML `<table>` elements
- **Code blocks** → HTML `<pre><code>` elements

### What Gets Preserved

- **Existing HTML** → Copied through unchanged
- **Plain text** → Wrapped in `<p>` tags
- **Empty content** → Skipped (no changes)

### Example Conversion

**Before (Markdown):**
```markdown
## Treatment Options

1. **Mild symptoms**: Signpost Community Pharmacy
2. **Severe symptoms**: Contact GP immediately
3. **Emergency**: Call 111 or go to A&E

### Important Notes
- Take medication as prescribed
- Monitor symptoms closely
```

**After (HTML):**
```html
<h2>Treatment Options</h2>
<ol>
<li><strong>Mild symptoms</strong>: Signpost Community Pharmacy</li>
<li><strong>Severe symptoms</strong>: Contact GP immediately</li>
<li><strong>Emergency</strong>: Call 111 or go to A&E</li>
</ol>
<h3>Important Notes</h3>
<ul>
<li>Take medication as prescribed</li>
<li>Monitor symptoms closely</li>
</ul>
```

## Post-Migration

After migration:

1. **All render paths** prefer `instructionsHtml` when present
2. **Fallback** to legacy `instructions` field if `instructionsHtml` is null/empty
3. **Sanitization** applied before `dangerouslySetInnerHTML`
4. **Rich text editor** saves to `instructionsHtml` field going forward

## Troubleshooting

### Migration Fails

1. Check database connection
2. Verify Prisma client is generated (`npm run db:generate`)
3. Check backup file was created
4. Review console logs for specific errors

### Content Looks Wrong

1. Check if content was already HTML (should be copied through)
2. Verify Markdown syntax was correct
3. Review unified.js processing logs
4. Consider manual fixes for edge cases

### Performance Issues

- Migration processes rows in batches
- Large datasets may take several minutes
- Monitor database connection during migration
- Consider running during low-traffic periods
