---
goal: Persist trace filters & coloring when switching RDF slots
version: 1.0
date_created: 2026-06-01
last_updated: 2026-06-01
owner: Joseph Kasprzyk
status: 'Planned'
tags: [feature, rdf, filtering, ux]
---

# Introduction

![Status: Planned](https://img.shields.io/badge/status-Planned-blue)

When viewing a RiverWare RDF, the user picks one *series slot* at a time. Today, if
they filter or color a subset of traces on one slot and then switch to a different
slot, the filter/coloring is wiped and every trace comes back. This plan makes the
**trace-level view state persist across slot switches within the same RDF**, so the
user can set the traces they care about once and see that same set across every slot.

It loses nothing on a genuinely new file load — loading a different file (or a
different RDF) still resets to a clean "show everything" state.

## Open decision for collaborator

**DEC-001 — How much view state should persist across a slot switch?** Pick one:

- **Option A — Filters + coloring + classifications (recommended).** Preserve
  `activeByCategory` (trace filters), `colorBy` / `showBands`, **and** the
  classification/horizon filters + the loaded classification bundle
  (`rawClassificationsByTrace`, `selectedHorizons`, `horizonLogic`, `bundledFilter`,
  `classificationFilter`). Most complete; best matches "see the same set across all
  slots." Larger change because it touches the classification subsystem.
- **Option B — Filters + coloring only.** Preserve `activeByCategory` and
  `colorBy` / `showBands`, but keep resetting the classification/horizon filters on
  each slot switch. Smaller, more focused change.

Everything else below is the same regardless of which option is chosen; the only
difference is **how much** state Step 3 preserves. The recommendation is **Option A**
because the classification bundle is keyed to traces (columns), which are identical
across slots, so it stays valid on a slot switch.

# Root cause

Switching slots calls `selectRdfSlot` → `applyDataset` (`src/App.jsx:163-174`,
`89-114`). Two things wipe the user's selection:

1. **`applyDataset` explicitly resets** `colorBy = null` and the
   classification/horizon filters (`src/App.jsx:95-100`).
2. **The seeding effect** at `src/App.jsx:362-368` re-seeds `activeByCategory` to
   "all selected" every time `categoryValues` changes — and it changes on every slot
   switch because `rdfToDataset` injects `slot`/`units` label categories whose values
   differ per slot (`src/lib/rdfParser.js:384-389`).

This is safe to fix: across slots in the same RDF the **columns are identical**
(`trace_1`, `trace_2`, … — `src/lib/rdfParser.js:347-348`) and the scalar label
categories are constant. Only `slot`/`units` change. So a trace-number / category
filter is semantically valid on every slot of the same file.

Note: `splitBy`, `sortCategory`/`sortRange`, tie categories, axis labels, line styles,
and tick format **already** persist across slot switches (they are not touched by
`applyDataset`). Only `colorBy`, the classification/horizon filters, and
`activeByCategory` reset.

# 1. Requirements & Constraints

- **REQ-001**: Switching from one slot to another within the same loaded RDF must
  preserve `activeByCategory` (the trace filter selection) and `colorBy` / `showBands`.
- **REQ-002**: Loading a new file (CSV/XLSX via `loadFile`, or a new RDF via
  `loadRdf`) must reset filters/coloring to the clean "all selected" default — no
  state carried over between unrelated files.
- **REQ-003**: The **first** slot pick after loading an RDF is treated as a fresh
  load (clean defaults), not a "switch." Only slot-to-slot changes preserve state.
- **REQ-004**: A constant category that changes value on switch (`slot`, `units`)
  must not hide all traces. After a switch, every column must remain visible unless
  the user had de-selected it via a *trace-level* category whose values are unchanged.
- **REQ-005 (DEC-001 Option A)**: The classification/horizon filters and the loaded
  classification bundle persist across slot switches and reset on new-file load.
- **CON-001**: No new npm dependencies. Pure React state + one `useRef`.
- **CON-002**: No change to the config XML schema or `src/lib/config.js`. `applyConfig`
  (load-preset) keeps its current reset-to-default-then-overlay semantics.
- **GUD-001**: Extract the merge logic as a **pure helper** in `src/lib/labels.js`
  with colocated `vitest` tests, matching the codebase's lib+test idiom (the React
  component `App.jsx` has no tests; pure helpers do).

