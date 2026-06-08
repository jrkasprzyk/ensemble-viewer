---
goal: Add a color legend for classification-bundle coloring (Issue #24)
version: 1.0
date_created: 2026-06-08
last_updated: 2026-06-08
owner: jrkasprzyk
status: 'Phase 1 Complete'
tags: [feature, ui, plot, classification]
---

# Introduction

![Status: Planned](https://img.shields.io/badge/status-Planned-blue)

Issue [#24](https://github.com/jrkasprzyk/ensemble-viewer/issues/24): when coloring by a classification (Bundled or an Individual scheme), the figure and the control panel give no visual indication that **green = Success** and **orange = Failure**. Other `colorBy` modes (the Categories section) already render a color swatch next to each category value; classification coloring does not. This plan resolves the gap and presents the alternatives considered.

The recommended approach (Phase 1) makes the existing control-panel swatch convention consistent across the Classification section — the cheapest, lowest-risk fix that directly answers the issue. Phase 2 is an **optional** stretch that adds an on-figure legend so the meaning is preserved in exported SVG/PNG for publication.

## 1. Requirements & Constraints

- **REQ-001**: When `colorBy` is `BUNDLED_CATEGORY` or an Individual classification scheme, a color swatch MUST appear next to each classification value (`Success`, `Failure`) in the control panel.
- **REQ-002**: Swatch colors MUST come from the single source of truth `BUNDLED_COLOR_MAP` (`Success` → `#009E73`, `Failure` → `#D55E00`) via the `colorMap` prop, not hard-coded literals duplicated in the component.
- **REQ-003**: Swatch behavior MUST mirror the Categories section convention: colored swatch when the row's classification is the *active* `colorBy`, neutral gray (`#b5b2aa`) otherwise.
- **REQ-004**: No change to color values, classification logic, filtering logic, or trace generation.
- **CON-001**: Individual ensemble traces keep `showlegend: false` (`EnsemblePlot.jsx:99`) — a per-column Plotly legend at N≈500 is not acceptable. Any on-plot legend (Phase 2) MUST use synthetic one-entry-per-category legend traces, never the raw column traces.
- **CON-002**: The existing band/mean Plotly legend (shown only when `bandsActive`, `EnsemblePlot.jsx:185`) MUST continue to work unchanged.
- **GUD-001**: Match surrounding code idiom — font sizes `text-[10px]`, `inline-block w-3 h-3 rounded-sm border border-rule` swatch span, `accent-accent` inputs.
- **PAT-001**: Reuse the existing Categories swatch pattern at `LabelControls.jsx:715-728` rather than inventing a new one.

## 2. Implementation Steps

### Implementation Phase 1 — In-panel swatches for classification (RECOMMENDED)

- GOAL-001: Render `BUNDLED_COLOR_MAP` swatches next to the `Success`/`Failure` labels in both the Bundled and Individual classification sub-panels, reusing the Categories swatch convention. This directly closes Issue #24.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-001 | In `src/components/LabelControls.jsx`, add a small swatch helper inline in the Bundled filter row (`LabelControls.jsx:590-604`). For each `v` in `['Failure','Success']`, compute `const swatch = colorBy === BUNDLED_CATEGORY ? (colorMap?.[v] ?? '#b5b2aa') : '#b5b2aa'` and render `<span className="inline-block w-3 h-3 rounded-sm border border-rule" style={{ background: swatch }} />` immediately before the value `<span>`. | ✅ | 2026-06-08 |
| TASK-002 | In the Individual filter row (`LabelControls.jsx:616-632`), the row already computes `const active = classificationSchemeSet.has(colorBy)`. Add `const swatch = active ? (colorMap?.[v] ?? '#b5b2aa') : '#b5b2aa'` and render the same swatch `<span>` before the value `<span>`. | ✅ | 2026-06-08 |
| TASK-003 | Verify `colorMap` is in scope in both rows (it is a top-level prop, `LabelControls.jsx:49`). No new prop wiring required. | ✅ | 2026-06-08 |
| TASK-004 | Manual visual check: load data with classification labels, select horizons, pick Bundled "Color" → green/orange swatches appear next to Success/Failure; switch to an Individual scheme "Color" → that row's swatches color, others stay gray. | | |
| TASK-005 | Update `docs/how-to.md` and/or `docs/reference.md` to mention the classification legend swatches. | ✅ | 2026-06-08 |
| TASK-006 | Add to `CHANGELOG.md` under Unreleased: "Classification coloring now shows Success/Failure color swatches in the control panel (#24)." | ✅ | 2026-06-08 |

### Implementation Phase 2 — On-figure legend for all colorBy modes (OPTIONAL STRETCH)

- GOAL-002: Render a legend *on the plot itself* (so it exports with SVG/PNG) that lists the active `colorBy` categories with their colors, without enabling per-column legend entries.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-007 | In `src/components/EnsemblePlot.jsx`, after building individual traces, when `colorBy` is set and `!bandsActive`, append one synthetic legend-only trace per category value present in `resolvedColorMap`: `{ type:'scatter', mode:'lines', x:[null], y:[null], name: value, line:{ color }, showlegend:true, legendgroup:'g-'+value, hoverinfo:'skip' }`. These draw nothing but populate the legend. | | |
| TASK-008 | Set `layout.showlegend = bandsActive || (!!colorBy)` so the legend container appears when either bands or synthetic category entries exist. Keep the existing legend styling block (`EnsemblePlot.jsx:186-191`). | | |
| TASK-009 | Guard against duplicate entries: when `bandsActive`, the band/mean traces already legend per group — in that case SKIP the synthetic per-category traces to avoid two legend entries per value. | | |
| TASK-010 | Add a `showPlotLegend` boolean control (default on) to `LabelControls.jsx` Display section + `App.jsx` state + pass-through prop, so users can hide the on-plot legend for dense figures. | | |
| TASK-011 | Update `src/components/EnsemblePlot.test.js` to assert: (a) synthetic legend traces produced for a `colorBy` with no bands; (b) no synthetic traces when `colorBy` is null; (c) no double entries when `bandsActive`. | | |

## 3. Alternatives

- **ALT-001 (chosen — Phase 1)**: **In-panel swatches.** Extend the existing Categories swatch convention into the Classification section. Pros: smallest diff, zero new props, fully consistent UX, no risk to plot/trace logic. Cons: legend lives in the control panel, not on the exported figure.
- **ALT-002 (offered as optional Phase 2)**: **On-plot Plotly legend via synthetic legend-only traces.** Pros: exports with SVG/PNG (publication value), discoverable on the figure, benefits every `colorBy` mode uniformly. Cons: more complex; must suppress the 500-item per-column legend, dedupe against the band legend, and add a visibility toggle. Not required to close #24.
- **ALT-003 (rejected)**: **Standalone `<PlotLegend>` React component** rendered above/beside the plot, reading `colorBy` + `colorMap`. Pros: decoupled from Plotly, uniform across modes. Cons: a third legend surface to keep in sync with both the panel swatches and the plot; does not export with the figure; more code than ALT-001 for no extra benefit over ALT-002 for publication.
- **ALT-004 (rejected)**: **Enable `showlegend: true` on the raw individual column traces.** Rejected outright per CON-001 — produces a ~500-entry legend.

## 4. Dependencies

- **DEP-001**: `BUNDLED_COLOR_MAP` and `NEUTRAL_GRAY` from `src/lib/palette.js` (already imported/available).
- **DEP-002**: `colorMap` prop already passed to `LabelControls` (`App.jsx:719`) and `EnsemblePlot` (`App.jsx:773`).
- **DEP-003**: `plotly.js-dist-min` / `react-plotly.js` (already a dependency) for Phase 2 only.

## 5. Files

- **FILE-001**: `src/components/LabelControls.jsx` — add swatches to Bundled filter row (~`:590-604`) and Individual filter row (~`:616-632`). Phase 2: add `showPlotLegend` toggle to Display section.
- **FILE-002**: `src/components/EnsemblePlot.jsx` — Phase 2 only: synthetic legend traces + `layout.showlegend` change.
- **FILE-003**: `src/App.jsx` — Phase 2 only: `showPlotLegend` state + prop pass-through.
- **FILE-004**: `src/components/EnsemblePlot.test.js` — Phase 2 only: synthetic-legend assertions.
- **FILE-005**: `docs/how-to.md`, `docs/reference.md`, `CHANGELOG.md` — documentation/changelog.

## 6. Testing

- **TEST-001**: (Phase 1, manual) Bundled "Color" active → Success swatch `#009E73`, Failure swatch `#D55E00`; no color mode active → both gray `#b5b2aa`.
- **TEST-002**: (Phase 1, manual) Individual scheme "Color" active → that scheme's filter row swatches color; switching schemes recolors correctly.
- **TEST-003**: (Phase 1, regression) Categories section swatches and all filtering/coloring behavior unchanged.
- **TEST-004**: (Phase 2, unit) `EnsemblePlot` emits exactly one synthetic legend trace per `colorMap` value when `colorBy` set and `!bandsActive`.
- **TEST-005**: (Phase 2, unit) No synthetic legend traces when `colorBy` is null.
- **TEST-006**: (Phase 2, unit) When `bandsActive`, no duplicate legend entries per value.

## 7. Risks & Assumptions

- **RISK-001**: (Phase 2) Synthetic legend traces could subtly affect autorange if `x`/`y` are not `[null]`/empty. Mitigation: use `x:[null], y:[null]` so no data point is plotted.
- **RISK-002**: (Phase 2) Legend overlap with dense plots; mitigated by the `showPlotLegend` toggle (TASK-010).
- **ASSUMPTION-001**: Classification values are exactly `Success` and `Failure` (confirmed in `BUNDLED_COLOR_MAP` and the filter rows). If future schemes add values, swatches still resolve via `colorMap?.[v]` with a gray fallback.
- **ASSUMPTION-002**: Closing Issue #24 only requires Phase 1; Phase 2 is value-add and can ship separately.

## 8. Related Specifications / Further Reading

- Issue #24: https://github.com/jrkasprzyk/ensemble-viewer/issues/24
- `ensemble-viewer plan/completed/feature-trace-classification-bundle-1.md` — classification bundle feature origin
- `ensemble-viewer plan/completed/feature-bundled-classification-horizons-1.md` — bundled horizons
- `src/lib/palette.js` — `BUNDLED_COLOR_MAP`, `OKABE_ITO`, `NEUTRAL_GRAY`
- `src/components/LabelControls.jsx:715-728` — existing Categories swatch pattern
