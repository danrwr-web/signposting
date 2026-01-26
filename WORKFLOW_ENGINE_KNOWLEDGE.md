# Workflow Engine – Architecture & Behaviour Guide

This document captures the **design, constraints, and hard-learned behaviours**
of the Workflow Engine used in the Signposting Toolkit.

It exists to:
- prevent regressions
- explain non-obvious technical decisions
- document constraints imposed by React Flow
- provide context for future development and refactoring

This is **not** an introductory guide.  
It is a reference for developers working on or around the workflow canvas.

---

## 0. Application context (important)

Workflow Guidance is a **first-class module** within the Signposting Toolkit.

All workflow pages:
- render inside the **shared app shell**
- use the standard header (logo, surgery context, navigation trigger)
- rely on the **universal slide-out navigation panel** for global navigation

The workflow canvas itself is *not* a standalone application.
Any future work must preserve the assumption that users can always:
- identify where they are in the app
- switch context via the navigation panel
- return to other modules without losing orientation

---

## 1. Core Concepts

### Node Types
The workflow engine is built on **React Flow** and supports the following node types:

- **INSTRUCTION** – informational step, no branching
- **QUESTION** – decision point with Yes/No (or multiple) answers (rendered as a diamond)
- **OUTCOME / END** – terminal action (e.g. Forward to GP, File without forwarding)
- **PANEL** – resizable container grouping a sub-workflow (background grouping only)
- **REFERENCE** – non-connectable informational list  
  (e.g. “Letters which can be filed without forwarding”)

Each node type has a dedicated React component and styling rules.

### Node Type → React Flow Component Mapping
- `INSTRUCTION` → `instructionNode`
- `QUESTION` → `decisionNode`
- `END` → `outcomeNode`
- `PANEL` → `panelNode`
- `REFERENCE` → `referenceNode`

---

## 2. React Flow Integration (Critical)

### Coordinate Space Rules (VERY IMPORTANT)
- **Edges and nodes must share the same coordinate space**
- Do **not** apply `position: relative` to `.react-flow__edges`
- Do **not** create alternate positioning contexts around the canvas

❗ Past bugs showed that even `position: relative` (with no offset) on the edges container causes:
- edge anchor offsets
- handles not aligning with visible nodes
- zoom-related drift

**Rule:**  
Let React Flow own positioning.  
Only use `z-index` for layering.

---

## 3. PANEL Nodes (Resizable Containers)

### Behaviour
- PANEL nodes are resizable by the user
- Width and height are persisted to the database
- Other node types must **not** persist width/height
- **Minimum dimensions**: 300px width × 200px height
- PANEL nodes are **not connectable**
  - no handles
  - cannot be used as connection points

### Persistence Rules
- Dimensions must be stored in **both**:
  - `node.width` / `node.height`
  - `node.style.width` / `node.style.height`

This dual storage prevents React Flow from treating PANEL nodes as auto-sized.

During active resize sessions:
- local dimensions are preserved
- server refreshes must not overwrite in-progress user changes

### Key Rule
> **Only PANEL nodes may have explicit width/height.**

Violating this rule causes:
- handle misalignment
- edge anchoring errors
- zoom drift

---

## 4. Node Sizing Rules (Non-PANEL)

- Use `minWidth` / `minHeight`
- Do **not** set explicit `width` / `height`
- Allow content to define final size
- React Flow will measure the DOM correctly when this rule is followed

### Special Cases
- **QUESTION nodes**  
  Fixed size: 240px × 160px (required for diamond SVG)
- **REFERENCE nodes**  
  Minimum width: 320px (via `minWidth`)

---

## 5. Details Panel (Right-Hand Panel)

### Behaviour
- The Details panel:
  - pushes the canvas (does **not** overlay)
  - opens when:
    - any node is clicked
    - the ℹ️ info badge is clicked
- Panel open/close triggers:
  - `fitView()` on React Flow
  - `resize` events to force recalculation

### Important Insight
The canvas was never actually overlapping.
React Flow simply retained its previous viewport width.

**Rule:**  
Always call `fitView()` when the panel opens or closes.

---

## 6. ℹ️ Info Badge Logic

### When ℹ️ Should Appear
The ℹ️ badge appears **only when the node has additional information**, such as:

- reference content (lists, extra info)
- linked workflows
- body/description text not visible on the node face

The badge must **not** appear if the Details panel would simply repeat visible content.

### Implementation Rule
- Badge visibility is computed client-side
- Functions must **never** be stored in the database
- Compute `showInfoBadge` during `flowNodes` mapping if needed

---

## 7. Click Behaviour (UX Rule)

- Clicking **anywhere on a node** opens the Details panel
- ℹ️ is optional and supplementary
- Dragging nodes works normally
- Clicking handles does **not** open Details

This avoids fiddly interaction and improves accessibility.

---

## 8. Node → Details Communication

### Critical Pattern
Node components receive only `NodeProps`.

To trigger external behaviour:
- functions (e.g. `openDetailsForNode`) must be passed via `node.data`
- never via `nodeTypes` props

Example:
```ts
data: {
  ...existingData,
  onInfoClick: (nodeId) => openDetailsForNode(nodeId),
}
Info Badge Visibility Rules
shouldShowInfoBadge() evaluates:

Linked workflows present

REFERENCE content with non-empty text or info

Body/description text not visible on node face

If Details would only repeat visible content, the badge is hidden.

9. Debugging Tools
Layout Diagnostics (Dev-only)
window.__layoutDiag() logs:

bounding boxes

offset parent chains

canvas vs panel width

overlap detection

Use before making layout changes.

React Flow Debug (Dev-only)
window.__debugRF() (enabled with ?debugRF=1) logs:

server positions

mapped flow node positions

live React Flow positions

edge anchor diagnostics

handle centre points

dimension comparisons

This is essential for diagnosing coordinate-space issues.

10. Special Behaviours & Constraints
Edge Handle Normalisation
Legacy IDs ("source", "target") are normalised to:

source-bottom

target-top

Unknown IDs fall back to defaults

Edge Rendering
Base type: React Flow 'step'

Rendered via custom WorkflowOrthogonalEdge

Labels:

fontSize: 12

fontWeight: 600

colour: #0b4670

white background with border

Node Positioning & Movement
Axis locking: hold Shift while dragging

Lock engages after 6px movement threshold

Position updates debounced (400ms)

PANEL resize persistence debounced (500ms)

Non-Connectable Nodes
REFERENCE – informational only

PANEL – background grouping only

REFERENCE Node Storage
Stored in style.reference, not body

Structure:

style.reference = {
  title?: string,
  items?: Array<{ text: string; info?: string }>
}
END / OUTCOME Logic
“Outcome” footer shown only if:

actionKey is set

no outgoing edges exist

Z-Index Layering
PANEL nodes: z-index: 0

Normal nodes: z-index: 1

Edges: z-index: 2

Panel backgrounds use pointer-events: none

11. Known Pitfalls (Hard-Learned)
❌ position: relative on .react-flow__edges
❌ Explicit width/height on non-PANEL nodes
❌ Passing functions through Prisma / DB
❌ Assuming React Flow auto-resizes on layout change
❌ Relying on ℹ️ as the only way to open Details
❌ Storing PANEL dimensions in only one place

12. Design Philosophy
Prefer predictable behaviour over clever layouts

Let React Flow own geometry

Make interaction forgiving

Persist only what must be persisted

Diagnose before fixing

Last updated: January 2026
Primary intent: stable, predictable workflow editing with minimal cognitive overhead