# 2. Implementation Steps

### Implementation — persist trace view state across slot switches

- **GOAL-001**: Filters/coloring set on one slot stay applied when switching slots in
  the same RDF; new-file loads still reset.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-001 | Add a pure helper `seedActiveByCategory(prevActive, prevCategoryValues, categoryValues)` to `src/lib/labels.js`. Rule per category: brand-new category → select all its values; existing category → keep previously-selected values **plus** any brand-new values (values present now but absent from `prevCategoryValues`). This preserves de-selections and satisfies REQ-004 (a new `slot`/`units` value is "brand-new" → selected → all columns stay visible). |  |  |
| TASK-002 | Replace the seeding effect (`src/App.jsx:362-368`) to call `seedActiveByCategory` via a functional `setActiveByCategory` update, and track previous `categoryValues` in a `useRef` (`prevCategoryValuesRef`). Capture the ref value *before* the state update and reassign it *after* (avoid the stale-closure trap). |  |  |
| TASK-003 | Give `applyDataset` a `{ preserveView = false }` option. When `true`, skip the resets at `src/App.jsx:95-100` (Option A: all of `colorBy`, `rawClassificationsByTrace`, `selectedHorizons`, `horizonLogic`, `bundledFilter`, `classificationFilter`; Option B: only `colorBy`) and do not force `labelStrategy`. When `false`, behave exactly as today. |  |  |
| TASK-004 | In `selectRdfSlot` (`src/App.jsx:163-174`), pass `preserveView: Boolean(selectedSlot)` — `false` on the first pick (REQ-003), `true` on subsequent switches. |  |  |
| TASK-005 | On fresh-load paths only — `loadFile` and `loadRdf` — reset `setActiveByCategory({})` and `prevCategoryValuesRef.current = {}` so the merge seeds everything fresh and nothing carries between files (REQ-002). `applyDataset`'s `preserveView=false` branch keeps the existing colorBy/classification resets for `loadFile`. |  |  |
| TASK-006 | Add `seedActiveByCategory` tests to `src/lib/labels.test.js`: (a) fresh seed (empty prev) selects all; (b) a de-selected value stays de-selected across an identical value set; (c) a constant category gaining a new value (slot switch) keeps every column visible; (d) a brand-new category selects all; (e) a removed value drops out cleanly. |  |  |
| TASK-007 | Manual verification: load a multi-slot RDF, de-select a subset of traces (and/or set `colorBy`) on slot A, switch to slot B → same subset/coloring applied; switch back → still applied; then load a different file → resets to all. |  |  |

# 3. Alternatives

- **ALT-001**: Capture and restore `activeByCategory`/`colorBy` inside `selectRdfSlot`.
  **Rejected** — the seeding effect runs asynchronously after render and would
  overwrite a synchronous restore; fighting effect timing is fragile.
- **ALT-002**: Keep the effect's unconditional reset but gate it with a one-shot
  "preserve on next seed" ref set by `selectRdfSlot`. **Viable but rejected** — the
  ref-flag is more stateful/implicit than a pure merge keyed on previous values, and
  the merge also improves the label re-parse case (changing delimiter no longer nukes
  unrelated selections) for free.
- **ALT-003**: Move filter state into a per-RDF cache keyed by slot. **Rejected as
  over-built** — the user explicitly wants *one* filter shared across all slots, not a
  per-slot memory.
- **ALT-004**: Always merge (never reset, even on new file). **Rejected** — would
  carry stale selections between unrelated files when category/value names coincide;
  REQ-002 requires a clean reset on new-file load.

# 4. Files touched

- `src/lib/labels.js` — new pure `seedActiveByCategory` helper.
- `src/lib/labels.test.js` — tests for the helper.
- `src/App.jsx` — seeding effect + `prevCategoryValuesRef`; `applyDataset` gains
  `preserveView`; `selectRdfSlot`, `loadFile`, `loadRdf` updated.
