---
goal: Expose plot axis bounds customization and reorganize left-hand control panel
version: 1.1
date_created: 2026-05-26
last_updated: 2026-05-27
owner: Joseph Kasprzyk
status: 'Planned'
tags: [feature, architecture, design]
---

# Introduction

![Status: Planned](https://img.shields.io/badge/status-Planned-blue)

Two related improvements: (1) let users pin Y-axis (and optionally X-axis) bounds that persist regardless of data filtering, and (2) reorganize the sidebar so controls are grouped by function rather than crammed into a single "Display" block. Colored section boxes will provide visual separation.

## 1. Requirements & Constraints

- **REQ-001**: User can set explicit Y-axis min/max bounds that Plotly respects; these bounds do NOT change when columns are filtered in/out.
- **REQ-002**: Bounds are optional — leaving a field blank restores Plotly auto-range for that axis.
- **REQ-003**: X-axis min/max bounds are similarly optional and behave the same way.
- **REQ-004**: Sidebar sections are visually separated (colored/bordered boxes or distinct headers) so users can scan controls quickly.
- **REQ-005**: "Multiple plots by" and "Tie labels together" controls move out of the Display section into a dedicated Faceting section.
- **REQ-006**: "Sort/filter by" category range controls remain in a Filter section.
- **REQ-007**: All existing functionality is preserved with no regressions.
- **CON-001**: No new runtime dependencies — use existing Tailwind classes and Plotly layout API only.
- **CON-002**: State for axis bounds lives in `App.jsx` alongside `xAxisLabel`/`yAxisLabel` to keep plot-related state co-located.
- **GUD-001**: Axis bounds inputs use controlled components. Empty string = null = Plotly auto-range. No blur reset (unlike sortRange — empty is valid here). State update fires on change when value is parseable or empty.
- **GUD-002**: Sidebar width (320 px) must not increase; new controls must fit within existing layout.
- **PAT-001**: Follow existing prop-drilling pattern: state in App.jsx, pass handlers down to LabelControls or a new sibling component.

## 2. Implementation Steps

### Implementation Phase 1 — Axis bounds state & plot wiring

- GOAL-001: Add `axisRanges` state to App.jsx and pass it through to EnsemblePlot so Plotly honors user-defined bounds.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-001 | Add state `axisRanges = { xMin: '', xMax: '', yMin: '', yMax: '' }` (all strings; empty = auto-range) to `App.jsx` near the `xAxisLabel`/`yAxisLabel` state declarations. | | |
| TASK-002 | Pass `axisRanges` as a prop to every `<EnsemblePlot>` instance rendered in `App.jsx`. | | |
| TASK-003 | In `EnsemblePlot.jsx` Plotly layout (currently ~lines 135-165), map `axisRanges.yMin`/`yMax` to `yaxis.range` and set `yaxis.autorange` to `false` only when at least one y bound is non-empty. Same for `xaxis`. Parse inline: `parseFloat(v) || null`; use `null` entry in `range` array when only one bound is set (Plotly 2.35.2 confirmed to accept `[null, 5]` to fix only the upper bound — RISK-001 is low). | | |
| TASK-004 | Verify that changing `activeByCategory` (column filtering) does NOT reset the user-defined bounds — confirm via manual test. | | |

### Implementation Phase 2 — Axis bounds UI in sidebar

- GOAL-002: Expose Y-axis and X-axis bound inputs in a collapsible "Plot bounds" subsection inside the Display section of LabelControls.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-005 | Add `axisRanges` prop and `onAxisRangesChange` callback to `LabelControls.jsx`. | | |
| TASK-006 | Add a "Plot bounds" `<details>` collapsible inside the Display section (matching the Line styling `<details>` pattern). Two rows inside: "Y-axis" with Min/Max number inputs; "X-axis" with Min/Max number inputs. Inputs are fully controlled from `axisRanges` strings — no local draft state. On change: if value is empty or parseable, call `onAxisRangesChange({ ...axisRanges, key: e.target.value })`. On blur: do nothing (empty is valid = auto-range). | | |
| TASK-007 | Wire `onAxisRangesChange` in `App.jsx` to update `axisRanges` state directly (strings pass through as-is; EnsemblePlot parses inline). | | |

### Implementation Phase 3 — Sidebar reorganization

- GOAL-003: Split LabelControls into five visually distinct, semantically correct sections so the panel is scannable.

Section order (top to bottom): **Display → Faceting → Filter → Classification → Categories**

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-008 | Define five sidebar section wrappers using Tailwind (colored left-border or light background box + bold label). Palette — Display: `bg-blue-50 border-blue-200`; Faceting: `bg-violet-50 border-violet-200`; Filter: `bg-amber-50 border-amber-200`; Classification: `bg-rose-50 border-rose-200`; Categories: `bg-gray-50 border-gray-200`. Use full static class name strings only (no template construction) so Tailwind JIT picks them up via content scanning — no safelist change needed. | | |
| TASK-009 | Move "Multiple plots by" and "Tie labels together" into a new **Faceting** section, separate from Display. | | |
| TASK-010 | Keep Show bands, X/Y axis labels, line thickness/opacity, and the new Plot bounds collapsible in the **Display** section. | | |
| TASK-011 | Move "Sort/filter by" category selector and its min/max range inputs into a **Filter** section. | | |
| TASK-012 | Wrap the existing Bundled Classification and Individual Classifications blocks in a **Classification** section (`bg-rose-50 border-rose-200`). These blocks were added in PR #15 and are not part of the original four-section plan. | | |
| TASK-013 | Keep per-category color/visibility checkboxes in a **Categories** section. | | |
| TASK-014 | Update section header styling to use small caps or bold text with the section color so each group is immediately recognizable. | | |

### Implementation Phase 4 — Polish & QA

- GOAL-004: Verify no regressions, clean up any dead code, confirm layout at 320 px width.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-015 | Run app with example dataset; exercise all five sidebar sections and confirm all controls still function correctly. | | |
| TASK-016 | Test axis bounds: set Y min=0, Y max=100; filter columns in/out; confirm bounds hold. Clear bounds; confirm auto-range resumes. | | |
| TASK-017 | Test partial bounds: set only Y max; confirm lower auto-range still works. | | |
| TASK-018 | Test with multiple plots (splitBy set): confirm each subplot respects same global axis bounds. | | |
| TASK-019 | Check 320 px sidebar at various zoom levels; confirm no horizontal overflow. | | |

## 3. Alternatives

- **ALT-001**: Put axis bounds in a separate top-bar or plot-level popover rather than the sidebar. Rejected — sidebar keeps all plot config co-located and avoids a new UI paradigm.
- **ALT-002**: Extract each sidebar section into its own top-level component (e.g., `FacetingControls.jsx`). Rejected for now — adds prop-drilling complexity without clear benefit at current scale; can be revisited if sidebar grows further.
- **ALT-003**: Use Plotly's built-in range-selector / rangeslider widgets on the plot itself. Rejected — those modify the visible window interactively but don't let users type a precise fixed bound; they also clutter the plot area.
- **ALT-004**: Colored section boxes via CSS modules instead of Tailwind. Rejected — project uses Tailwind throughout.
- **ALT-005**: Per-subplot axis bounds when splitBy is active. Rejected — global bounds is the correct default for the comparison use case; per-subplot can be a separate feature if needed.

## 4. Dependencies

- **DEP-001**: Plotly.js `layout.yaxis.range` / `xaxis.range` API — already in use in `EnsemblePlot.jsx`; no version change needed. Verified: Plotly 2.35.2 supports `[null, value]` for partial bounds.
- **DEP-002**: Tailwind CSS color palette — no safelist change needed. Write full static class names (e.g., `bg-rose-50 border-rose-200`) directly in JSX; JIT content scanning will include them.

## 5. Files

- **FILE-001**: `src/App.jsx` — add `axisRanges` string state; pass to EnsemblePlot and LabelControls.
- **FILE-002**: `src/components/EnsemblePlot.jsx` — consume `axisRanges` in Plotly layout (~lines 135-165); parse inline.
- **FILE-003**: `src/components/LabelControls.jsx` — add Plot bounds collapsible; reorganize into Display / Faceting / Filter / Classification / Categories sections.

## 6. Testing

- **TEST-001**: Axis bounds persist across column filter changes — set bounds, toggle category checkboxes, confirm Plotly range unchanged.
- **TEST-002**: Clearing a bounds input restores Plotly auto-range for that axis only.
- **TEST-003**: Partial bounds (one side set, other blank) — Plotly should only fix the specified side.
- **TEST-004**: Multi-plot mode (splitBy active) — all subplots respect the same global axis bounds.
- **TEST-005**: Backspace in bounds inputs does not submit/reset (empty is valid; no blur reset logic to accidentally interfere).
- **TEST-006**: All pre-existing sidebar controls (Show bands, axis labels, line style, sort/filter, category toggles, classification sections) work correctly after reorganization.

## 7. Risks & Assumptions

- **RISK-001**: ~~Plotly's handling of `range: [null, value]` for partial axis bounds may behave differently across Plotly versions.~~ **Resolved — low risk.** Plotly 2.35.2 (pinned in package.json) confirmed to support `[null, value]`.
- **RISK-002**: ~~Tailwind purge/JIT may strip violet/amber classes if they only appear in dynamic strings.~~ **Resolved.** Use full static class names only; no safelist needed.
- **ASSUMPTION-001**: Single global axis bounds shared across all subplots (splitBy mode), not per-subplot bounds.
- **ASSUMPTION-002**: X-axis bounds are useful primarily for datetime data; numeric index bounds are also supported but less common. Both are exposed equally.
- **ASSUMPTION-003**: 320 px sidebar width is sufficient for two side-by-side Min/Max number inputs — same `grid-cols-2 gap-1` pattern as sortRange inputs. Plot bounds collapsible keeps sidebar compact when not in use.

## 8. Related Specifications / Further Reading

- PR #12 — backspace-safe range inputs pattern (reference for sortRange; axis bounds differ — no blur reset needed)
- PR #15 — bundled and individual classification UI (adds Classification section to sidebar reorganization scope)
- `src/components/EnsemblePlot.jsx` ~lines 135-165 — Plotly layout construction
- `src/components/LabelControls.jsx` — current Display section (~lines 71-282) to be reorganized; Classification blocks ~lines 288-407
- Plotly.js layout reference: `xaxis.range`, `yaxis.range`, `autorange` properties
