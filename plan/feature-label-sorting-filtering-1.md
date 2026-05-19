---
goal: Implement tied-label sorting and numeric multi-trace filtering for ensemble plots
version: 1.0
date_created: 2026-05-19
last_updated: 2026-05-19
owner: GitHub Copilot
status: 'Planned'
tags: [feature, labels, filtering, sorting, plotting]
---

# Introduction

![Status: Planned](https://img.shields.io/badge/status-Planned-blue)

This plan defines the minimum implementation required to let users tie two label categories, sort the tied output by one selected label, and filter multiple traces by an inclusive numeric range while preserving existing color, split, and checkbox filtering behavior.

## 1. Requirements & Constraints

- **REQ-001**: Support a tied-label workflow where two existing categories from `/home/runner/work/ensemble-viewer/ensemble-viewer/src/App.jsx` state (`tieCategoryA`, `tieCategoryB`) are combined into one derived UI grouping without deleting the ability to sort or filter by one selected member of the pair.
- **REQ-002**: Provide a deterministic sort key for tied labels so values such as `80`, `95`, and `102` are ordered numerically ascending instead of alphabetically when the selected sort label is numeric.
- **REQ-003**: Provide an inclusive numeric range filter so a user can keep only traces whose selected tied-label numeric value is between `min` and `max`, inclusive.
- **REQ-004**: Preserve existing checkbox filtering in `/home/runner/work/ensemble-viewer/ensemble-viewer/src/components/LabelControls.jsx` for non-tied categories and keep existing visibility computation in `/home/runner/work/ensemble-viewer/ensemble-viewer/src/App.jsx` compatible with current datasets.
- **REQ-005**: Preserve existing `colorBy`, `showBands`, and `splitBy` behavior in `/home/runner/work/ensemble-viewer/ensemble-viewer/src/App.jsx:131-171` and `/home/runner/work/ensemble-viewer/ensemble-viewer/src/components/EnsemblePlot.jsx:42-128`.
- **REQ-006**: Ensure tied-label display text continues to show both tied values in the UI and hover content so the secondary label "rides along" with the primary sortable label.
- **SEC-001**: Accept only finite numeric values for range filtering. Treat `NaN`, `Infinity`, `-Infinity`, empty strings, and non-numeric strings as non-filterable values and exclude them from numeric range controls.
- **CON-001**: Do not add new runtime or test dependencies. Use only the existing React, Plotly, Vite, and Vitest setup declared in `/home/runner/work/ensemble-viewer/ensemble-viewer/package.json`.
- **CON-002**: Limit production code changes to the current label-processing and plot-control files: `/home/runner/work/ensemble-viewer/ensemble-viewer/src/lib/labels.js`, `/home/runner/work/ensemble-viewer/ensemble-viewer/src/App.jsx`, `/home/runner/work/ensemble-viewer/ensemble-viewer/src/components/LabelControls.jsx`, and `/home/runner/work/ensemble-viewer/ensemble-viewer/src/components/EnsemblePlot.jsx`.
- **GUD-001**: Keep parsing, sorting, and range-domain logic in pure functions under `/home/runner/work/ensemble-viewer/ensemble-viewer/src/lib/` so the React components remain state orchestration and rendering layers.
- **PAT-001**: Follow the existing pattern where derived label summaries come from `summarizeLabels(...)` and derived visibility is computed in `useMemo(...)` blocks inside `/home/runner/work/ensemble-viewer/ensemble-viewer/src/App.jsx:114-171`.

## 2. Implementation Steps

### Implementation Phase 1

- **GOAL-001**: Add deterministic pure-function support for tied-label metadata, numeric sort extraction, and range-domain calculation without changing component behavior until the helpers are wired in.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-001 | Edit `/home/runner/work/ensemble-viewer/ensemble-viewer/src/lib/labels.js` and add a pure helper named `parseFiniteLabelNumber(value)` directly below `summarizeLabels(...)`. Implementation rule: return `Number(value)` only when `Number.isFinite(Number(value))` is `true`; otherwise return `null`. |  |  |
| TASK-002 | Edit `/home/runner/work/ensemble-viewer/ensemble-viewer/src/lib/labels.js` and add a pure helper named `buildTiedLabelMetadata(labelsByColumn, primaryCategory, secondaryCategory)`. Return shape: `{ tiedCategoryName, tiedLabelsByColumn, sortableValueByColumn, sortableNumberByColumn, numericDomain }`. `tiedCategoryName` must equal `${primaryCategory} + ${secondaryCategory}` when both categories are present, otherwise `''`. `tiedLabelsByColumn[col]` must equal `${labels[primaryCategory] ?? ''} | ${labels[secondaryCategory] ?? ''}` for each column with both labels. `sortableValueByColumn[col]` must equal `labels[primaryCategory] ?? ''`. `sortableNumberByColumn[col]` must equal `parseFiniteLabelNumber(sortableValueByColumn[col])`. `numericDomain` must equal `{ min, max }` using only finite numbers, or `null` when no finite values exist. |  |  |
| TASK-003 | Extend `/home/runner/work/ensemble-viewer/ensemble-viewer/src/lib/labels.test.js` with deterministic tests covering `parseFiniteLabelNumber(...)` and `buildTiedLabelMetadata(...)`. Required assertions: numeric strings sort as numbers, non-numeric values return `null`, missing tied categories produce `tiedCategoryName === ''`, and numeric domains are computed from the minimum and maximum finite sortable values only. |  |  |

### Implementation Phase 2

- **GOAL-002**: Wire tied-label metadata into application state so the selected primary label controls ordering and inclusive numeric range filtering while existing category filters continue to operate.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-004 | Edit `/home/runner/work/ensemble-viewer/ensemble-viewer/src/App.jsx` in the derived-state section at lines `114-171`. Add new state variables above that block: `const [tieSortCategory, setTieSortCategory] = useState('')` and `const [tieRange, setTieRange] = useState(null)`. |  |  |
| TASK-005 | Replace the current `effectiveLabelsByColumn = tieLabelCategories(...)` only workflow in `/home/runner/work/ensemble-viewer/ensemble-viewer/src/App.jsx:116-120` with a two-step workflow: (1) keep `tieLabelCategories(...)` for display labels, and (2) call `buildTiedLabelMetadata(labelsByColumn, tieSortCategory, tieSortCategory === tieCategoryA ? tieCategoryB : tieCategoryA)` to derive numeric sort metadata for the selected sortable member of the tied pair. Reset `tieSortCategory` to `''` and `tieRange` to `null` whenever the selected tie categories or label schema become invalid. |  |  |
| TASK-006 | Update `visibleColumns` in `/home/runner/work/ensemble-viewer/ensemble-viewer/src/App.jsx:143-157` so filtering remains conjunctive across all active checkbox categories and additionally excludes a column when `tieRange !== null` and `sortableNumberByColumn[col]` is `null` or outside the inclusive `[tieRange.min, tieRange.max]` interval. |  |  |
| TASK-007 | Add a derived array named `orderedColumns` in `/home/runner/work/ensemble-viewer/ensemble-viewer/src/App.jsx` that sorts the existing `columns` array by `sortableNumberByColumn[col]` ascending when `tieSortCategory` is set and a finite numeric value exists, with a deterministic fallback of `String(col).localeCompare(String(otherCol))`. Pass `orderedColumns` instead of `columns` into each `<EnsemblePlot ... />` call and into any list rendering that must reflect sorted tied-label order. |  |  |

### Implementation Phase 3

- **GOAL-003**: Update the UI controls and plot ordering so users can select the sortable member of a tied pair, adjust the numeric range, and observe consistent sorting in the side-panel and Plotly band legends.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-008 | Edit `/home/runner/work/ensemble-viewer/ensemble-viewer/src/components/LabelControls.jsx` and add four new props: `tieSortCategory`, `onTieSortCategoryChange`, `tieRangeControl`, and `onTieRangeChange`. Render a new select immediately below the existing tie selectors at lines `98-123` with label text `Sort/filter tied labels by`. Options must be `None`, `tieCategoryA`, and `tieCategoryB`; disable the control unless both tie categories are selected. |  |  |
| TASK-009 | In `/home/runner/work/ensemble-viewer/ensemble-viewer/src/components/LabelControls.jsx`, render an inclusive numeric range control immediately below the new sort/filter select when `tieRangeControl !== null`. Use two `<input type="number" />` elements labeled `Min` and `Max`. Bind them to `tieRangeControl.value.min` and `tieRangeControl.value.max`. Constrain their `min`, `max`, and `step` attributes from `tieRangeControl.domain`. Call `onTieRangeChange({ min, max })` on change after clamping `min <= max`. |  |  |
| TASK-010 | In `/home/runner/work/ensemble-viewer/ensemble-viewer/src/components/LabelControls.jsx:131-183`, sort the `values` array for the derived tied category by ascending `sortableNumberByColumn` when the current category equals `tieRangeControl.categoryName`. Render the sortable value first and the secondary tied value in muted trailing text so the secondary label rides along. Leave non-tied categories unchanged. |  |  |
| TASK-011 | Edit `/home/runner/work/ensemble-viewer/ensemble-viewer/src/components/EnsemblePlot.jsx:42-128` so the color map values array and the summary-band group iteration both use the already-sorted `columns` prop order instead of unsorted `Object.entries(groups)` insertion order. Validation rule: when `showBands` is true and `colorBy` references the tied sortable category, Plotly legend entries must appear in the same ascending numeric order as the side-panel tied-label list. |  |  |
| TASK-012 | Perform manual verification with `npm run dev` using a dataset that contains two tied labels such as `Trace Year` and `Percent of Historical Average`. Confirm the following sequence: select both tie categories, set `Sort/filter tied labels by` to `Percent of Historical Average`, set the numeric range to `80` and `95`, and verify only traces whose tied numeric label is within the inclusive interval remain visible. Capture one screenshot of the updated controls and filtered plot state. |  |  |

## 3. Alternatives

- **ALT-001**: Replace all checkbox filtering with a dedicated Plotly legend-driven workflow. This was not chosen because `/home/runner/work/ensemble-viewer/ensemble-viewer/src/components/EnsemblePlot.jsx:69` explicitly disables per-trace legends and the existing side panel is the primary filtering mechanism.
- **ALT-002**: Encode tied labels as objects inside `labelsByColumn`. This was not chosen because the current app and hover rendering in `/home/runner/work/ensemble-viewer/ensemble-viewer/src/components/EnsemblePlot.jsx:64-66` assume string label values, and changing the shared label shape would create unnecessary scope.
- **ALT-003**: Add a third-party dual-range slider package. This was not chosen because **CON-001** prohibits new dependencies and the existing UI can support deterministic numeric filtering with native `<input type="number" />` controls.

## 4. Dependencies

- **DEP-001**: Existing Node.js/Vite/Vitest toolchain declared in `/home/runner/work/ensemble-viewer/ensemble-viewer/package.json`.
- **DEP-002**: Existing pure-label utilities in `/home/runner/work/ensemble-viewer/ensemble-viewer/src/lib/labels.js`, specifically `summarizeLabels(...)` and `tieLabelCategories(...)`.
- **DEP-003**: Existing manual component verification process documented in `/home/runner/work/ensemble-viewer/ensemble-viewer/CONTRIBUTING.md:104-109`.

## 5. Files

- **FILE-001**: `/home/runner/work/ensemble-viewer/ensemble-viewer/src/lib/labels.js` — add numeric parsing and tied-label metadata helpers.
- **FILE-002**: `/home/runner/work/ensemble-viewer/ensemble-viewer/src/lib/labels.test.js` — add unit coverage for numeric parsing and tied-label metadata.
- **FILE-003**: `/home/runner/work/ensemble-viewer/ensemble-viewer/src/App.jsx` — add state, derived metadata, ordered columns, and conjunctive numeric range filtering.
- **FILE-004**: `/home/runner/work/ensemble-viewer/ensemble-viewer/src/components/LabelControls.jsx` — add tie sort selector, numeric range inputs, and sorted tied-label rendering.
- **FILE-005**: `/home/runner/work/ensemble-viewer/ensemble-viewer/src/components/EnsemblePlot.jsx` — preserve sorted band-legend ordering derived from the ordered column list.

## 6. Testing

- **TEST-001**: Run `npm run test` from `/home/runner/work/ensemble-viewer/ensemble-viewer` and require all Vitest suites to pass, including new assertions added to `src/lib/labels.test.js`.
- **TEST-002**: Run `npm run build` from `/home/runner/work/ensemble-viewer/ensemble-viewer` and require a successful Vite production build with no new warnings introduced by the feature files.
- **TEST-003**: Run `npm run dev`, load a dataset with tied numeric labels, and verify inclusive range filtering with bounds `80` and `95` keeps only matching traces visible.
- **TEST-004**: Verify that clearing the selected tied sort category disables the numeric range controls and restores the previous unsorted checkbox-only filtering behavior.
- **TEST-005**: Verify that datasets with non-numeric tied values do not render numeric range controls and continue to support checkbox filtering without runtime errors.

## 7. Risks & Assumptions

- **RISK-001**: If the selected tied sort category contains mixed numeric and non-numeric values, some traces may become non-filterable by numeric range. The implementation must explicitly exclude non-finite values from the numeric domain and document the behavior in the UI.
- **RISK-002**: Replacing `columns` with a sorted derivative in `/home/runner/work/ensemble-viewer/ensemble-viewer/src/App.jsx` can unintentionally change color-map ordering if not applied consistently. `src/components/EnsemblePlot.jsx` must therefore consume the same sorted `columns` array for both trace iteration and band legend construction.
- **ASSUMPTION-001**: The user intends one member of the tied pair to be the sortable/filterable primary label and the other member to remain display-only within the tied label text.
- **ASSUMPTION-002**: Existing datasets continue to express label values as strings inside `labelsByColumn`, including numeric-looking strings such as `"95"` or `"102.5"`.

## 8. Related Specifications / Further Reading

- `/home/runner/work/ensemble-viewer/ensemble-viewer/README.md`
- `/home/runner/work/ensemble-viewer/ensemble-viewer/CONTRIBUTING.md`
