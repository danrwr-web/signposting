# Workflow Engine – Architecture & Behaviour Guide

This document captures the current design, constraints, and learned behaviours of the workflow engine used in the Signposting Toolkit.  
It exists to prevent regressions, explain non-obvious decisions, and provide context for future development.

---

## 1. Core Concepts

### Node Types
The workflow engine is built on React Flow and supports the following node types:

- **INSTRUCTION** – informational step, no branching
- **QUESTION** – decision point with Yes/No (or multiple) answers (rendered as diamond shape)
- **OUTCOME / END** – terminal action (e.g. Forward to GP, File without forwarding)
- **PANEL** – resizable container grouping a sub-workflow (background grouping, not connectable)
- **REFERENCE** – non-connectable informational list (e.g. "Letters which can be filed without forwarding")

Each node type has a dedicated React component and styling rules.

### Node Type → React Flow Component Mapping
- `INSTRUCTION` → `instructionNode` component
- `QUESTION` → `decisionNode` component  
- `END` → `outcomeNode` component
- `PANEL` → `panelNode` component
- `REFERENCE` → `referenceNode` component

---

## 2. React Flow Integration (Critical)

### Coordinate Space Rules (VERY IMPORTANT)
- **Edges and nodes must share the same coordinate space**
- Do **not** apply `position: relative` to `.react-flow__edges`
- Do **not** create alternate positioning contexts around the canvas

❗ Past bugs showed that even `position: relative` (with no offset) on the edges container causes:
- Edge anchor offsets
- Handles not aligning with visible nodes
- Zoom-related drift

**Rule:**  
Let React Flow own positioning. Only use `z-index` for layering.

---

## 3. PANEL Nodes (Resizable Containers)

### Behaviour
- PANEL nodes are resizable by the user
- Width/height is persisted to the database
- Other node types must NOT persist width/height
- **Minimum dimensions**: 300px width × 200px height (enforced on load and resize)
- **PANEL nodes are NOT connectable** — they have no handles and cannot be used as connection points

### Persistence Rules
- Dimensions must be stored in **both** `node.width`/`node.height` AND `node.style.width`/`node.style.height`
- This dual storage prevents React Flow from treating PANEL nodes as auto-sized
- During active resize sessions, local dimensions are preserved to prevent server refreshes from overwriting user changes

### Key Rule
- **Only PANEL nodes may have explicit width/height**
- All other nodes must rely on DOM measurement by React Flow

Violating this causes:
- Handle misalignment
- Edge anchoring errors
- Zoom drift

---

## 4. Node Sizing Rules (Non-PANEL)

- Use `minWidth` / `minHeight`, **not** `width` / `height`
- Allow content to define final size
- React Flow will measure the DOM correctly when this rule is followed

### Special Cases
- **QUESTION nodes** have fixed dimensions: 240px × 160px (required for diamond shape SVG)
- **REFERENCE nodes** have minimum width: 320px (enforced via `minWidth` style)

---

## 5. Details Panel (Right-Hand Panel)

### Behaviour
- The Details panel:
  - Pushes the canvas (does NOT overlay)
  - Opens when:
    - Any node is clicked
    - ℹ️ info badge is clicked
- Panel open/close triggers:
  - `fitView()` on React Flow
  - `resize` events to force recalculation

### Important Insight
The canvas *is not actually overlapping* — it was visually misleading because React Flow retained its previous viewport width.

**Solution:**  
Always call `fitView()` when the panel opens or closes.

---

## 6. ℹ️ Info Badge Logic

### When ℹ️ Should Appear
ℹ️ is shown **only when the node has additional information**, such as:

- Reference content (lists, extra info)
- Linked workflows
- Additional body/description not shown on the node face

ℹ️ must NOT appear when the Details panel would simply repeat what is already visible.

### Implementation Rule
- Badge visibility is computed client-side
- Functions must **not** be stored in the database
- If needed, compute `showInfoBadge` during flowNodes mapping

---

## 7. Click Behaviour (UX Rule)

- Clicking **anywhere on a node** opens the Details panel
- ℹ️ is optional and supplementary
- Dragging still works normally
- Clicking handles does NOT open Details

This avoids fiddly interaction and improves accessibility.

---

## 8. Node → Details Communication

