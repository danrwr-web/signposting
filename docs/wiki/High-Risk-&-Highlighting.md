# High-Risk & Highlighting

## Navigation

- [Home](Home)

- [Getting Started](Getting-Started)

- [User Guide](User-Guide)

- [Day-to-day use](Day-to-day-use)

- [Symptom Library](Symptom-Library)

- [Clinical Governance](Clinical-Governance)

- [AI Features](AI-Features)

- [Appointment Directory](Appointment-Directory)

- [Daily Dose](Daily-Dose)

- [Workflow Guidance](Workflow-Guidance)

- [High-Risk & Highlighting](High-Risk-&-Highlighting)

- [Multi-Surgery & RBAC](Multi-Surgery-&-RBAC)

- [Admin Guide](Admin-Guide)

- [Developer Guide](Developer-Guide)

The Signposting Toolkit uses visual highlighting to help staff quickly identify high-risk symptoms and important information. Colour-coded phrases and prominent high-risk buttons ensure critical cases are noticed immediately.

---

## High-Risk Symptoms

High-risk symptoms are those requiring urgent attention or immediate clinical assessment. The system provides quick access to these symptoms through prominent buttons and clear visual indicators.

### High-Risk Quick Buttons

High-risk quick buttons provide instant access to urgent symptoms directly from the homepage and symptom library.

#### Button Styles
- **Pill Style** — Rounded pill-shaped buttons
- **Tile Style** — Square tile buttons with icons

Users can choose their preferred style in preferences.

#### Benefits
- One-click access to critical symptoms
- Consistent placement for muscle memory
- Visual prominence ensures visibility
- Customisable appearance

### High-Risk Configuration

Admins can configure which symptoms appear as high-risk buttons:

#### Configuration Options
- Select symptoms to feature
- Customise button order
- Add custom high-risk symptoms
- Remove non-applicable options

#### Best Practices
- Limit to most critical symptoms
- Keep list manageable (5-10 buttons)
- Review regularly for relevance
- Update as pathways change

---

## Highlight Engine

The highlight engine automatically colours key phrases in symptom instructions, making important information stand out at a glance.

### How It Works

The system scans instruction text for specific phrases and applies colour-coding automatically. This happens in real-time when instructions are displayed.

### Built-in Highlighting

The system includes built-in recognition for common phrases:

#### Slot Types
- **Orange slot** — Standard appointments requiring booking
  - Background: Orange
  - Text: White
  - Usage: Regular appointment bookings

- **Red slot** — Urgent appointments
  - Background: Red
  - Text: White
  - Usage: Same-day urgent care

- **Pink/Purple** — Specific service types
  - Background: Purple
  - Text: White
  - Usage: Specialised services

- **Green** — Community or pharmacy pathways
  - Background: Green
  - Text: White
  - Usage: Self-care or community services

### Custom Highlight Rules

Surgeries can create custom highlight rules to colour-code any phrase they choose.

#### Rule Configuration
- **Phrase** — Text to highlight
- **Text Colour** — Foreground colour
- **Background Colour** — Background colour
- **Enabled/Disabled** — Toggle rule on/off

Notes:
- Phrases are treated as the same if they only differ by case or extra spaces (for example, “Pharmacy” and “  pharmacy  ”).
- If you try to add a phrase that already exists, the Admin Dashboard will guide you to edit the existing rule instead.

#### Use Cases
- Local service names
- Specific referral pathways
- Surgery-specific terminology
- Important warnings or notes

#### Rule Precedence
Custom rules take precedence over built-in highlights. This ensures local preferences override defaults when needed.

---

## Highlight Colours

The system uses a consistent colour palette aligned with NHS design principles:

### Colour Meanings

While colours can be customised, the default meanings are:

- **Orange** — Standard appointments, routine care
- **Red** — Urgent care, same-day appointments
- **Pink/Purple** — Specialised services, specific pathways
- **Green** — Community services, pharmacy, self-care
- **Blue** — Information, general guidance

### Accessibility

All highlight colours meet WCAG 2.1 AA contrast requirements:
- Minimum 4.5:1 contrast for text
- 3:1 for large text and icons
- Accessible to colour-blind users
- Clear visual distinction

---

## Configuration

### Admin Access

Only surgery admins and superusers can configure highlight rules and high-risk buttons.

### Highlight Rule Management

1. **Add New Rule**
   - Enter phrase to highlight
   - Choose text and background colours
   - Enable the rule
   - Save

2. **Edit Existing Rule**
   - Modify phrase or colours
   - Enable/disable as needed
   - Update settings

3. **Delete Rule**
   - Remove custom rules
   - Built-in rules cannot be deleted
   - Can be disabled instead

### High-Risk Button Configuration

1. **Select Symptoms**
   - Choose from available symptoms
   - Add to high-risk list
   - Remove if no longer needed

2. **Order Buttons**
   - Arrange in priority order
   - Most critical first
   - Update as needed

3. **Custom Buttons**
   - Add custom high-risk entries
   - Link to specific symptoms
   - Remove when obsolete

---

## Visual Impact

### For Staff

Highlighting helps staff:
- Scan instructions quickly
- Identify key information instantly
- Notice urgent appointments
- Reduce reading time
- Improve accuracy

### For Patients

Indirectly benefits patients through:
- Faster triage
- More accurate routing
- Reduced wait times
- Better care navigation

---

## Best Practices

### For Admins

1. **Highlight Key Information Only**
   - Avoid over-highlighting
   - Focus on critical phrases
   - Keep rules relevant

2. **Use Consistent Colours**
   - Stick to standard meanings
   - Document custom colours
   - Train staff on colour system

3. **Review Regularly**
   - Update rules as pathways change
   - Remove obsolete highlights
   - Add new relevant phrases

4. **Test Visibility**
   - Ensure colours are distinct
   - Check accessibility
   - Verify readability

### For Staff

1. **Understand Colour Meanings**
   - Know what each colour indicates
   - Follow highlighted guidance
   - Ask if unclear

2. **Use High-Risk Buttons**
   - Familiarise with button locations
   - Use for urgent cases
   - Report missing symptoms

---

## Technical Details

### Highlight Engine Processing

1. Text is scanned for phrases
2. Custom rules applied first
3. Built-in rules applied second
4. HTML output with CSS classes
5. Rendered with appropriate colours

### Performance

- Highlighting is fast and efficient
- No noticeable delay in display
- Works with all instruction lengths
- Cached where possible

---

## Related Pages

- [Symptom Library](Symptom-Library) — Where highlighting appears
- [Multi-Surgery & RBAC](Multi-Surgery-&-RBAC) — Admin permissions
- [Developer Guide](Developer-Guide) — Technical implementation

---

_Last updated: December 2025_

