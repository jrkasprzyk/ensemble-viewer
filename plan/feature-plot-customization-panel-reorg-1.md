---
goal: Expose plot axis bounds customization and reorganize left-hand control panel
version: 1.0
date_created: 2026-05-26
last_updated: 2026-05-26
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
- **REQ-005**: "Multiple plots by" and "Tie labels together" controls move out of the Display section into a dedicated Faceting/Layout section.
- **REQ-006**: "Sort/filter by" category range controls remain in a Filtering section.
- **REQ-007**: All existing functionality is preserved with no regressions.
- **CON-001**: No new runtime dependencies — use existing Tailwind classes and Plotly layout API only.
- **CON-002**: State for axis bounds lives in `App.jsx` alongside `xAxisLabel`/`yAxisLabel` to keep plot-related state co-located.
- **GUD-001**: Inputs for axis bounds use controlled components with the same backspace-safe pattern already applied to `sortRange` inputs (see PR #12).
- **GUD-002**: Sidebar width (320 px) must not increase; new controls must fit within existing layout.
- **PAT-001**: Follow existing prop-drilling pattern: state in App.jsx, pass handlers down to LabelControls or a new sibling component.

## 2. Implementation Steps

### Implementation Phase 1 — Axis bounds state & plot wiring

- GOAL-001: Add `axisRanges` state to App.jsx and pass it through to EnsemblePlot so Plotly honors user-defined bounds.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-001 | Add state `axisRanges = { xMin, xMax, yMin, yMax }` (all nullable strings/numbers) to `App.jsx` near line 46 alongside `xAxisLabel`/`yAxisLabel`. | | |
| TASK-002 | Pass `axisRanges` as a prop to every `<EnsemblePlot>` instance rendered in `App.jsx` (lines 381-405). | | |
| TASK-003 | In `EnsemblePlot.jsx` Plotly layout (lines 141-170), map `axisRanges.yMin`/`yMax` to `yaxis.range` and set `yaxis.autorange` to `false` only when at least one y bound is non-null. Same for `xaxis`. Use `null` entry in `range` array when only one bound is set (Plotly accepts `[null, 5]` to fix only the upper bound). | | |
| TASK-004 | Verify that changing `activeByCategory` (column filtering) does NOT reset the user-defined bounds — confirm via manual test. | | |

### Implementation Phase 2 — Axis bounds UI in sidebar

- GOAL-002: Expose Y-axis and X-axis bound inputs in a new "Plot Bounds" subsection inside LabelControls (or a new component).

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-005 | Add `axisRanges` prop and `onAxisRangesChange` callback to `LabelControls.jsx`. | | |
| TASK-006 | Add a "Plot bounds" subsection in LabelControls inside the Display section. Two rows: "Y-axis" with Min/Max number inputs; "X-axis" with Min/Max number inputs. Inputs use the same backspace-safe controlled pattern from the `sortRange` inputs (empty string ↔ null conversion on blur/change). | | |
| TASK-007 | Wire `onAxisRangesChange` in `App.jsx` to update `axisRanges` state; derive numeric values from input strings before passing to EnsemblePlot (parse float, fallback null). | | |

### Implementation Phase 3 — Sidebar reorganization

- GOAL-003: Split LabelControls into visually distinct, semantically correct sections so the panel is scannable.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-008 | Define four sidebar section wrappers using Tailwind: a `SidebarSection` pattern (colored left-border or light background box + bold label). Suggested palette — Display: blue-50 border-blue-200; Faceting: violet-50 border-violet-200; Filter: amber-50 border-amber-200; Category filters: gray-50 border-gray-200. Use existing Tailwind classes only. | | |
| TASK-009 | Move "Multiple plots by" (LabelControls lines 149-162) and "Tie labels together" (lines 164-190) into a new **Faceting** section, separate from Display. | | |
| TASK-010 | Keep Show bands, X/Y axis labels, line thickness/opacity, and the new Plot bounds inputs in the **Display** section. | | |
| TASK-011 | Move "Sort/filter by" category selector and its min/max range inputs into a **Filter** section. | | |
| TASK-012 | Keep per-category color/visibility checkboxes in a **Categories** section (already mostly separate below line 277). | | |
| TASK-013 | Update section header styling to use small caps or bold text with the section color so each group is immediately recognizable. | | |

### Implementation Phase 4 — Polish & QA

- GOAL-004: Verify no regressions, clean up any dead code, confirm layout at 320 px width.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-014 | Run app with example dataset; exercise all four sidebar sections and confirm all controls still function correctly. | | |
| TASK-015 | Test axis bounds: set Y min=0, Y max=100; filter columns in/out; confirm bounds hold. Clear bounds; confirm auto-range resumes. | | |
| TASK-016 | Test partial bounds: set only Y max; confirm lower auto-range still works. | | |
| TASK-017 | Test with multiple plots (splitBy set): confirm each subplot respects same axis bounds. | | |
| TASK-018 | Check 320 px sidebar at various zoom levels; confirm no horizontal overflow. | | |

## 3. Alternatives

- **ALT-001**: Put axis bounds in a separate top-bar or plot-level popover rather than the sidebar. Rejected — sidebar keeps all plot config co-located and avoids a new UI paradigm.
- **ALT-002**: Extract each sidebar section into its own top-level component (e.g., `FacetingControls.jsx`). Rejected for now — adds prop-drilling complexity without clear benefit at current scale; can be revisited if sidebar grows further.
- **ALT-003**: Use Plotly's built-in range-selector / rangeslider widgets on the plot itself. Rejected — those modify the visible window interactively but don't let users type a precise fixed bound; they also clutter the plot area.
- **ALT-004**: Colored section boxes via CSS modules instead of Tailwind. Rejected — project uses Tailwind throughout.

## 4. Dependencies

- **DEP-001**: Plotly.js `layout.yaxis.range` / `xaxis.range` API — already in use in `EnsemblePlot.jsx`; no version change needed.
- **DEP-002**: Tailwind CSS color palette — project already uses tailwind; confirm `violet-*` and `amber-*` shades are in the purge safelist or used elsewhere (add to `tailwind.config.js` safelist if needed).

## 5. Files

- **FILE-001**: `src/App.jsx` — add `axisRanges` state; pass to EnsemblePlot and LabelControls.
- **FILE-002**: `src/components/EnsemblePlot.jsx` — consume `axisRanges` in Plotly layout (lines 141-170).
- **FILE-003**: `src/components/LabelControls.jsx` — add Plot bounds inputs; reorganize into Display / Faceting / Filter / Categories sections.
- **FILE-004**: `tailwind.config.js` — add safelist entries if violet/amber shades are not already included.

## 6. Testing

- **TEST-001**: Axis bounds persist across column filter changes — set bounds, toggle category checkboxes, confirm Plotly range unchanged.
- **TEST-002**: Clearing a bounds input restores Plotly auto-range for that axis only.
- **TEST-003**: Partial bounds (one side set, other blank) — Plotly should only fix the specified side.
- **TEST-004**: Multi-plot mode (splitBy active) — all subplots respect the same axis bounds.
- **TEST-005**: Backspace in bounds inputs does not submit/reset (regression guard from PR #12 pattern).
- **TEST-006**: All pre-existing sidebar controls (Show bands, axis labels, line style, sort/filter, category toggles) work correctly after reorganization.

## 7. Risks & Assumptions

- **RISK-001**: Plotly's handling of `range: [null, value]` for partial axis bounds may behave differently across Plotly versions. Verify with the version pinned in `package.json` before finalizing TASK-003.
- **RISK-002**: Tailwind purge/JIT may strip violet/amber classes if they only appear in dynamic strings. Use full class names (not template-constructed strings) in JSX.
- **ASSUMPTION-001**: The user wants a single global axis bounds setting shared across all subplots (splitBy mode), not per-subplot bounds.
- **ASSUMPTION-002**: X-axis bounds are useful primarily for datetime data; numeric index bounds are also supported but less common. Both are exposed equally.
- **ASSUMPTION-003**: 320 px sidebar width is sufficient for two side-by-side Min/Max number inputs with labels; if not, stack them vertically.

## 8. Related Specifications / Further Reading

- PR #12 — backspace-safe range inputs pattern (reference for TASK-006)
- `src/components/EnsemblePlot.jsx` lines 141-170 — Plotly layout construction
- `src/components/LabelControls.jsx` lines 60-270 — current Display section to be reorganized
- Plotly.js layout reference: `xaxis.range`, `yaxis.range`, `autorange` properties
