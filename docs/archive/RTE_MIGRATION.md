# Rich Text Editor Migration Guide

## Overview

This document outlines the migration from markdown-based instructions to TipTap ProseMirror JSON format for symptom instructions.

## Database Changes

### New Fields Added

- `instructions_json` (JSON) - ProseMirror JSON format (canonical)
- `instructions` (String) - Legacy markdown field (kept for back-compat)

### Models Updated

- `BaseSymptom`
- `SurgerySymptomOverride` 
- `SurgeryCustomSymptom`

## Migration Strategy

### Automatic Migration

When editing an existing symptom:

1. **Check for existing data**:
   - If `instructions_json` is null but `instructions` exists → Import markdown to TipTap JSON
   - If `instructions_json` exists → Use it directly

2. **Import process**:
   - Use `tiptap-markdown` to convert markdown → ProseMirror JSON
   - Save JSON to `instructions_json` field
   - Keep original markdown in `instructions` for reference

3. **Save process**:
   - Save ProseMirror JSON to `instructions_json` (canonical)
   - Optionally export to markdown and save to `instructions` (back-compat)

### Manual Migration

For bulk migration of existing data, run:

```typescript
// Migration script example
const symptoms = await prisma.baseSymptom.findMany({
  where: {
    instructions: { not: null },
    instructionsJson: null
  }
})

for (const symptom of symptoms) {
  if (symptom.instructions) {
    const json = markdownToProseMirror(symptom.instructions)
    await prisma.baseSymptom.update({
      where: { id: symptom.id },
      data: { instructionsJson: json }
    })
  }
}
```

## API Changes

### Symptom Creation/Update

```typescript
// New format
{
  name: "Chest Pain",
  instructionsJson: {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [
          { type: "text", text: "If you have chest pain, " },
          { type: "text", text: "call 999 immediately", marks: [{ type: "bold" }] }
        ]
      }
    ]
  },
  instructions: "If you have chest pain, **call 999 immediately**" // Optional back-compat
}
```

## Rendering

### Read-only Display

```typescript
import { sanitizeHtml } from '@/lib/sanitizeHtml'

// Render ProseMirror JSON as sanitized HTML
const html = proseMirrorToHtml(symptom.instructionsJson)
const sanitized = sanitizeHtml(html)
```

### Editor Integration

```typescript
<TipTapEditor
  value={symptom.instructionsJson}
  onChange={(json, markdown) => {
    // Save both formats
    updateSymptom({
      instructionsJson: json,
      instructions: markdown // Optional
    })
  }}
/>
```

## Rollback Plan

If rollback is needed:

1. **Disable TipTap editor** in admin interface
2. **Revert to markdown textarea** for editing
3. **Use `instructions` field** for display (existing highlighting system)
4. **Data remains intact** - no data loss

## Testing

- ✅ New symptoms save both JSON and markdown
- ✅ Existing symptoms migrate automatically on edit
- ✅ Read-only display renders correctly
- ✅ Import/export functions work
- ✅ NHS badges render with correct styling