### Critical Pattern
Node components only receive `NodeProps`.

To trigger external behaviour:
- Functions (e.g. `openDetailsForNode`) must be passed via `node.data`
- Never via props on `nodeTypes`

Example:
```ts
data: {
  ...existingData,
  onInfoClick: (nodeId) => openDetailsForNode(nodeId),
}
```

### Info Badge Visibility Rules
The `shouldShowInfoBadge()` function determines badge visibility based on:
1. **Linked workflows**: Shows if `linkedWorkflowsCount > 0` or `workflowLinks` array has items
2. **REFERENCE content**: Shows if reference items exist with non-empty text or info fields
3. **Body content**: Shows if node has body/description/details text that isn't visible on the node face

Badge is hidden when Details panel would only show content already visible on the node.

---

## 9. Debugging Tools

### Layout Diagnostics (Dev-only)
A `window.__layoutDiag()` helper exists to log:
- Bounding boxes
- Offset parent chains
- Canvas vs panel width
- Overlap detection

Use this before making layout changes.

### React Flow Debug (Dev-only)
A `window.__debugRF()` helper exists when `debugRF=1` is in the URL query string (non-production only).

It logs:
- Template positions (from server)
- FlowNodes mapped positions (what we pass to React Flow)
- React Flow live positions (current state)
- Edge anchor diagnostics
- Position mismatches
- Handle center points
- Dimension comparisons

Use this to diagnose coordinate space and sizing issues.

---

## 10. Special Behaviours & Constraints

### Edge Handle Normalization
- Legacy handle IDs (e.g., `"source"`, `"target"`) are automatically normalized to standard format (`"source-bottom"`, `"target-top"`)
- Standard format: `{source|target}-{top|right|bottom|left}`
- Unknown handle IDs fall back to defaults (undefined) to let React Flow choose

### Edge Rendering
- Edges use React Flow type `'step'` but are rendered via custom `WorkflowOrthogonalEdge` component
- Edges draw orthogonally (vertical, horizontal, or one-bend paths)
- Edge labels are styled with: fontSize 12, fontWeight 600, color #0b4670, white background with border

### Node Positioning & Movement
- **Axis locking**: Hold Shift while dragging to lock movement to X or Y axis (locks to dominant axis after 6px threshold)
- **Position persistence**: Node position updates are debounced by 400ms to reduce database writes
- **PANEL resize persistence**: Panel resize-end events are debounced by 500ms and tracked via active session state

### Non-Connectable Node Types
- **REFERENCE nodes**: No handles, cannot be connected (informational only)
- **PANEL nodes**: No handles, cannot be connected (container background only)

### REFERENCE Node Storage
- REFERENCE nodes store their data in `style.reference` object (not in `body` field)
- Structure: `style.reference = { title?: string, items?: Array<{ text: string; info?: string }> }`
- The `body` field is set to `null` for REFERENCE nodes
- When editing, newline-separated text is converted to items array; existing item `info` fields are preserved by matching text

### END/OUTCOME Node Logic
- END nodes display an "Outcome" footer only if:
  - The node has an `actionKey` set, AND
  - The node has no outgoing edges
- This distinguishes terminal outcomes from intermediate END nodes

### Z-Index Layering System
- CSS-based z-index system ensures proper stacking:
  - Panel nodes: `z-index: 0` (behind everything)
  - Normal nodes: `z-index: 1` (above panels)
  - Edges container: `z-index: 2` (above nodes)
- Uses `.react-flow-panels-below` class selector
- Panel backgrounds use `pointer-events: none` to avoid blocking interactions

---

## 11. Known Pitfalls (Hard-Learned)

❌ position: relative on .react-flow__edges

❌ Explicit width/height on non-PANEL nodes

❌ Passing functions through Prisma / DB

❌ Assuming React Flow resizes automatically on layout changes

❌ Relying on ℹ️ as the only way to open Details

❌ Setting width/height on PANEL nodes in only one place (must be in both `node.width/height` AND `style.width/height`)

---

## 12. Design Philosophy

Prefer predictable behaviour over clever layouts

Let React Flow do geometry

Make interaction forgiving (click anywhere, not tiny targets)

Persist only what must be persisted

Diagnose before fixing

Last updated: Jan 2026