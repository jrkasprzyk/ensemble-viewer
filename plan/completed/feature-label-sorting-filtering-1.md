---
goal: Implement numeric sorting, sequential color palettes, and range filtering for any numeric label category
version: 2.0
date_created: 2026-05-19
last_updated: 2026-05-20
owner: GitHub Copilot
status: 'Completed'
tags: [feature, labels, filtering, sorting, plotting]
---

# Introduction

![Status: Completed](https://img.shields.io/badge/status-Completed-green)

This plan defines the minimum implementation required to let users pick any numeric label category as a sort/filter axis, order traces numerically by that category, apply an inclusive numeric range filter, assign a sequential color palette when `colorBy` targets a numeric category, and preserve all existing tie-label display, checkbox filtering, split, and band behavior.

Scope decisions recorded after design review (2026-05-20):
- Sort and range filtering generalize to **any** category whose values include at least one finite number — not only tied-label members.
- Only one sort/range category is active at a time (single `sortCategory` state).
- `tieRange = null` means no active range filter; traces are not excluded until the user explicitly narrows the range.
- Sequential color palette (`chroma-js`) replaces qualitative palette whenever `colorBy` is a numeric category.
- `chroma-js` is permitted as a new runtime dependency (overrides CON-001 below).

## 1. Requirements & Constraints

- **REQ-001**: Support a tied-label workflow where two existing categories are combined into one derived UI grouping (existing behavior, unchanged).
- **REQ-002**: Provide a deterministic numeric sort key for any category so values such as `80`, `95`, and `102` are ordered numerically ascending instead of alphabetically when the active sort category is numeric.
- **REQ-003**: Provide an inclusive numeric range filter so a user can keep only traces whose active sort-category numeric value falls between `min` and `max`, inclusive. `sortRange = null` means no filter is active and all traces pass.
- **REQ-004**: Preserve existing checkbox filtering in `src/components/LabelControls.jsx` for all categories and keep existing visibility computation in `src/App.jsx` compatible with current datasets.
- **REQ-005**: Preserve existing `colorBy`, `showBands`, and `splitBy` behavior in `src/App.jsx` and `src/components/EnsemblePlot.jsx`.
- **REQ-006**: Ensure tied-label display text continues to show both tied values and secondary label rides along with the sortable primary label in the checkbox list.
- **REQ-007**: When `colorBy` targets a category whose values are all finite numbers, assign colors using a sequential palette (YlGnBu or equivalent via `chroma-js`) sorted numerically. When values are non-numeric, use the existing qualitative Okabe-Ito palette.
- **SEC-001**: Accept only finite numeric values for range filtering. Treat `NaN`, `Infinity`, `-Infinity`, empty strings, and non-numeric strings as non-filterable; exclude them from numeric domain computation and range controls.
- **CON-001**: Do not add new runtime or test dependencies **except `chroma-js`**, which is permitted for sequential palette interpolation.
- **CON-002**: Limit production code changes to `src/lib/labels.js`, `src/lib/palette.js`, `src/App.jsx`, `src/components/LabelControls.jsx`, and `src/components/EnsemblePlot.jsx`.
- **GUD-001**: Keep parsing, sorting, and range-domain logic in pure functions under `src/lib/` so React components remain state orchestration and rendering layers.
- **PAT-001**: Follow the existing pattern where derived label summaries come from `summarizeLabels(...)` and derived visibility is computed in `useMemo(...)` blocks inside `src/App.jsx`.

## 2. Implementation Steps

### Implementation Phase 1 — Pure helpers

- **GOAL-001**: Add deterministic pure-function support for numeric parsing, sort metadata, and sequential palette generation without changing any component behavior.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-001 | Edit `src/lib/labels.js` and add a pure helper `parseFiniteLabelNumber(value)` directly below `summarizeLabels(...)`. Return `Number(value)` only when `Number.isFinite(Number(value))` is `true`; otherwise return `null`. |  |  |
| TASK-002 | Edit `src/lib/labels.js` and add a pure helper `buildSortMetadata(labelsByColumn, sortCategory)`. Return shape: `{ sortableValueByColumn, sortableNumberByColumn, numericDomain }`. `sortableValueByColumn[col]` = `labelsByColumn[col]?.[sortCategory] ?? ''`. `sortableNumberByColumn[col]` = `parseFiniteLabelNumber(sortableValueByColumn[col])`. `numericDomain` = `{ min, max }` using only finite values across all columns, or `null` when none exist. Return all-empty maps and `numericDomain: null` when `sortCategory` is `''` or absent. |  |  |
| TASK-003 | Edit `src/lib/palette.js` and add `buildSequentialColorMap(values, chromaScale)`. Install `chroma-js`. `values` is a numerically-sorted array of string labels. Use `chroma.scale(chromaScale).colors(values.length)` to generate hex colors. Return a `{ [value]: hexColor }` map. Use `'YlGnBu'` as the default scale. |  |  |
| TASK-004 | Extend `src/lib/labels.test.js` with deterministic tests covering `parseFiniteLabelNumber(...)` and `buildSortMetadata(...)`. Required assertions: numeric strings produce finite numbers, non-numeric values return `null`, missing category produces empty maps and `numericDomain: null`, domain uses only the min and max finite values. |  |  |

### Implementation Phase 2 — App state

- **GOAL-002**: Wire sort metadata and range filtering into application state.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-005 | Edit `src/App.jsx`. Add two state variables: `const [sortCategory, setSortCategory] = useState('')` and `const [sortRange, setSortRange] = useState(null)`. |  |  |
| TASK-006 | In `src/App.jsx`, add a `useMemo` that calls `buildSortMetadata(labelsByColumn, sortCategory)` and exposes `{ sortableNumberByColumn, numericDomain }`. Depends on `[labelsByColumn, sortCategory]`. |  |  |
| TASK-007 | In the existing `useEffect` at lines 131–141 of `src/App.jsx`, add reset logic: when `sortCategory` is set but `categoryValues[sortCategory]` no longer exists (label schema changed), reset `sortCategory → ''` and `sortRange → null`. Also reset both when `tieCategoryA` or `tieCategoryB` clears and `sortCategory` was one of them. |  |  |
| TASK-008 | Update `visibleColumns` in `src/App.jsx` so filtering remains conjunctive across all checkbox categories and additionally excludes a column when `sortRange !== null` and `sortableNumberByColumn[col]` is `null` or outside the inclusive `[sortRange.min, sortRange.max]` interval. |  |  |
| TASK-009 | Add a derived array `orderedColumns` in `src/App.jsx` that sorts `columns` by `sortableNumberByColumn[col]` ascending when `sortCategory` is set and finite numeric values exist, with a deterministic fallback of `String(col).localeCompare(String(otherCol))`. Pass `orderedColumns` instead of `columns` into all `<EnsemblePlot ... />` calls and into `plotGroups` computation (both the single-plot `columns` field and the `splitBy` column filter). |  |  |

### Implementation Phase 3 — UI controls

- **GOAL-003**: Update LabelControls and EnsemblePlot so the user can select a sort category, adjust the numeric range, and see consistent ordering and sequential colors.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-010 | Edit `src/components/LabelControls.jsx`. Add props: `sortCategory`, `onSortCategoryChange`, `sortRangeControl`, `onSortRangeChange`, `numericCategories` (array of category names that have ≥1 finite numeric value). In the Display section alongside `splitBy`, render a `Sort/filter by` select. Options: `None` + each entry in `numericCategories`. When `sortRangeControl !== null` (i.e. `sortCategory` is set and `numericDomain` is non-null), render two `<input type="number" />` elements labeled `Min` and `Max` immediately below the select. Bind to `sortRangeControl.value.min` / `.max`. Constrain `min`, `max`, `step` from `sortRangeControl.domain`. Call `onSortRangeChange({ min, max })` on change after clamping `min <= max`. Provide a `Clear` button that calls `onSortRangeChange(null)` to remove the active range filter. `sortRangeControl` shape: `{ domain: { min, max }, value: sortRange ?? domain }`. |  |  |
| TASK-011 | In `src/components/LabelControls.jsx`, for the category section whose name equals `sortCategory`, sort the `values` array numerically before rendering checkboxes. Extract the sort key with `parseFiniteLabelNumber(v)` for non-tied categories. For tied categories (value contains ` \| `), extract the primary part with `parseFiniteLabelNumber(v.split(' \| ')[0])`. Non-numeric values fall to the end in original order. Leave all other category sections unchanged. |  |  |
| TASK-012 | Edit `src/components/EnsemblePlot.jsx` line 45. After building `values` from `columns`, determine if all values are finite numbers (use `parseFiniteLabelNumber` imported from `../lib/labels.js`). If yes, sort `values` numerically and call `buildSequentialColorMap(values)` from `../lib/palette.js` instead of `buildColorMap`. If no, keep existing alphabetical sort and `buildColorMap`. This ensures band legend entries appear in the same numeric order as the side-panel list. |  |  |
| TASK-013 | Perform manual verification with `npm run dev` using a dataset with numeric label categories. Confirm: (1) `Sort/filter by` dropdown shows only numeric categories; (2) selecting a category reorders traces and checkboxes numerically; (3) setting a range excludes out-of-range traces; (4) Clear restores full visibility; (5) `colorBy` on a numeric category uses the sequential palette; (6) tied-label display and checkbox filtering remain intact. |  |  |

## 3. Alternatives

- **ALT-001**: Replace all checkbox filtering with a dedicated Plotly legend-driven workflow. Not chosen — `src/components/EnsemblePlot.jsx` disables per-trace legends and the side panel is the primary filtering mechanism.
- **ALT-002**: Encode tied labels as objects inside `labelsByColumn`. Not chosen — current app and hover rendering assume string label values.
- **ALT-003**: Add a third-party dual-range slider package. Not chosen — native `<input type="number" />` controls are sufficient.
- **ALT-004**: Restrict sort/range to tied-label members only. Not chosen after design review — numeric sorting is useful for any category with numeric values, not only tied pairs.
- **ALT-005**: Use `colorbrewer` package alone (no interpolation). Not chosen — awkward at N>9 or non-standard sizes. `chroma-js` handles arbitrary N cleanly.
- **ALT-006**: Multiple simultaneous range filters (one per numeric category). Not chosen — single active sort/range category is sufficient and keeps state and UI simple.

## 4. Dependencies

- **DEP-001**: Existing Node.js/Vite/Vitest toolchain declared in `package.json`.
- **DEP-002**: Existing pure-label utilities in `src/lib/labels.js`: `summarizeLabels(...)` and `tieLabelCategories(...)`.
- **DEP-003**: Existing manual component verification process documented in `CONTRIBUTING.md`.
- **DEP-004**: `chroma-js` — new runtime dependency for sequential palette interpolation.

## 5. Files

- **FILE-001**: `src/lib/labels.js` — add `parseFiniteLabelNumber` and `buildSortMetadata`.
- **FILE-002**: `src/lib/labels.test.js` — add unit coverage for new helpers.
- **FILE-003**: `src/lib/palette.js` — add `buildSequentialColorMap` using `chroma-js`.
- **FILE-004**: `src/App.jsx` — add `sortCategory`, `sortRange`, sort metadata memo, `orderedColumns`, range filtering.
- **FILE-005**: `src/components/LabelControls.jsx` — add sort/filter select, range inputs, numeric value sorting.
- **FILE-006**: `src/components/EnsemblePlot.jsx` — use sequential palette for numeric `colorBy`, preserve sorted column order for band legend.

## 6. Testing

- **TEST-001**: Run `npm run test` and require all Vitest suites to pass, including new assertions in `src/lib/labels.test.js`.
- **TEST-002**: Run `npm run build` and require a successful Vite production build with no new warnings.
- **TEST-003**: Run `npm run dev`, load a dataset with numeric label values, set sort category, and verify traces reorder numerically.
- **TEST-004**: Verify inclusive range filter with bounds `80` and `95` keeps only matching traces; verify `Clear` restores all visible traces.
- **TEST-005**: Verify that selecting a numeric `colorBy` category assigns a sequential palette; non-numeric categories retain qualitative palette.
- **TEST-006**: Verify datasets with non-numeric categories do not appear in the `Sort/filter by` dropdown and continue supporting checkbox filtering without errors.
- **TEST-007**: Verify clearing `sortCategory` disables range controls and restores unsorted checkbox-only filtering.

## 7. Risks & Assumptions

- **RISK-001**: Mixed numeric/non-numeric values in the sort category — non-numeric traces are excluded when `sortRange !== null`. UI must communicate which traces are excluded. The `sortRangeControl` range inputs only show when `numericDomain` is non-null.
- **RISK-002**: `orderedColumns` replaces `columns` in both `plotGroups` and `<EnsemblePlot />` calls. Must be applied consistently to avoid color-map ordering diverging from band legend ordering.
- **RISK-003**: `chroma-js` sequential palette requires numeric sort of `colorBy` values before color assignment. If `columns` prop to EnsemblePlot is already in numeric order (via `orderedColumns`), color assignment follows automatically.
- **ASSUMPTION-001**: Label values are expressed as strings inside `labelsByColumn`, including numeric-looking strings such as `"95"` or `"102.5"`.
- **ASSUMPTION-002**: `sortRange = null` is the canonical "no filter active" state. The range inputs display `domain.min` / `domain.max` as default values but do not activate filtering until the user changes them (since `sortRange` stays `null` until `onSortRangeChange` is called with a non-null value).

## 8. Related Specifications / Further Reading

- `README.md`
- `CONTRIBUTING.md`
- [ColorBrewer](https://colorbrewer2.org/?type=sequential&scheme=YlGnBu&n=3)
- [chroma-js docs](https://gka.github.io/chroma.js/)
